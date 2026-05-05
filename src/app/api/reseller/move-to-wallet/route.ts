import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ntfy configuration
const NTFY_TOPIC = process.env.NTFY_TOPIC || "bundle-ghana-withdrawals";
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

async function sendNtfyNotification(title: string, message: string) {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        "Title": title,
        "Priority": "high",
      },
      body: message,
    });
  } catch (error) {
    console.error("[move-to-wallet] Failed to send ntfy notification:", error);
  }
}

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
  if (isNaN(moveAmount) || moveAmount < 0.01) {
    return NextResponse.json({ error: "Minimum transfer amount is 0.01 GHS" }, { status: 400 });
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

  // Calculate transferred amount from earnings_to_wallet_transfers table
  const { data: transferredData } = await admin
    .from("earnings_to_wallet_transfers")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "completed");

  let transferredAmount = 0;
  if (transferredData) {
    transferredAmount = transferredData.reduce((sum, transfer) => sum + transfer.amount, 0);
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

  // Available earnings = Total earnings - Already transferred - Already withdrawn
  const availableEarnings = totalEarnings - transferredAmount - withdrawnAmount;

  if (moveAmount > availableEarnings) {
    return NextResponse.json({ error: "Insufficient available earnings" }, { status: 400 });
  }

  try {
    // Move amount from available earnings to wallet balance
    const currentWalletBalance = Number(profile.wallet_balance || 0);
    const newWalletBalance = currentWalletBalance + moveAmount;
    
    // Start a transaction to ensure atomicity
    const { error: walletError } = await admin
      .from("profiles")
      .update({ wallet_balance: newWalletBalance })
      .eq("id", user.id);

    if (walletError) {
      console.error("Wallet update error:", walletError);
      return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 });
    }

    // Create a record of the transfer to track deducted earnings
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
      // Rollback wallet update if transfer record fails
      await admin
        .from("profiles")
        .update({ wallet_balance: currentWalletBalance })
        .eq("id", user.id);
      return NextResponse.json({ error: "Failed to record transfer" }, { status: 500 });
    }

    // Get user details for notification
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number, store_name")
      .eq("id", user.id)
      .single();

    // Send ntfy notification for wallet transfer
    const ntfyMessage = `
💰 WALLET TRANSFER - EARNINGS TO WALLET
========================================

📋 Transfer Details:
Amount Transferred: GHS ${moveAmount.toFixed(2)}
Previous Wallet Balance: GHS ${currentWalletBalance.toFixed(2)}
New Wallet Balance: GHS ${newWalletBalance.toFixed(2)}

👤 User Details:
Name: ${profile?.full_name || "N/A"}
Email: ${profile?.email || "N/A"}
Phone: ${profile?.phone_number || "N/A"}
Store: ${profile?.store_name || "N/A"}
User ID: ${user.id}

📊 Earnings Summary:
Lifetime Earnings: GHS ${totalEarnings.toFixed(2)}
Available Before: GHS ${availableEarnings.toFixed(2)}
Available After: GHS ${(availableEarnings - moveAmount).toFixed(2)}

⏰ Completed: ${new Date().toISOString()}
    `.trim();

    await sendNtfyNotification(
      `💰 Wallet Transfer: GHS ${moveAmount.toFixed(2)} - ${profile?.full_name || "Unknown"}`,
      ntfyMessage
    );

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
