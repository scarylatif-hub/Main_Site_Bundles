import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWithdrawalRequested } from "@/lib/server/notifications";
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
    .select("is_reseller, wallet_balance, full_name, email, phone_number")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const body = await req.json();
  const { amount, momoNumber, momoName } = body;

  const withdrawalAmount = Number(amount);
  if (isNaN(withdrawalAmount) || withdrawalAmount < 0.01) {
    return NextResponse.json(
      { error: "Minimum withdrawal amount is 0.01 GHS" },
      { status: 400 }
    );
  }

  const earnings = await computeResellerEarningsSummary(admin, user.id);
  const totalEarnings = earnings.lifetimeEarnings;
  const availableEarnings = earnings.availableEarnings;

  if (withdrawalAmount > availableEarnings) {
    return NextResponse.json(
      { error: "Insufficient available earnings" },
      { status: 400 }
    );
  }

  if (!momoNumber) {
    return NextResponse.json(
      { error: "Mobile money number required" },
      { status: 400 }
    );
  }

  if (!momoName || momoName.trim().length < 2) {
    return NextResponse.json(
      { error: "Mobile money name required" },
      { status: 400 }
    );
  }

  const phoneRegex = /^(0|233)\d{9}$/;
  if (!phoneRegex.test(momoNumber.replace(/\s/g, ""))) {
    return NextResponse.json(
      { error: "Invalid Ghana phone number" },
      { status: 400 }
    );
  }

  try {
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
      return NextResponse.json(
        { error: "Failed to create withdrawal request" },
        { status: 500 }
      );
    }

    await notifyWithdrawalRequested({
      withdrawalId: withdrawal.id,
      reference: withdrawalReference,
      userId: user.id,
      fullName: profile.full_name,
      email: profile.email,
      phoneNumber: profile.phone_number,
      momoNumber,
      momoName: momoName.trim(),
      amountGhs: withdrawalAmount,
      lifetimeEarningsGhs: totalEarnings,
      availableBeforeGhs: availableEarnings,
      availableAfterGhs: availableEarnings - withdrawalAmount,
    });

    return NextResponse.json({
      success: true,
      withdrawal,
      message: "Withdrawal request submitted successfully. Money will be sent manually.",
    });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
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
    .select("is_reseller")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const { data: withdrawals, error } = await admin
    .from("earnings_to_wallet_transfers")
    .select("*")
    .eq("user_id", user.id)
    .eq("source", "earnings")
    .eq("method", "momo")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Withdrawal history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch withdrawal history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ withdrawals });
}
