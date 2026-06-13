import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export type ClientAuthResult = {
  clientId: string;
  userId?: string;
  balance: number;
  source: "main-wallet" | "client-ledger";
};

function sha256Hex(value: string) {
  return require("crypto")
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function authenticateClientApiKey(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const admin = createAdminClient();
  const apiKeyHash = sha256Hex(apiKey);

  const { data, error } = await admin
    .from("clients")
    .select("id, email, is_active")
    .eq("api_key_hash", apiKeyHash)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, wallet_balance, email")
    .eq("email", data.email)
    .maybeSingle();

  if (!profileError && profile) {
    return {
      clientId: data.id,
      userId: profile.id,
      balance: Number(profile.wallet_balance || 0),
      source: "main-wallet",
    } as ClientAuthResult;
  }

  const { data: balanceData, error: balanceError } = await admin
    .from("api_balances")
    .select("balance")
    .eq("client_id", data.id)
    .maybeSingle();

  if (balanceError || !balanceData) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return {
    clientId: data.id,
    balance: Number(balanceData.balance || 0),
    source: "client-ledger",
  } as ClientAuthResult;
}
