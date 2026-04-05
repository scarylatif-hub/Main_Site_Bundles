import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { id } = await context.params;
  const body = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: prof, error: readErr } = await ctx.admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", id)
    .maybeSingle();

  if (readErr || !prof) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const current = Number(prof.wallet_balance);
  let nextBalance: number;

  const hasAdj =
    body.adjustment !== undefined &&
    body.adjustment !== null &&
    String(body.adjustment).trim() !== "";

  if (hasAdj) {
    const adj = Number(body.adjustment);
    if (Number.isNaN(adj)) {
      return NextResponse.json({ error: "Invalid adjustment" }, { status: 400 });
    }
    nextBalance = Math.max(0, current + adj);
  } else if (body.wallet_balance !== undefined && body.wallet_balance !== null) {
    nextBalance = Number(body.wallet_balance);
    if (Number.isNaN(nextBalance) || nextBalance < 0) {
      return NextResponse.json({ error: "Invalid wallet_balance" }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      { error: "Send wallet_balance (exact) or adjustment (+/−)" },
      { status: 400 }
    );
  }

  const { error } = await ctx.admin
    .from("profiles")
    .update({
      wallet_balance: nextBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("admin wallet update:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, wallet_balance: nextBalance });
}
