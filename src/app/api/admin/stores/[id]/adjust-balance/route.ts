import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { computeResellerEarningsSummary } from "@/lib/reseller-earnings";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx.response;

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Missing store id" }, { status: 400 });
  }

  let body: { amount?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adjustmentAmount = Number(body.amount);
  if (Number.isNaN(adjustmentAmount) || adjustmentAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const admin = ctx.admin;
  const earnings = await computeResellerEarningsSummary(admin, id);
  if (adjustmentAmount > earnings.availableEarnings) {
    return NextResponse.json(
      { error: "Amount exceeds available store balance" },
      { status: 400 }
    );
  }

  const { error } = await admin.from("earnings_to_wallet_transfers").insert({
    user_id: id,
    amount: adjustmentAmount,
    source: "earnings",
    method: "admin",
    status: "completed",
  });

  if (error) {
    console.error("admin store balance adjustment error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    amount: adjustmentAmount,
    availableAfter: earnings.availableEarnings - adjustmentAmount,
  });
}
