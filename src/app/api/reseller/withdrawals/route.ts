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
    console.log("[withdrawals] ntfy notification sent:", title);
  } catch (error) {
    console.error("[withdrawals] Failed to send ntfy notification:", error);
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
    .select("is_reseller, wallet_balance, full_name, email, phone_number")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const body = await req.json();
  const { amount, momoNumber } = body;

  // Validate amount
  const withdrawalAmount = Number(amount);
  if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Check wallet balance
  const currentBalance = Number(profile.wallet_balance || 0);
  if (withdrawalAmount > currentBalance) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Validate Mobile Money number
  if (!momoNumber) {
    return NextResponse.json({ error: "Mobile money number required" }, { status: 400 });
  }

  const phoneRegex = /^(0|233)\d{9}$/;
  if (!phoneRegex.test(momoNumber.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Invalid Ghana phone number" }, { status: 400 });
  }

  try {
    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await admin
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount: withdrawalAmount,
        method: "momo",
        momo_number: momoNumber,
        status: "pending",
        account_name: profile.full_name || "",
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("Withdrawal creation error:", withdrawalError);
      return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 });
    }

    // Deduct from wallet immediately
    const newBalance = currentBalance - withdrawalAmount;
    const { error: updateError } = await admin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", user.id);

    if (updateError) {
      console.error("Wallet update error:", updateError);
      return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 });
    }

    // Send ntfy notification for manual processing
    const ntfyMessage = `
New Withdrawal Request - ACTION REQUIRED
-----------------------------------------
Amount: GHS ${withdrawalAmount.toFixed(2)}
Mobile Money Number: ${momoNumber}
Store Owner: ${profile.full_name || "N/A"}
Email: ${profile.email || "N/A"}
Phone: ${profile.phone_number || "N/A"}
Withdrawal ID: ${withdrawal.id}
Created: ${new Date().toISOString()}

Please manually send the money to the provided Mobile Money number and mark this withdrawal as completed in the admin panel.
    `.trim();

    await sendNtfyNotification(
      `Withdrawal Request: GHS ${withdrawalAmount.toFixed(2)}`,
      ntfyMessage
    );

    return NextResponse.json({
      success: true,
      withdrawal,
      message: "Withdrawal request submitted successfully. Money will be sent manually."
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get user profile
  const { data: profile } = await admin
    .from("profiles")
    .select("is_reseller")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  // Get withdrawal history
  const { data: withdrawals, error } = await admin
    .from("withdrawals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Withdrawal history error:", error);
    return NextResponse.json({ error: "Failed to fetch withdrawal history" }, { status: 500 });
  }

  return NextResponse.json({ withdrawals });
}
