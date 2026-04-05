// src/lib/data/user-transactions.ts

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Transaction } from "@/lib/definitions";
import {
  buildPhoneProfileMap,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import { normalizePhoneNumber } from "@/lib/networks";

const FETCH_LIMIT = 200;

function isPurchaseRow(t: Transaction): boolean {
  const ty = String(t.transaction_type ?? "").toLowerCase();
  if (ty === "purchase") return true;
  if (ty === "deposit" || ty === "refund") return false;
  const amt = Number(t.amount);
  return Number.isFinite(amt) && amt < 0;
}

/** Same key as admin `AdminOrdersTable` / `overrideKey`. */
function adminOverrideKey(row: AdminOrderRow): string {
  return (
    row.reference ||
    row.transaction_code ||
    row.provider_order_id ||
    row.id
  ).trim();
}

function transactionLookupKeys(t: Transaction): string[] {
  const keys: string[] = [];
  const r = t.reference?.trim();
  const c = t.transaction_code?.trim();
  if (r) keys.push(r);
  if (c && c !== r) keys.push(c);
  keys.push(t.id);
  return [...new Set(keys)];
}

/** Match when DB still has provider id / code, or UUID id lines up. */
function findMatchingApiRowByKeys(
  t: Transaction,
  rows: AdminOrderRow[]
): AdminOrderRow | undefined {
  const tk = new Set(transactionLookupKeys(t).map((x) => x.trim()));
  for (const r of rows) {
    for (const k of [
      r.reference,
      r.transaction_code,
      r.provider_order_id,
      r.id,
    ]) {
      const s = k != null ? String(k).trim() : "";
      if (s && tk.has(s)) return r;
    }
  }
  return undefined;
}

/**
 * When `reference` is still `loc-…`, keys don't match API ids — align by beneficiary,
 * price, network, and closest timestamp (same idea as reconciling to admin list).
 */
function findMatchingApiRowByHeuristic(
  t: Transaction,
  rows: AdminOrderRow[]
): AdminOrderRow | undefined {
  const phone = normalizePhoneNumber(String(t.recipient_msisdn ?? ""));
  if (phone.length < 10) return undefined;

  const absAmt = Math.abs(Number(t.amount));
  if (!Number.isFinite(absAmt)) return undefined;

  const tNet = t.network_id;
  const tTime = new Date(t.created_at).getTime();

  const candidates = rows.filter((r) => {
    const rp = normalizePhoneNumber(String(r.recipient_msisdn ?? ""));
    if (rp !== phone) return false;
    if (Math.abs(absAmt - r.amount) > 0.06) return false;
    if (tNet != null && r.network_id != null && tNet !== r.network_id) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return undefined;

  candidates.sort(
    (a, b) =>
      Math.abs(new Date(a.created_at).getTime() - tTime) -
      Math.abs(new Date(b.created_at).getTime() - tTime)
  );
  return candidates[0];
}

function resolveStatusLikeAdmin(
  t: Transaction,
  externalRows: AdminOrderRow[],
  overrides: Record<string, string>
): string {
  const matched =
    findMatchingApiRowByKeys(t, externalRows) ??
    findMatchingApiRowByHeuristic(t, externalRows);

  if (!matched) return t.status;

  const k = adminOverrideKey(matched);
  return overrides[k] ?? matched.status;
}

/**
 * Purchases for the current session user (RLS).
 * Status matches admin “All orders”: provider row + `provider_order_overrides`,
 * resolving `loc-…` rows to API rows by id when possible, else phone/amount/time.
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

  let externalRows: AdminOrderRow[] = [];
  let overrides: Record<string, string> = {};

  try {
    const admin = createAdminClient();
    const [{ data: profiles }, { data: ovRows }, rawExternal] = await Promise.all([
      admin.from("profiles").select("id,email,full_name,phone_number"),
      admin.from("provider_order_overrides").select("transaction_id,status"),
      fetchExternalAllOrdersRaw(),
    ]);

    const phoneMap = buildPhoneProfileMap(profiles || []);
    for (const raw of rawExternal) {
      const row = normalizeExternalOrder(raw, phoneMap);
      if (row) externalRows.push(row);
    }

    for (const o of ovRows ?? []) {
      const id = o.transaction_id as string | undefined;
      if (id) overrides[id] = String(o.status);
    }
  } catch (e) {
    console.error("fetchMyPurchaseTransactionsForUser: external/overrides", e);
  }

  return purchases.map((t) => ({
    ...t,
    status: resolveStatusLikeAdmin(t, externalRows, overrides),
  }));
}

/** Server Components: resolves the session then loads purchases. */
export async function fetchMyPurchaseTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return fetchMyPurchaseTransactionsForUser(user.id);
}
