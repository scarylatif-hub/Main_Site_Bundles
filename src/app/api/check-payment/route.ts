import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  completePaystackDepositVerification,
  hasPaymentEventForReference,
} from "@/lib/paystack-credit";

export const dynamic = "force-dynamic";

/**
 * GET /api/check-payment?reference=...
 * If webhook already stored payment_events, return credited without calling Paystack.
 * Otherwise verify with Paystack and claim (same as /api/verify).
 */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference")?.trim();
  if (!reference) {
    return NextResponse.json({ error: "reference required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await hasPaymentEventForReference(reference)) {
    return NextResponse.json({
      credited: true,
      source: "payment_events",
      reference,
    });
  }

  const out = await completePaystackDepositVerification({
    reference,
    sessionUserId: session.user.id,
  });

  if (!out.ok && out.message === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    credited: Boolean(out.credited),
    success: out.success,
    reason: out.reason,
    source: out.source,
    reference: out.reference,
    message: out.message,
  });
}
