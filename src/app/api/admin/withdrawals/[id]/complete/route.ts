import { NextRequest, NextResponse } from "next/server";
import { notifyWithdrawalCompleted } from "@/lib/server/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { id: withdrawalId } = await params;

  try {
    const { data: actingProfile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!actingProfile?.is_admin) {
      return NextResponse.json({ error: "Not an admin" }, { status: 403 });
    }

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
        // Keep this aligned with the PATCH endpoint columns.
        processed_at: completedAt,
        processed_by: user.id,
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

    try {
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
        userId: withdrawal.user_id,
      });
    } catch (notifyError) {
      console.error("Withdrawal completion notify failed:", notifyError);
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal marked as completed successfully",
      withdrawal: {
        ...withdrawal,
        status: "completed",
        processed_at: completedAt,
      },
    });
  } catch (error) {
    console.error("Complete withdrawal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
