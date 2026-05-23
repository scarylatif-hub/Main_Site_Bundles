import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeStatusForEarnings } from "@/lib/reseller-earnings";
import { extractDakazinaOrderCode } from "@/lib/dakazina-order-code";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

function normalizeWebhookStatus(raw: unknown): string {
  return normalizeStatusForEarnings(raw);
}

/**
 * Verify Dakazina HMAC-SHA256 signature.
 * Header format: "sha256=<hex_digest>"
 * Signed payload: "<timestamp>.<raw_body>"
 */
function verifyDakazinaSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature || !timestamp) return false;

  // Reject stale webhooks (> 5 minutes)
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > 300) {
    console.warn("⚠️  Dakazina webhook: Timestamp too old", { ageSeconds });
    return false;
  }

  const expectedPrefix = "sha256=";
  if (!signature.startsWith(expectedPrefix)) return false;

  const receivedHex = signature.slice(expectedPrefix.length);
  const payload = `${timestamp}.${rawBody}`;
  const expectedHex = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(receivedHex, "hex"),
      Buffer.from(expectedHex, "hex")
    );
  } catch {
    // Buffer lengths differ → invalid
    return false;
  }
}

function collectWebhookReferences(body: Record<string, unknown>): string[] {
  return [
    body.order_code,
    body.reference,
    body.transaction_id,
    body.transactionId,
    body.transaction_code,
    body.transactionCode,
    body.payment_reference,
    body.paymentReference,
    body.paystack_transaction_id,
    body.paystackTransactionId,
    body.id,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  console.log("📦 Dakazina webhook: Received request");

  // Read raw body first (needed for signature verification)
  const rawBody = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    console.error("❌ Dakazina webhook: Invalid JSON", error);
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 200 });
  }

  console.log("📋 Dakazina webhook: Full payload:", JSON.stringify(body, null, 2));

  const secret = process.env.DAKAZINA_WEBHOOK_SECRET?.trim();

  if (secret) {
    const signature = req.headers.get("dakazina-signature");
    const timestamp = req.headers.get("dakazina-timestamp");
    const valid = verifyDakazinaSignature(rawBody, signature, timestamp, secret);

    if (!valid) {
      console.error("❌ Dakazina webhook: Invalid signature", {
        signature,
        timestamp,
      });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // Skip test events (both signals)
  if (body.test === true || body.type === "test_event") {
    console.log("⚠️  Dakazina webhook: Test event received, skipping");
    return NextResponse.json({ ok: true, skipped: "test_event" }, { status: 200 });
  }

  const dakazinaOrderCode = extractDakazinaOrderCode(body, "");
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

  // ── Transactions lookup ──────────────────────────────────────────────────
  let transactionMatches: any[] | null = null;
  let transactionLookupError: any = null;

  if (dakazinaOrderCode) {
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
      .map((r) => `reference.eq.${r},transaction_code.eq.${r}`)
      .join(",");
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
    return NextResponse.json({ ok: false, error: transactionLookupError.message }, { status: 200 });
  }

  console.log(`✅ Dakazina webhook: Found ${transactionMatches?.length ?? 0} transactions`);

  const transactionIds = [...new Set((transactionMatches ?? []).map((r) => r.id))];
  let transactionsUpdated = 0;

  if (transactionIds.length > 0) {
    const { data: updatedTransactions, error: transactionUpdateError } = await admin
      .from("transactions")
      .update(transactionPatch)
      .in("id", transactionIds)
      .select("id");

    if (transactionUpdateError) {
      console.error("❌ Dakazina webhook: Transaction update failed", transactionUpdateError);
      return NextResponse.json({ ok: false, error: transactionUpdateError.message }, { status: 200 });
    }
    transactionsUpdated = updatedTransactions?.length ?? 0;
  }

  // ── Orders lookup ────────────────────────────────────────────────────────
  const orderPatch: Record<string, unknown> = { status };
  if (dakazinaOrderCode) {
    orderPatch.dakazina_order_id = dakazinaOrderCode;
  }

  let orderMatches: any[] | null = null;
  let orderLookupError: any = null;

  if (dakazinaOrderCode) {
    const result = await admin
      .from("orders")
      .select("id, paystack_transaction_id, payment_reference, status, dakazina_order_id")
      .eq("dakazina_order_id", dakazinaOrderCode);
    orderMatches = result.data;
    orderLookupError = result.error;
  }

  if ((!orderMatches || orderMatches.length === 0) && referenceCandidates.length > 0) {
    const orderOrClause = referenceCandidates
      .map((r) => `paystack_transaction_id.eq.${r},payment_reference.eq.${r}`)
      .join(",");
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

  console.log(`✅ Dakazina webhook: Found ${orderMatches?.length ?? 0} orders`);

  const orderIds = [...new Set((orderMatches ?? []).map((r) => r.id))];
  let ordersUpdated = 0;

  if (orderIds.length > 0) {
    const { data: updatedOrders, error: orderUpdateError } = await admin
      .from("orders")
      .update(orderPatch)
      .in("id", orderIds)
      .select("id");

    if (orderUpdateError) {
      console.error("❌ Dakazina webhook: Order update failed", orderUpdateError);
      return NextResponse.json({ ok: false, error: orderUpdateError.message }, { status: 200 });
    }
    ordersUpdated = updatedOrders?.length ?? 0;
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