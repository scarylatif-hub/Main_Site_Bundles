import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateClientApiKey } from "@/lib/client-api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateClientApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const amount = Number(body?.amount || 0);
  const reference = String(body?.reference || "");

  if (!amount || amount <= 0 || !reference) {
    return NextResponse.json({ error: "Invalid deposit request" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (auth.userId) {
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", auth.userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 500 });
    }

    const balanceBefore = Number(profile.wallet_balance || 0);
    const balanceAfter = balanceBefore + amount;

    const { error: walletErr } = await admin
      .from("profiles")
      .update({ wallet_balance: balanceAfter, updated_at: new Date().toISOString() })
      .eq("id", auth.userId);

    if (walletErr) {
      return NextResponse.json({ error: walletErr.message || "Deposit failed" }, { status: 500 });
    }

    const { error: txErr } = await admin.from("transactions").insert({
      user_id: auth.userId,
      transaction_code: reference,
      status: "completed",
      transaction_type: "deposit",
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `API deposit (${reference})`,
      reference,
    });

    if (txErr) {
      console.error("clients/deposit transaction insert failed", txErr);
      return NextResponse.json({ error: "Deposit recorded, but transaction log failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, balance: balanceAfter, source: "main-wallet" });
  }

  const { error } = await admin.rpc("credit_client_balance", {
    p_client_id: auth.clientId,
    p_amount: amount,
    p_reference: reference,
    p_type: "deposit",
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Deposit failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, balance: auth.balance + amount, source: "client-ledger" });
}
