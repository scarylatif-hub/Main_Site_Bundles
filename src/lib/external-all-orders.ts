// src/lib/external-all-orders.ts

import { datakazinaAPI } from "@/lib/datakazina";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";
import { getRetailPriceGhs } from "@/lib/retail-prices";
import { NETWORKS, normalizePhoneNumber } from "@/lib/networks";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminOrderRow = {
  id: string;
  /** Canonical reference (DB); used for overrides / webhooks */
  reference: string | null;
  /** Provider/API order id for admin display */
  provider_order_id: string | null;
  transaction_code: string | null;
  user_id: string;
  created_at: string;
  recipient_msisdn: string | null;
  network_id: number | null;
  /** When API returns a network name string instead of id */
  network_label: string | null;
  bundle_amount: string | null;
  status: string;
  /** Positive amount in GHS (retail price) */
  amount: number;
  customerEmail: string;
  customerName: string;
  /** Whether this order came from a store (vs main site) */
  isStore: boolean;
};

function pick<T extends Record<string, unknown>>(o: T, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
}

function parseNum(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const n = normalizePhoneNumber(String(p).trim());
  return n.length >= 10 ? n : null;
}

/** Resolve display network id from API label (MTN, Telecel, AirtelTigo / AT-iShare, etc.) */
function networkIdFromLabel(name: string | null | undefined): number | null {
  if (!name) return null;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n.includes("mtn")) return 1;
  if (n.includes("telecel")) return 2;
  if (
    n.includes("airtel") ||
    n.includes("tigo") ||
    n.includes("ishare") ||
    n.includes("at-i") ||
    n === "at"
  ) {
    return 3;
  }
  const found = NETWORKS.find((x) => x.name.toLowerCase() === n);
  return found ? found.id : null;
}

function parseGbFromBundleLabel(bundle: string | null): number | null {
  if (!bundle) return null;
  const m = String(bundle).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const g = parseFloat(m[1]);
  return Number.isFinite(g) && g > 0 ? g : null;
}

/** Pull order rows from common provider JSON envelopes. */
function extractOrdersArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const keys = [
    "orders", "data", "results", "items",
    "records", "list", "payload", "content",
  ];
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/**
 * Fetch raw order objects from DataKazina transactions endpoint.
 */
export async function fetchExternalAllOrdersRaw(): Promise<unknown[]> {
  try {
    console.log("external-all-orders: Starting fetch from DataKazina...");
    const result = await datakazinaAPI.fetchTransactions();
    
    console.log("external-all-orders: Fetch result:", {
      ok: result.ok,
      status: result.status,
      hasData: !!result.data,
      dataType: typeof result.data,
      isArray: Array.isArray(result.data),
      rawLength: result.rawText?.length
    });
    
    if (!result.ok || !result.data) {
      console.warn("external-all-orders: DataKazina fetch failed", result.rawText);
      return [];
    }

    const arr = extractOrdersArray(result.data);
    console.log("external-all-orders: Extracted array:", {
      isArray: Array.isArray(arr),
      length: arr?.length,
      sampleItem: arr?.[0]
    });
    
    if (arr) return arr;
    console.warn("external-all-orders: unexpected shape", typeof result.data);
    return [];
  } catch (e) {
    console.error("external-all-orders fetch error", e);
    return [];
  }
}

export function normalizeExternalOrder(
  raw: unknown,
  phoneToProfile: Map<string, { email: string; name: string; id: string }>
): AdminOrderRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const provider_order_id_raw = pick(o, ["id", "order_id", "orderId", "idx"]);
  const provider_order_id =
    provider_order_id_raw != null ? String(provider_order_id_raw) : null;

  const idVal = pick(o, ["id", "order_id", "orderId", "idx", "transaction_id", "transactionId"]);
  const id =
    idVal != null
      ? String(idVal)
      : `ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const codeVal = pick(o, [
    "transaction_id", "transactionId", "transaction_code",
    "transactionCode", "reference", "ref", "order_reference",
  ]);
  const transaction_code = codeVal != null ? String(codeVal) : null;

  const dateVal = pick(o, ["createdAt", "created_at", "date", "order_date", "timestamp"]);
  const created_at =
    dateVal != null
      ? (() => {
          const d = new Date(String(dateVal));
          return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        })()
      : new Date().toISOString();

  const phoneVal = pick(o, [
    "beneficiary_number", "recipient_msisdn", "recipientMsisdn",
    "beneficiary", "phone", "msisdn", "recipient_phone", "recipientPhone", "mobile",
  ]);
  const recipient_msisdn = phoneVal != null ? String(phoneVal).trim() : null;

  const netVal = pick(o, ["network", "network_name", "networkName", "operator", "telco"]);
  const network_label = netVal != null ? String(netVal).trim() : null;
  const rawNet = parseNum(pick(o, ["network_id", "networkId"]));
  let network_id: number | null = null;
  
  console.log("Network mapping debug:", {
    rawNet,
    network_label,
    parsedRawNet: rawNet != null && Number.isFinite(rawNet) ? Math.trunc(rawNet) : null
  });
  
  if (rawNet != null && Number.isFinite(rawNet)) {
    const displayId = datakazinaNetworkIdToDisplay(Math.trunc(rawNet));
    network_id = displayId;
    console.log("Network ID from raw number:", rawNet, "→", displayId);
  } else {
    const labelId = networkIdFromLabel(network_label);
    network_id = labelId;
    console.log("Network ID from label:", network_label, "→", labelId);
  }

  const volVal = pick(o, [
    "bundle_amount", "bundleAmount", "volume", "data_amount",
    "dataAmount", "size", "package", "plan",
  ]);
  const bundle_amount = volVal != null ? String(volVal) : null;

  const sharedGb =
    parseNum(pick(o, ["shared_bundle", "sharedBundle", "SharedBundle"])) ?? null;
  const gbForRetail =
    sharedGb != null && Number.isFinite(sharedGb) && sharedGb > 0
      ? sharedGb
      : parseGbFromBundleLabel(bundle_amount);

  const statusVal = pick(o, ["status", "order_status", "state"]);
  const status = statusVal != null ? String(statusVal) : "unknown";

  let price =
    parseNum(pick(o, ["price", "amount", "total", "cost", "charge", "customer_price"])) ?? 0;

  const retail =
    network_id != null && gbForRetail != null
      ? getRetailPriceGhs(network_id, Math.trunc(gbForRetail))
      : null;
  if (retail != null) {
    price = retail;
  }

  const np = normalizePhone(recipient_msisdn);
  const prof = np ? phoneToProfile.get(np) : undefined;

  return {
    id,
    reference: transaction_code,
    provider_order_id,
    transaction_code,
    user_id: prof?.id ?? "",
    created_at,
    recipient_msisdn,
    network_id,
    network_label,
    bundle_amount,
    status,
    amount: Math.abs(price), // ← positive always; dashboard sums work correctly
    customerEmail: prof?.email ?? "—",
    customerName: prof?.name ?? "",
    isStore: false,
  };
}

export function transactionToAdminRow(
  t: {
    id: string;
    user_id: string;
    reference?: string | null;
    transaction_code: string | null;
    created_at: string;
    recipient_msisdn: string | null;
    network_id: number | null;
    bundle_amount: string | null;
    status: string;
    amount: number;
  },
  emailByUserId: Map<string, { email: string; name: string }>
): AdminOrderRow {
  const c = emailByUserId.get(t.user_id);
  const ref = t.reference ?? t.transaction_code;
  return {
    id: t.id,
    reference: ref,
    provider_order_id: null,
    transaction_code: t.transaction_code,
    user_id: t.user_id,
    created_at: t.created_at,
    recipient_msisdn: t.recipient_msisdn,
    network_id: t.network_id,
    network_label: null,
    bundle_amount: t.bundle_amount,
    status: t.status,
    amount: Math.abs(t.amount), // ← positive always
    customerEmail: c?.email ?? "—",
    customerName: c?.name ?? "",
    isStore: false,
  };
}

/**
 * Convert store orders from the local database to AdminOrderRow format.
 * Store orders have customer_email (which is actually the user's name) and customer_phone fields.
 */
export function storeOrderToAdminRow(
  order: {
    id: string;
    store_id: string;
    package_id: number;
    network_id: number;
    phone_number: string;
    amount: number;
    status: string;
    customer_email: string | null;
    customer_phone: string | null;
    created_at: string;
    paystack_transaction_id: string | null;
  },
  storeName: string
): AdminOrderRow {
  // For store orders, customer_email contains the user's name (from "Your Name (Optional)" field)
  const userName = order.customer_email || "Guest";
  return {
    id: order.id,
    reference: order.paystack_transaction_id,
    provider_order_id: null,
    transaction_code: order.paystack_transaction_id,
    user_id: order.store_id,
    created_at: order.created_at,
    recipient_msisdn: order.customer_phone || order.phone_number,
    // Store orders already have display network IDs, no conversion needed
    network_id: order.network_id,
    network_label: null,
    bundle_amount: null, // Would need to fetch package details
    status: order.status,
    amount: Math.abs(order.amount),
    customerEmail: userName, // User's name (not email for store orders)
    customerName: storeName, // Store name
    isStore: true,
  };
}

/**
 * Index latest status from the provider "all orders" payload by every id the API might use.
 */
export function buildApiOrderStatusLookup(rawOrders: unknown[]): Map<string, string> {
  const m = new Map<string, string>();
  const noProfiles = new Map<string, { email: string; name: string; id: string }>();
  for (const raw of rawOrders) {
    const row = normalizeExternalOrder(raw, noProfiles);
    if (!row) continue;
    const st = String(row.status ?? "").trim() || "unknown";
    for (const k of [
      row.reference,
      row.transaction_code,
      row.provider_order_id,
      row.id,
    ]) {
      const key = k != null ? String(k).trim() : "";
      if (key) m.set(key, st);
    }
  }
  return m;
}

export function buildPhoneProfileMap(
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone_number: string | null;
  }[]
): Map<string, { email: string; name: string; id: string }> {
  const m = new Map<string, { email: string; name: string; id: string }>();
  for (const p of profiles) {
    const key = normalizePhone(p.phone_number);
    if (!key) continue;
    m.set(key, {
      id: p.id,
      email: p.email ?? "—",
      name: p.full_name ?? "",
    });
  }
  return m;
}

type LedgerPurchaseRow = {
  user_id: string;
  reference: string | null;
  transaction_code: string | null;
  recipient_msisdn: string | null;
  created_at: string;
  amount: number;
};

/**
 * When the API beneficiary phone ≠ any `profiles.phone_number`, the customer column
 * shows "—". Fill from ledger purchases (`transactions.user_id` → profile) using
 * provider id / reference overlap, else phone + amount + time (same idea as user orders).
 */
export async function enrichAdminOrderRowsWithLedgerBuyers(
  rows: AdminOrderRow[],
  admin: SupabaseClient
): Promise<void> {
  if (rows.length === 0) return;

  const since = new Date();
  since.setDate(since.getDate() - 150);

  const { data: txs, error: txErr } = await admin
    .from("transactions")
    .select(
      "user_id, reference, transaction_code, recipient_msisdn, created_at, amount"
    )
    .eq("transaction_type", "purchase")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);

  if (txErr) {
    console.error("enrichAdminOrderRowsWithLedgerBuyers:", txErr.message);
    return;
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name");

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { email: (p.email ?? "").trim(), name: (p.full_name ?? "").trim() },
    ])
  );

  const list = (txs ?? []) as LedgerPurchaseRow[];

  function applyFromTx(row: AdminOrderRow, tx: LedgerPurchaseRow): void {
    const p = profileById.get(tx.user_id);
    if (!p?.email) return;
    row.customerEmail = p.email;
    row.customerName = p.name;
    row.user_id = tx.user_id;
  }

  function rowApiKeys(r: AdminOrderRow): string[] {
    const out: string[] = [];
    for (const k of [r.reference, r.transaction_code, r.provider_order_id, r.id]) {
      const s = k != null ? String(k).trim() : "";
      if (s) out.push(s);
    }
    return out;
  }

  function txKeys(tx: LedgerPurchaseRow): string[] {
    const out: string[] = [];
    for (const k of [tx.reference, tx.transaction_code]) {
      const s = k != null ? String(k).trim() : "";
      if (s) out.push(s);
    }
    return out;
  }

  function findTxByKeys(row: AdminOrderRow): LedgerPurchaseRow | undefined {
    const rk = new Set(rowApiKeys(row));
    for (const tx of list) {
      for (const k of txKeys(tx)) {
        if (rk.has(k)) return tx;
      }
    }
    return undefined;
  }

  function findTxByHeuristic(row: AdminOrderRow): LedgerPurchaseRow | undefined {
    const phone = normalizePhone(row.recipient_msisdn);
    if (!phone) return undefined;
    const absAmt = row.amount;
    const tTime = new Date(row.created_at).getTime();
    let best: LedgerPurchaseRow | undefined;
    let bestDelta = Infinity;
    for (const tx of list) {
      const tp = normalizePhone(tx.recipient_msisdn);
      if (tp !== phone) continue;
      if (Math.abs(Math.abs(Number(tx.amount)) - absAmt) > 0.06) continue;
      const d = Math.abs(new Date(tx.created_at).getTime() - tTime);
      if (d < bestDelta) {
        bestDelta = d;
        best = tx;
      }
    }
    return best;
  }

  for (const row of rows) {
    const missing =
      !row.customerEmail ||
      row.customerEmail === "—" ||
      row.customerEmail.trim() === "";
    if (!missing) continue;

    const byKey = findTxByKeys(row);
    if (byKey) {
      applyFromTx(row, byKey);
      continue;
    }
    const byHeur = findTxByHeuristic(row);
    if (byHeur) applyFromTx(row, byHeur);
  }
}