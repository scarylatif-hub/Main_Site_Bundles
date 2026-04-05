import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMyPurchaseTransactionsForUser } from "@/lib/data/user-transactions";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/me
 * Logged-in user's purchases (RLS on `transactions`).
 * Each row's `status` is: admin override (if any) → provider all-orders API → DB value.
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
