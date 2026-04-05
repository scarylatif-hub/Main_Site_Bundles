import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processPaystackChargeFromProvider } from "@/lib/paystack-credit";

/**
 * Shared Paystack webhook handler (POST).
 * Use from /api/webhook/paystack and /api/paystack/webhook.
 */
export async function handlePaystackWebhookPost(
  request: NextRequest
): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret || !signature) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let parsed: { event?: string; data?: Record<string, unknown> };
  try {
    parsed = JSON.parse(body);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  if (parsed.event !== "charge.success") {
    return new NextResponse("OK", { status: 200 });
  }

  const eventData = parsed.data;
  if (!eventData || typeof eventData !== "object") {
    return new NextResponse("OK", { status: 200 });
  }

  const status = String(eventData.status ?? "");
  if (status !== "success") {
    return new NextResponse("OK", { status: 200 });
  }

  const reference =
    eventData.reference != null ? String(eventData.reference) : "";
  if (!reference) {
    console.error("Paystack webhook: missing reference");
    return new NextResponse("OK", { status: 200 });
  }

  const amount = Number(eventData.amount);
  if (!Number.isFinite(amount)) {
    console.error("Paystack webhook: invalid amount", reference);
    return new NextResponse("OK", { status: 200 });
  }

  const metadata = eventData.metadata as
    | Record<string, unknown>
    | undefined;

  const result = await processPaystackChargeFromProvider({
    reference,
    amountPesewas: amount,
    metadata,
  });

  if (result.reason === "rpc_error") {
    return new NextResponse("DB error", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
