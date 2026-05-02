import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get user profile
  const { data: profile } = await admin
    .from("profiles")
    .select("is_reseller, wallet_balance")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const body = await req.json();
  const { amount } = body;

  // Validate amount
  const moveAmount = Number(amount);
  if (isNaN(moveAmount) || moveAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Calculate total earnings from completed orders
  const { data: profitData } = await admin
    .from("orders")
    .select("reseller_profit")
    .eq("store_id", user.id)
    .eq("status", "completed");

  let totalEarnings = 0;
  if (profitData) {
    totalEarnings = profitData.reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
  }

  // Calculate withdrawn amount from withdrawals table
  const { data: withdrawnData } = await admin
    .from("withdrawals")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "pending");

  let withdrawnAmount = 0;
  if (withdrawnData) {
    withdrawnAmount = withdrawnData.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  }

  // Available earnings = Total earnings - Already withdrawn
  const availableEarnings = totalEarnings - withdrawnAmount;

  if (moveAmount > availableEarnings) {
    return NextResponse.json({ error: "Insufficient available earnings" }, { status: 400 });
  }

  try {
    // Move amount from available earnings to wallet balance
    const currentWalletBalance = Number(profile.wallet_balance || 0);
    const newWalletBalance = currentWalletBalance + moveAmount;
    
    // Update wallet balance
    const { error: walletError } = await admin
      .from("profiles")
      .update({ wallet_balance: newWalletBalance })
      .eq("id", user.id);

    if (walletError) {
      console.error("Wallet update error:", walletError);
      return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 });
    }

    // Create a record of the transfer (optional, for tracking)
    const { error: transferError } = await admin
      .from("earnings_to_wallet_transfers")
      .insert({
        user_id: user.id,
        amount: moveAmount,
        source: "earnings",
        status: "completed",
      });

    if (transferError) {
      console.error("Transfer record error:", transferError);
      // Don't fail the request since wallet was updated successfully
    }

    return NextResponse.json({
      success: true,
      message: `GHS ${moveAmount.toFixed(2)} moved to wallet balance successfully`,
      newWalletBalance: newWalletBalance,
    });

  } catch (error) {
    console.error("Move to wallet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
