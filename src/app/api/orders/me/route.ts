import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMyPurchaseTransactionsForUser } from "@/lib/data/user-transactions";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/me
 * Logged-in user's purchases — data comes only from Supabase (anon + session, RLS).
 * The external provider is not queried for listing or history.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await fetchMyPurchaseTransactionsForUser(user.id);
  return NextResponse.json(rows);
}
