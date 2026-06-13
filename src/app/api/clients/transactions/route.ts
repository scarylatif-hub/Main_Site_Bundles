import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateClientApiKey } from "@/lib/client-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateClientApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const from = (page - 1) * pageSize;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("balance_transactions")
    .select("id, amount, type, reference, bundle_id, created_at")
    .eq("client_id", auth.clientId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load transactions" }, { status: 500 });
  }

  return NextResponse.json({ items: data || [], page, pageSize });
}
