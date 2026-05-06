import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check if user is admin
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Not an admin" }, { status: 403 });
  }

  // Get all withdrawals with user info
  const { data: withdrawals, error } = await admin
    .from("earnings_to_wallet_transfers")
    .select(`
      *,
      profiles:user_id (
        full_name,
        email,
        phone_number
      )
    `)
    .eq("source", "earnings")
    .eq("method", "momo")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Withdrawals fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }

  return NextResponse.json({ withdrawals });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check if user is admin
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Not an admin" }, { status: 403 });
  }

  const body = await req.json();
  const { withdrawalId, status, reference } = body;

  if (!withdrawalId || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["completed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    // Get withdrawal details
    const { data: withdrawal, error: fetchError } = await admin
      .from("earnings_to_wallet_transfers")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json({ error: "Withdrawal already processed" }, { status: 400 });
    }

    // Update withdrawal status
    const { error: updateError } = await admin
      .from("earnings_to_wallet_transfers")
      .update({ 
        status,
        reference: reference || null,
        processed_at: new Date().toISOString(),
        processed_by: user.id,
      })
      .eq("id", withdrawalId);

    if (updateError) {
      console.error("Withdrawal update error:", updateError);
      return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${status} successfully`
    });

  } catch (error) {
    console.error("Withdrawal processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
