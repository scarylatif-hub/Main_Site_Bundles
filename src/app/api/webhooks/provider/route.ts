import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/provider
 * Updates a purchase row by `reference` or `transaction_code` using the service role.
 * Configure PROVIDER_WEBHOOK_SECRET and send the same value in header
 * `X-Webhook-Secret` or `X-Provider-Signature`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PROVIDER_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const headerSecret =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("x-provider-signature")?.trim();

  if (!headerSecret || headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const referenceRaw =
    body.reference ??
    body.transaction_id ??
    body.transactionId ??
    body.transaction_code ??
    body.transactionCode;
  const reference =
    referenceRaw != null && String(referenceRaw).trim() !== ""
      ? String(referenceRaw).trim()
      : null;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const statusRaw = body.status ?? body.order_status ?? body.state;
  if (statusRaw == null || String(statusRaw).trim() === "") {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }
  const status = String(statusRaw).trim().toLowerCase();

  const patch: Record<string, unknown> = { status };

  const vol =
    body.volume ?? body.bundle_amount ?? body.data_amount;
  if (vol != null) patch.bundle_amount = String(vol);

  const ben =
    body.beneficiary_number ?? body.recipient_msisdn ?? body.beneficiary;
  if (ben != null) patch.recipient_msisdn = String(ben);

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("transactions")
    .update(patch)
    .eq("transaction_type", "purchase")
    .or(`reference.eq.${reference},transaction_code.eq.${reference}`)
    .select("id");

  if (error) {
    console.error("provider webhook update:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({ error: "No matching transaction" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, updated: data.length });
}
