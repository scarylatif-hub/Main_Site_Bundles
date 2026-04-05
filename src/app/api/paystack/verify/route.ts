import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completePaystackDepositVerification } from "@/lib/paystack-credit";

export const dynamic = "force-dynamic";

/**
 * GET /api/paystack/verify?reference=...
 * Idempotent: payment_events + Paystack verify + claim_paystack_deposit (same as /api/verify).
 */
export async function GET(request: NextRequest) {
  try {
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

    const out = await completePaystackDepositVerification({
      reference,
      sessionUserId: session.user.id,
    });

    if (!out.ok && out.message === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      status: out.success ? "success" : "pending",
      success: out.success,
      credited: Boolean(out.credited),
      reason: out.reason,
      source: out.source,
      reference: out.reference ?? reference,
      message: out.message,
    });
  } catch (e) {
    console.error("GET /api/paystack/verify:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
