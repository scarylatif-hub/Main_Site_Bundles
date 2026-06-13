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
  const { error } = await admin.rpc("credit_client_balance", {
    p_client_id: auth.clientId,
    p_amount: amount,
    p_reference: reference,
    p_type: "deposit",
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Deposit failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, balance: auth.balance + amount });
}
