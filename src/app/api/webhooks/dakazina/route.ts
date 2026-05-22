import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeStatusForEarnings } from "@/lib/reseller-earnings";

export const dynamic = "force-dynamic";

function normalizeWebhookStatus(raw: unknown): string {
  return normalizeStatusForEarnings(raw);
}

function collectWebhookReferences(body: Record<string, unknown>): string[] {
  return [
    body.order_code,
    body.reference,
    body.transaction_id,
    body.transaction_code,
    body.payment_reference,
    body.paystack_transaction_id,
    body.id,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  console.log("📦 Dakazina webhook: Received request");
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("❌ Dakazina webhook: Invalid JSON", error);
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 200 });
  }

  // Log the FULL incoming payload for debugging
  console.log("📋 Dakazina webhook: Full payload:", JSON.stringify(body, null, 2));

  // Dakazina sends test events from dashboard; acknowledge but do not mutate data.
  if (body.test === true) {
    console.log("⚠️  Dakazina webhook: Test event received, skipping");
    return NextResponse.json({ ok: true, skipped: "test_event" }, { status: 200 });
  }

  const dakazinaOrderCode = String(
    body.order_code ?? body.transaction_id ?? body.transaction_code ?? ""
  ).trim();
  const referenceCandidates = collectWebhookReferences(body).filter(
    (value) => value !== dakazinaOrderCode
  );

  if (!dakazinaOrderCode && referenceCandidates.length === 0) {
    console.error("❌ Dakazina webhook: Missing reference/order_code", body);
    return NextResponse.json({ ok: false, error: "Missing reference" }, { status: 200 });
  }

  const status = normalizeWebhookStatus(body.status);
  const previousStatus = normalizeWebhookStatus(body.previous_status);
  if (!status) {
    console.error("❌ Dakazina webhook: Missing status", body);
    return NextResponse.json({ ok: false, error: "Missing status" }, { status: 200 });
  }

  const admin = createAdminClient();

  console.log("📊 Dakazina webhook received:", {
    dakazina_order_code: dakazinaOrderCode,
    references: referenceCandidates,
    status,
    previous_status: previousStatus,
    id: body.id,
    type: body.type,
    occurred_at: body.occurred_at,
  });

  const transactionPatch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (dakazinaOrderCode) {
    transactionPatch.dakazina_order_id = dakazinaOrderCode;
  }

  if (body.recipient_msisdn) {
    transactionPatch.recipient_msisdn = String(body.recipient_msisdn);
  }
  if (body.bundle_amount) {
    transactionPatch.bundle_amount = String(body.bundle_amount);
  }

  let transactionMatches: any[] | null = null;
  let transactionLookupError: any = null;

  if (dakazinaOrderCode) {
    console.log(`🔍 Dakazina webhook: Looking up transactions by dakazina_order_id: ${dakazinaOrderCode}`);
    const result = await admin
      .from("transactions")
      .select("id, reference, transaction_code, status, dakazina_order_id")
      .eq("transaction_type", "purchase")
      .eq("dakazina_order_id", dakazinaOrderCode);

    transactionMatches = result.data;
    transactionLookupError = result.error;
  }

  if ((!transactionMatches || transactionMatches.length === 0) && referenceCandidates.length > 0) {
    const orClause = referenceCandidates
      .map((reference) => `reference.eq.${reference},transaction_code.eq.${reference}`)
      .join(",");

    console.log(`🔍 Dakazina webhook: Fallback - Looking up transactions by other references: ${orClause}`);
    const result = await admin
      .from("transactions")
      .select("id, reference, transaction_code, status, dakazina_order_id")
      .eq("transaction_type", "purchase")
      .or(orClause);

    transactionMatches = result.data;
    transactionLookupError = result.error;
  }

  if (transactionLookupError) {
    console.error("❌ Dakazina webhook: Transaction lookup failed", transactionLookupError);
    return NextResponse.json(
      { ok: false, error: transactionLookupError.message },
      { status: 200 }
    );
  }

  console.log(`✅ Dakazina webhook: Found ${transactionMatches?.length || 0} transactions`);

  const transactionIds = [...new Set((transactionMatches || []).map((row) => row.id))];
  let transactionsUpdated = 0;

  if (transactionIds.length > 0) {
    const { data: updatedTransactions, error: transactionUpdateError } = await admin
      .from("transactions")
      .update(transactionPatch)
      .in("id", transactionIds)
      .select("id");

    if (transactionUpdateError) {
      console.error("❌ Dakazina webhook: Transaction update failed", transactionUpdateError);
      return NextResponse.json(
        { ok: false, error: transactionUpdateError.message },
        { status: 200 }
      );
    }

    transactionsUpdated = updatedTransactions?.length || 0;
  }

  const orderPatch: Record<string, unknown> = {
    status,
  };

  if (dakazinaOrderCode) {
    orderPatch.dakazina_order_id = dakazinaOrderCode;
  }

  let orderMatches: any[] | null = null;
  let orderLookupError: any = null;

  if (dakazinaOrderCode) {
    console.log(`🔍 Dakazina webhook: Looking up orders by dakazina_order_id: ${dakazinaOrderCode}`);
    const result = await admin
      .from("orders")
      .select("id, paystack_transaction_id, payment_reference, status, dakazina_order_id")
      .eq("dakazina_order_id", dakazinaOrderCode);

    orderMatches = result.data;
    orderLookupError = result.error;
  }

  if ((!orderMatches || orderMatches.length === 0) && referenceCandidates.length > 0) {
    const orderOrClause = referenceCandidates
      .map(
        (reference) =>
          `paystack_transaction_id.eq.${reference},payment_reference.eq.${reference}`
      )
      .join(",");

    console.log(`🔍 Dakazina webhook: Fallback - Looking up orders by other references: ${orderOrClause}`);
    const result = await admin
      .from("orders")
      .select("id, paystack_transaction_id, payment_reference, status, dakazina_order_id")
      .or(orderOrClause);

    orderMatches = result.data;
    orderLookupError = result.error;
  }

  if (orderLookupError) {
    console.error("❌ Dakazina webhook: Order lookup failed", orderLookupError);
    return NextResponse.json({ ok: false, error: orderLookupError.message }, { status: 200 });
  }

  console.log(`✅ Dakazina webhook: Found ${orderMatches?.length || 0} orders`);

  const orderIds = [...new Set((orderMatches || []).map((row) => row.id))];
  let ordersUpdated = 0;

  if (orderIds.length > 0) {
    const { data: updatedOrders, error: orderUpdateError } = await admin
      .from("orders")
      .update(orderPatch)
      .in("id", orderIds)
      .select("id");

    if (orderUpdateError) {
      console.error("❌ Dakazina webhook: Order update failed", orderUpdateError);
      return NextResponse.json(
        { ok: false, error: orderUpdateError.message },
        { status: 200 }
      );
    }

    ordersUpdated = updatedOrders?.length || 0;
  }

  const response = {
    ok: true,
    dakazina_order_code: dakazinaOrderCode,
    references: referenceCandidates,
    status,
    previous_status: previousStatus,
    transactions_updated: transactionsUpdated,
    orders_updated: ordersUpdated,
    webhook_id: body.id,
    test: body.test ?? false,
  };

  console.log("✅ Dakazina webhook processed successfully:", response);
  return NextResponse.json(response);
}

export async function GET() {
  return NextResponse.json({ message: "Webhook endpoint is active" }, { status: 200 });
}
