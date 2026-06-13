import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function hashApiKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();
    const apiKey = generateApiKey();
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        api_key_hash: hashApiKey(apiKey),
        is_active: true,
      })
      .select("id, email, name")
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Failed to create client account" }, { status: 400 });
    }

    await admin.from("api_balances").insert({ client_id: client.id, balance: 0 });

    return NextResponse.json({
      ok: true,
      client_id: client.id,
      api_key: apiKey,
      message: "Save this API key once. It will not be shown again.",
    });
  } catch (error) {
    console.error("clients/register error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
