import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeStatusForEarnings } from "@/lib/reseller-earnings";

export const dynamic = "force-dynamic";

function normalizeWebhookStatus(raw: unknown): string {
  return normalizeStatusForEarnings(raw);
}

function collectWebhookReferences(body: Record<string, unknown>): string[] {
  return [
    body.reference,
    body.order_code,
    body.transaction_id,
    body.transaction_code,
    body.id,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  console.log("Dakazina webhook: Received request");
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Dakazina webhook: Invalid JSON", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Dakazina sends test events from dashboard; acknowledge but do not mutate data.
  if (body.test === true) {
    return NextResponse.json({ ok: true, skipped: "test_event" });
  }

  const referenceCandidates = collectWebhookReferences(body);
  if (referenceCandidates.length === 0) {
    console.error("Dakazina webhook: Missing reference/order_code", body);
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const status = normalizeWebhookStatus(body.status);
  const previousStatus = normalizeWebhookStatus(body.previous_status);
  if (!status) {
    console.error("Dakazina webhook: Missing status", body);
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const admin = createAdminClient();

  console.log("Dakazina webhook received:", {
    references: referenceCandidates,
    status,
    previous_status: previousStatus,
    order_code: body.order_code,
    type: body.type,
    test: body.test,
    occurred_at: body.occurred_at,
  });

  const transactionPatch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (body.amount != null) transactionPatch.amount = Number(body.amount);
  if (body.network_id != null) transactionPatch.network_id = Number(body.network_id);
  if (body.recipient_msisdn) {
    transactionPatch.recipient_msisdn = String(body.recipient_msisdn);
  }
  if (body.bundle_amount) transactionPatch.bundle_amount = String(body.bundle_amount);

  const orClause = referenceCandidates
        .map((reference) => `reference.eq.${reference},transaction_code.eq.${reference}`)
        .join(",");
  
  console.log("Dakazina webhook: Looking up transactions with OR clause:", orClause);

  const { data: transactionMatches, error: transactionLookupError } = await admin
    .from("transactions")
    .select("id, reference, transaction_code, status")
    .eq("transaction_type", "purchase")
    .or(orClause);

  if (transactionLookupError) {
    console.error(
      "Dakazina webhook: Transaction lookup failed",
      transactionLookupError
    );
    return NextResponse.json(
      { error: transactionLookupError.message },
      { status: 500 }
    );
  }

  console.log("Dakazina webhook: Found transactions:", transactionMatches?.length || 0);

  const transactionIds = [...new Set((transactionMatches || []).map((row) => row.id))];
  let transactionsUpdated = 0;

  if (transactionIds.length > 0) {
    const { data: updatedTransactions, error: transactionUpdateError } = await admin
      .from("transactions")
      .update(transactionPatch)
      .in("id", transactionIds)
      .select("id");

    if (transactionUpdateError) {
      console.error(
        "Dakazina webhook: Transaction update failed",
        transactionUpdateError
      );
      return NextResponse.json(
        { error: transactionUpdateError.message },
        { status: 500 }
      );
    }

    transactionsUpdated = updatedTransactions?.length || 0;
  }

  const orderPatch: Record<string, unknown> = {
    status,
  };

  const orderOrClause = referenceCandidates
        .map(
          (reference) =>
            `paystack_transaction_id.eq.${reference},payment_reference.eq.${reference}`
        )
        .join(",");
  
  console.log("Dakazina webhook: Looking up orders with OR clause:", orderOrClause);

  const { data: orderMatches, error: orderLookupError } = await admin
    .from("orders")
    .select("id, paystack_transaction_id, payment_reference, status")
    .or(orderOrClause);

  if (orderLookupError) {
    console.error("Dakazina webhook: Order lookup failed", orderLookupError);
    return NextResponse.json({ error: orderLookupError.message }, { status: 500 });
  }

  console.log("Dakazina webhook: Found orders:", orderMatches?.length || 0);

  const orderIds = [...new Set((orderMatches || []).map((row) => row.id))];
  let ordersUpdated = 0;

  // Fallback: some Dakazina payloads use provider-only IDs that don't map to our stored refs.
  // In that case, try a conservative heuristic by amount + recent created_at + in-flight statuses.
  if (orderIds.length === 0 && body.amount != null) {
    const occurredAt = body.occurred_at ? new Date(String(body.occurred_at)) : new Date();
    const lowerBound = new Date(occurredAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const upperBound = new Date(occurredAt.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const amount = Number(body.amount);

    const { data: heuristicOrders, error: heuristicError } = await admin
      .from("orders")
      .select("id, amount, status, created_at")
      .in("status", ["pending", "processing", "placed"])
      .gte("created_at", lowerBound)
      .lte("created_at", upperBound)
      .eq("amount", amount)
      .order("created_at", { ascending: false })
      .limit(1);

    if (heuristicError) {
      console.error("Dakazina webhook: Heuristic order lookup failed", heuristicError);
    } else if ((heuristicOrders?.length || 0) === 1) {
      orderIds.push(heuristicOrders![0].id);
      console.log("Dakazina webhook: Heuristic matched order", heuristicOrders![0].id);
    }
  }

  if (orderIds.length > 0) {
    const { data: updatedOrders, error: orderUpdateError } = await admin
      .from("orders")
      .update(orderPatch)
      .in("id", orderIds)
      .select("id");

    if (orderUpdateError) {
      console.error("Dakazina webhook: Order update failed", orderUpdateError);
      return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
    }

    ordersUpdated = updatedOrders?.length || 0;
  }

  const response = {
    ok: true,
    references: referenceCandidates,
    status,
    previous_status: previousStatus,
    transactions_updated: transactionsUpdated,
    orders_updated: ordersUpdated,
    webhook_id: body.id,
    test: body.test ?? false,
  };

  console.log("Dakazina webhook processed successfully:", response);
  return NextResponse.json(response);
}
