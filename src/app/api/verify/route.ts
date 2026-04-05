import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completePaystackDepositVerification } from "@/lib/paystack-credit";

export const dynamic = "force-dynamic";

/**
 * POST /api/verify  { "reference": "..." }
 * GET  /api/verify?reference=...
 * Same idempotent flow as /api/paystack/verify (payment_events + Paystack verify + claim).
 */
export async function POST(request: NextRequest) {
  let reference: string | undefined;
  try {
    const body = await request.json();
    reference =
      typeof body.reference === "string" ? body.reference.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    success: out.success,
    credited: out.credited ?? false,
    reason: out.reason,
    source: out.source,
    reference: out.reference,
    message: out.message,
  });
}

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

  const out = await completePaystackDepositVerification({
    reference,
    sessionUserId: session.user.id,
  });

  if (!out.ok && out.message === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: out.success,
    credited: out.credited ?? false,
    reason: out.reason,
    source: out.source,
    reference: out.reference,
    message: out.message,
  });
}
