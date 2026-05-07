// src/lib/data/user-transactions.ts

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Transaction } from "@/lib/definitions";
import {
  adminOrderRowKeys,
  buildPhoneProfileMap,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  resolveOrderStatusFromSources,
  type AdminOrderRow,
} from "@/lib/external-all-orders";

const FETCH_LIMIT = 200;

function isPurchaseRow(t: Transaction): boolean {
  const ty = String(t.transaction_type ?? "").toLowerCase();
  if (ty === "purchase") return true;
  if (ty === "deposit" || ty === "refund") return false;
  const amt = Number(t.amount);
  return Number.isFinite(amt) && amt < 0;
}

function adminOverrideKey(row: AdminOrderRow): string {
  return adminOrderRowKeys(row)[0] ?? "";
}

function transactionLookupKeys(t: Transaction): string[] {
  const keys: string[] = [];
  const reference = t.reference?.trim();
  const transactionCode = t.transaction_code?.trim();

  if (reference) keys.push(reference);
  if (transactionCode && transactionCode !== reference) keys.push(transactionCode);
  keys.push(t.id);

  return [...new Set(keys)];
}

function resolveStatusLikeAdmin(
  transaction: Transaction,
  externalRows: AdminOrderRow[],
  overrides: Record<string, string>
): string {
  const resolved = resolveOrderStatusFromSources({
    candidateKeys: transactionLookupKeys(transaction),
    createdAt: transaction.created_at,
    recipientMsisdn: transaction.recipient_msisdn,
    amount: Math.abs(Number(transaction.amount || 0)),
    networkId: transaction.network_id,
    fallbackStatus: transaction.status,
    externalRows,
    overrides,
  });

  if (resolved.matchedExternal) {
    const overrideKey = adminOverrideKey(resolved.matchedExternal);
    return overrides[overrideKey] ?? resolved.status;
  }

  return resolved.status;
}

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

  const overrides: Record<string, string> = {};

  try {
    const admin = createAdminClient();
    const { data: ovRows } = await admin
      .from("provider_order_overrides")
      .select("transaction_id,status");

    for (const row of ovRows ?? []) {
      const id = row.transaction_id as string | undefined;
      if (id) overrides[id] = String(row.status);
    }
  } catch (error) {
    console.error("fetchMyPurchaseTransactionsForUser: overrides", error);
  }

  // Status resolution: admin override → database status (no live API calls)
  return purchases.map((transaction) => {
    const overrideKey = transactionLookupKeys(transaction)[0];
    return {
      ...transaction,
      status: overrides[overrideKey] ?? transaction.status,
    };
  });
}

export async function fetchMyPurchaseTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];
  return fetchMyPurchaseTransactionsForUser(user.id);
}
