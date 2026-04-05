import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Transaction } from "@/lib/definitions";
import {
  buildApiOrderStatusLookup,
  fetchExternalAllOrdersRaw,
} from "@/lib/external-all-orders";

const FETCH_LIMIT = 200;

function isPurchaseRow(t: Transaction): boolean {
  const ty = String(t.transaction_type ?? "").toLowerCase();
  if (ty === "purchase") return true;
  if (ty === "deposit" || ty === "refund") return false;
  const amt = Number(t.amount);
  return Number.isFinite(amt) && amt < 0;
}

/** Same resolution order as admin `overrideKey` where we have DB fields (reference, code, row id). */
function transactionLookupKeys(t: Transaction): string[] {
  const keys: string[] = [];
  const r = t.reference?.trim();
  const c = t.transaction_code?.trim();
  if (r) keys.push(r);
  if (c && c !== r) keys.push(c);
  keys.push(t.id);
  return [...new Set(keys)];
}

async function fetchOverridesForKeys(
  keys: string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("provider_order_overrides")
    .select("transaction_id, status")
    .in("transaction_id", keys);

  if (error) {
    console.error("fetchOverridesForKeys:", error.message);
    return {};
  }

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const id = row.transaction_id as string | undefined;
    if (id) out[id] = String(row.status);
  }
  return out;
}

function pickFirstStatus(
  t: Transaction,
  byKey: Record<string, string> | Map<string, string>
): string | undefined {
  for (const k of transactionLookupKeys(t)) {
    const v = byKey instanceof Map ? byKey.get(k) : byKey[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

/**
 * Purchases for the current session user (`userId` must match the JWT; RLS enforces).
 *
 * Status shown:
 * 1) Admin override (`provider_order_overrides`) if any key matches this transaction.
 * 2) Else status from the provider “all orders” API (same payload as admin list).
 * 3) Else `transactions.status` from the database.
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
  const purchases = rows.filter(isPurchaseRow);

  let apiByKey = new Map<string, string>();
  try {
    const rawOrders = await fetchExternalAllOrdersRaw();
    apiByKey = buildApiOrderStatusLookup(rawOrders);
  } catch (e) {
    console.error("fetchMyPurchaseTransactionsForUser: external orders", e);
  }

  const allKeys = new Set<string>();
  for (const t of purchases) {
    for (const k of transactionLookupKeys(t)) allKeys.add(k);
  }

  const overrides = await fetchOverridesForKeys([...allKeys]);

  return purchases.map((t) => {
    const fromAdmin = pickFirstStatus(t, overrides);
    const fromApi = pickFirstStatus(t, apiByKey);
    const status = fromAdmin ?? fromApi ?? t.status;
    return { ...t, status };
  });
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
