import { createClient } from "@/lib/supabase/server";
import { statusForCustomer } from "@/lib/order-status";
import type { Transaction } from "@/lib/definitions";

const FETCH_LIMIT = 200;

function isPurchaseRow(t: Transaction): boolean {
  const ty = String(t.transaction_type ?? "").toLowerCase();
  if (ty === "purchase") return true;
  if (ty === "deposit" || ty === "refund") return false;
  const amt = Number(t.amount);
  return Number.isFinite(amt) && amt < 0;
}

/**
 * Purchases for the current session user (`userId` must match the JWT; RLS enforces).
 * No service role — Supabase is the source of truth for order history.
 */
export async function fetchMyPurchaseTransactionsForUser(
  userId: string
): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    console.error("fetchMyPurchaseTransactionsForUser:", error.message);
    return [];
  }

  const rows = (data ?? []) as Transaction[];
  return rows
    .filter(isPurchaseRow)
    .map((t) => ({
      ...t,
      status: statusForCustomer(t.status),
    }));
}

/** Server Components: resolves the session then loads purchases from Supabase (RLS). */
export async function fetchMyPurchaseTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchMyPurchaseTransactionsForUser(user.id);
}
