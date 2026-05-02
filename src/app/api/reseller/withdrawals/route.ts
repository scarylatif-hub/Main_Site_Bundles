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
  const { amount, momoNumber, momoName } = body;

  // Validate amount
  const withdrawalAmount = Number(amount);
  if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Calculate total earnings from completed store orders
  const { data: profitData } = await admin
    .from("orders")
    .select("reseller_profit")
    .eq("store_id", user.id)
    .eq("status", "completed");

  let totalEarnings = 0;
  if (profitData) {
    totalEarnings = profitData.reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
  }

  // Calculate already withdrawn amount
  const { data: withdrawnData } = await admin
    .from("earnings_to_wallet_transfers")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .eq("method", "momo");

  let withdrawnAmount = 0;
  if (withdrawnData) {
    withdrawnAmount = withdrawnData.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  }

  // Available earnings = Total earnings - Already withdrawn
  const availableEarnings = totalEarnings - withdrawnAmount;

  if (withdrawalAmount > availableEarnings) {
    return NextResponse.json({ error: "Insufficient available earnings" }, { status: 400 });
  }

  // Validate Mobile Money details
  if (!momoNumber) {
    return NextResponse.json({ error: "Mobile money number required" }, { status: 400 });
  }

  if (!momoName || momoName.trim().length < 2) {
    return NextResponse.json({ error: "Mobile money name required" }, { status: 400 });
  }

  const phoneRegex = /^(0|233)\d{9}$/;
  if (!phoneRegex.test(momoNumber.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Invalid Ghana phone number" }, { status: 400 });
  }

  try {
    // Create withdrawal record
    const withdrawalReference = `WD${Date.now()}`;
    const { data: withdrawal, error: withdrawalError } = await admin
      .from("earnings_to_wallet_transfers")
      .insert({
        user_id: user.id,
        amount: withdrawalAmount,
        method: "momo",
        momo_number: momoNumber,
        momo_name: momoName.trim(),
        status: "pending",
        reference: withdrawalReference,
        account_name: profile.full_name || "",
        source: "earnings",
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("Withdrawal creation error:", withdrawalError);
      return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 });
    }

    // Send ntfy notification for manual processing
    const ntfyMessage = `
NEW WITHDRAWAL REQUEST - MANUAL PROCESSING REQUIRED
==================================================
📱 MTN MOBILE MONEY WITHDRAWAL

💰 Amount: GHS ${withdrawalAmount.toFixed(2)}
👤 MoMo Name: ${momoName.trim()}
📞 MoMo Number: ${momoNumber}
🔗 Reference: ${withdrawalReference}

🏪 Store Details:
Store Owner: ${profile.full_name || "N/A"}
Email: ${profile.email || "N/A"}
Phone: ${profile.phone_number || "N/A"}
Withdrawal ID: ${withdrawal.id}

📊 Earnings Summary:
Total Earnings: GHS ${totalEarnings.toFixed(2)}
Available Earnings: GHS ${availableEarnings.toFixed(2)}
Amount Requested: GHS ${withdrawalAmount.toFixed(2)}

⏰ Created: ${new Date().toISOString()}

🔴 ACTION REQUIRED:
Please manually send GHS ${withdrawalAmount.toFixed(2)} to the MTN MoMo account above and mark this withdrawal as completed in the admin panel.
    `.trim();

    await sendNtfyNotification(
      `🚀 Withdrawal: GHS ${withdrawalAmount.toFixed(2)} - ${momoName.trim()}`,
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
    .from("earnings_to_wallet_transfers")
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
