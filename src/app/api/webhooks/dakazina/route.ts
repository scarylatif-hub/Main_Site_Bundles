import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/dakazina
 * Handles Dakazina webhook payloads for order status updates.
 * Webhook URL: https://sbbundles-main.vercel.app/api/webhooks/dakazina
 * 
 * Example payload:
 * {
 *   "id": 7988,
 *   "type": "test_event",
 *   "status": "DELIVERED",
 *   "previous_status": "PROCESSING",
 *   "order_code": "DKZ-TEST-RQ5WKR",
 *   "reference": "REF-HETWWVUOTM",
 *   "amount": 10,
 *   "user_id": 4,
 *   "occurred_at": "2026-04-10T21:15:44+00:00",
 *   "test": true,
 *   "metadata": {
 *     "message": "This is a test webhook from Dakazina"
 *   }
 * }
 */
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

  // Extract reference/transaction identifiers
  const reference = body.reference ?? body.order_code ?? body.transaction_id;
  if (!reference || String(reference).trim() === "") {
    console.error("Dakazina webhook: Missing reference/order_code", body);
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const status = body.status;
  if (!status || String(status).trim() === "") {
    console.error("Dakazina webhook: Missing status", body);
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const referenceStr = String(reference).trim();
  const statusStr = String(status).trim().toLowerCase();

  // Log webhook receipt for debugging
  console.log("Dakazina webhook received:", {
    reference: referenceStr,
    status: statusStr,
    order_code: body.order_code,
    type: body.type,
    test: body.test,
    occurred_at: body.occurred_at,
  });

  // Update transactions table
  const transactionPatch: Record<string, unknown> = {
    status: statusStr,
    updated_at: new Date().toISOString(),
  };

  // Add additional fields if available
  if (body.amount) transactionPatch.amount = Number(body.amount);
  if (body.network_id) transactionPatch.network_id = Number(body.network_id);
  if (body.recipient_msisdn) transactionPatch.recipient_msisdn = String(body.recipient_msisdn);
  if (body.bundle_amount) transactionPatch.bundle_amount = String(body.bundle_amount);

  const { data: transactionData, error: transactionError } = await admin
    .from("transactions")
    .update(transactionPatch)
    .eq("transaction_type", "purchase")
    .or(`reference.eq.${referenceStr},transaction_code.eq.${referenceStr}`)
    .select("id, reference, transaction_code");

  if (transactionError) {
    console.error("Dakazina webhook: Transaction update failed", transactionError);
    return NextResponse.json({ error: transactionError.message }, { status: 500 });
  }

  // Update provider_order_overrides table for admin display
  const overridePatch: Record<string, unknown> = {
    status: statusStr,
    updated_at: new Date().toISOString(),
  };

  if (body.metadata) overridePatch.metadata = body.metadata;

  const { data: overrideData, error: overrideError } = await admin
    .from("provider_order_overrides")
    .upsert({
      transaction_id: referenceStr,
      ...overridePatch,
    }, {
      onConflict: "transaction_id",
      ignoreDuplicates: false,
    })
    .select("transaction_id, status");

  if (overrideError) {
    console.error("Dakazina webhook: Override update failed", overrideError);
    // Don't fail the request if override update fails, but log it
  }

  const response = {
    ok: true,
    reference: referenceStr,
    status: statusStr,
    transactions_updated: transactionData?.length || 0,
    overrides_updated: overrideData?.length || 0,
    webhook_id: body.id,
    test: body.test ?? false,
  };

  console.log("Dakazina webhook processed successfully:", response);

  return NextResponse.json(response);
}
