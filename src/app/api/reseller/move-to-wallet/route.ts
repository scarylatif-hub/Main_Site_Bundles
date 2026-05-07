import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEarningsTransferredToWallet } from "@/lib/server/notifications";
import { createClient } from "@/lib/supabase/server";
import { computeResellerEarningsSummary } from "@/lib/reseller-earnings";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

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

  const moveAmount = Number(amount);
  if (isNaN(moveAmount) || moveAmount < 0.01) {
    return NextResponse.json(
      { error: "Minimum transfer amount is 0.01 GHS" },
      { status: 400 }
    );
  }

  const earnings = await computeResellerEarningsSummary(admin, user.id);
  const totalEarnings = earnings.lifetimeEarnings;
  const availableEarnings = earnings.availableEarnings;

  if (moveAmount > availableEarnings) {
    return NextResponse.json(
      { error: "Insufficient available earnings" },
      { status: 400 }
    );
  }

  try {
    const currentWalletBalance = Number(profile.wallet_balance || 0);
    const newWalletBalance = currentWalletBalance + moveAmount;

    const { error: walletError } = await admin
      .from("profiles")
      .update({ wallet_balance: newWalletBalance })
      .eq("id", user.id);

    if (walletError) {
      console.error("Wallet update error:", walletError);
      return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 });
    }

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
      await admin
        .from("profiles")
        .update({ wallet_balance: currentWalletBalance })
        .eq("id", user.id);
      return NextResponse.json({ error: "Failed to record transfer" }, { status: 500 });
    }

    const { data: profileDetails } = await admin
      .from("profiles")
      .select("full_name, email, phone_number, store_name")
      .eq("id", user.id)
      .single();

    await notifyEarningsTransferredToWallet({
      userId: user.id,
      fullName: profileDetails?.full_name,
      email: profileDetails?.email,
      phoneNumber: profileDetails?.phone_number,
      storeName: profileDetails?.store_name,
      amountGhs: moveAmount,
      previousWalletBalanceGhs: currentWalletBalance,
      newWalletBalanceGhs: newWalletBalance,
      lifetimeEarningsGhs: totalEarnings,
      availableBeforeGhs: availableEarnings,
      availableAfterGhs: availableEarnings - moveAmount,
    });

    return NextResponse.json({
      success: true,
      message: `GHS ${moveAmount.toFixed(2)} moved to wallet balance successfully`,
      newWalletBalance,
    });
  } catch (error) {
    console.error("Move to wallet error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
