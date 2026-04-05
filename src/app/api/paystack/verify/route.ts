import { NextRequest, NextResponse } from "next/server";
import {
  creditWalletFromPaystackSuccess,
  fetchPaystackTransaction,
} from "@/lib/paystack-credit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/paystack/verify?reference=...
 * Verifies with Paystack and credits wallet (idempotent). Used after inline payment + polling.
 */
export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get("reference");
    if (!reference) {
      return NextResponse.json({ error: "reference required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await fetchPaystackTransaction(reference);
    if (!verified.ok) {
      return NextResponse.json(
        { status: "pending", message: verified.message },
        { status: 200 }
      );
    }

    const d = verified.data;
    const metaUserId = d.metadata?.userId;

    if (session && metaUserId && session.user.id !== metaUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await creditWalletFromPaystackSuccess(d);

    return NextResponse.json({
      status: d.status,
      credited: result.credited,
      reason: result.reason,
      reference: d.reference,
    });
  } catch (e) {
    console.error("GET /api/paystack/verify:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
