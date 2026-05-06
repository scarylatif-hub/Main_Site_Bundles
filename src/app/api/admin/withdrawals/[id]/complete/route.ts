import { NextRequest, NextResponse } from "next/server";
import { notifyWithdrawalCompleted } from "@/lib/server/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = createAdminClient();
  const { id: withdrawalId } = await params;

  try {
    const { data: withdrawal, error: fetchError } = await admin
      .from("earnings_to_wallet_transfers")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { error: "Withdrawal already processed" },
        { status: 400 }
      );
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("earnings_to_wallet_transfers")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", withdrawalId);

    if (updateError) {
      console.error("Error completing withdrawal:", updateError);
      return NextResponse.json(
        { error: "Failed to complete withdrawal" },
        { status: 500 }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", withdrawal.user_id)
      .single();

    await notifyWithdrawalCompleted({
      withdrawalId,
      reference: withdrawal.reference,
      amountGhs: Number(withdrawal.amount || 0),
      fullName: profile?.full_name,
      email: profile?.email,
      phoneNumber: profile?.phone_number,
      momoNumber: withdrawal.momo_number,
      momoName: withdrawal.momo_name,
      method: withdrawal.method,
    });

    return NextResponse.json({
      success: true,
      message: "Withdrawal marked as completed successfully",
      withdrawal: {
        ...withdrawal,
        status: "completed",
        completed_at: completedAt,
      },
    });
  } catch (error) {
    console.error("Complete withdrawal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
