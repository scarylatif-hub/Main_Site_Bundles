import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateClientApiKey } from "@/lib/client-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateClientApiKey(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.userId) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("wallet_balance, id")
      .eq("id", auth.userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
    }

    return NextResponse.json({
      client_id: auth.clientId,
      user_id: data.id,
      balance: Number(data.wallet_balance || 0),
      source: "main-wallet",
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_balances")
    .select("balance")
    .eq("client_id", auth.clientId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
  }

  return NextResponse.json({ client_id: auth.clientId, balance: Number(data.balance || 0), source: "client-ledger" });
}
