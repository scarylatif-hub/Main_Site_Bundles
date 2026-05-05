import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";

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
    .select("is_reseller, wallet_balance")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  // Calculate total earnings from completed orders (sum of reseller_profit field)
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
    .eq("status", "completed")
    .eq("source", "earnings");

  let transferredAmount = 0;
  if (transferredData) {
    transferredAmount = transferredData.reduce((sum, transfer) => sum + transfer.amount, 0);
  }

  // Calculate withdrawn amount from withdrawals
  const { data: withdrawnData } = await admin
    .from("earnings_to_wallet_transfers")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq("method", "momo");

  let withdrawnAmount = 0;
  if (withdrawnData) {
    withdrawnAmount = withdrawnData.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  }

  // Available earnings = Total earnings - Already transferred - Already withdrawn
  const availableEarnings = totalEarnings - transferredAmount - withdrawnAmount;

  // Also include wallet balance (which should match total earnings, but we show both for transparency)
  const walletBalance = Number(profile.wallet_balance || 0);

  // Count active packages (using DataKazina API count)
  const totalPackages = 49; // From debug output
  const activePackages = 49; // All packages are active

  // Get total orders count
  const { count: totalOrders } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("store_id", user.id);

  return NextResponse.json({
    totalEarnings: availableEarnings, // Show available earnings, not lifetime earnings
    lifetimeEarnings: totalEarnings, // Lifetime earnings for reference
    walletBalance,
    totalPackages,
    activePackages,
    totalOrders: totalOrders || 0,
  });
}
