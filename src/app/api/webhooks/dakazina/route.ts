import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalizeWebhookStatus(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
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
  const secret = process.env.DAKAZINA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("Dakazina webhook: Missing DAKAZINA_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const headerSecret =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("x-dakazina-signature")?.trim() ||
    req.headers.get("x-provider-signature")?.trim();

  if (!headerSecret || headerSecret !== secret) {
    console.warn("Dakazina webhook: Unauthorized - invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Dakazina webhook: Invalid JSON", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const referenceCandidates = collectWebhookReferences(body);
  if (referenceCandidates.length === 0) {
    console.error("Dakazina webhook: Missing reference/order_code", body);
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const status = normalizeWebhookStatus(body.status);
  if (!status) {
    console.error("Dakazina webhook: Missing status", body);
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const admin = createAdminClient();

  console.log("Dakazina webhook received:", {
    references: referenceCandidates,
    status,
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

  const { data: transactionMatches, error: transactionLookupError } = await admin
    .from("transactions")
    .select("id")
    .eq("transaction_type", "purchase")
    .or(
      referenceCandidates
        .map((reference) => `reference.eq.${reference},transaction_code.eq.${reference}`)
        .join(",")
    );

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

  const { data: orderMatches, error: orderLookupError } = await admin
    .from("orders")
    .select("id")
    .or(
      referenceCandidates
        .map(
          (reference) =>
            `paystack_transaction_id.eq.${reference},payment_reference.eq.${reference}`
        )
        .join(",")
    );

  if (orderLookupError) {
    console.error("Dakazina webhook: Order lookup failed", orderLookupError);
    return NextResponse.json({ error: orderLookupError.message }, { status: 500 });
  }

  const orderIds = [...new Set((orderMatches || []).map((row) => row.id))];
  let ordersUpdated = 0;

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
    transactions_updated: transactionsUpdated,
    orders_updated: ordersUpdated,
    webhook_id: body.id,
    test: body.test ?? false,
  };

  console.log("Dakazina webhook processed successfully:", response);
  return NextResponse.json(response);
}
