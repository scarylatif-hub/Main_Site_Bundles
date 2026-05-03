// src/lib/server/notifications.ts

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOrderStatus } from "@/lib/order-status";
import type { SupabaseClient } from "@supabase/supabase-js";

function ntfyTopic(): string {
  return (process.env.NTFY_TOPIC || "bundle-ghana").trim();
}

function ntfyBaseUrl(): string {
  return (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
}

/** Safely format a number to 2dp — never crashes on undefined/null/NaN */
function safeFormatPrice(amount: unknown): string {
  const n = Number(amount);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

async function ntfyPost(
  topic: string,
  title: string,
  message: string,
  tags: string
): Promise<boolean> {
  const url = `${ntfyBaseUrl()}/${encodeURIComponent(topic)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Title": title,
        "Priority": "high",
        "Tags": tags,
      },
      body: message,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`ntfy error [${res.status}] ${url}:`, t.slice(0, 300));
    } else {
      // Removed notification logging to prevent exposing sensitive data in console
    }
    return res.ok;
  } catch (e) {
    console.error("ntfy fetch failed:", e);
    return false;
  }
}

// ── Public notification helpers ───────────────────────────────────────────────

export async function sendAdminOrderNotification(orderData: {
  orderId: string;
  customerName: string;
  amount: number;
  product: string;
  phoneNumber?: string;
}): Promise<boolean> {
  if (process.env.NTFY_DISABLE === "1" || process.env.NTFY_DISABLE === "true") {
    return true;
  }

  const topic = ntfyTopic();
  const isDeposit = orderData.product === "Wallet Deposit";
  const priceStr = safeFormatPrice(orderData.amount); // ← safe, never crashes

  const title = isDeposit
    ? `New Wallet Deposit: GHS ${priceStr}`
    : `New Order: ${orderData.product}`;

  const message = [
    isDeposit ? "💰 Deposit" : "🛒 Order",
    `Customer: ${orderData.customerName}`,
    `Product: ${orderData.product}`,
    `Amount: GHS ${priceStr}`,
    `ID: ${orderData.orderId}`,
    `Phone: ${orderData.phoneNumber || "N/A"}`,
  ].join("\n");

  const tags = isDeposit ? "dollar,arrow_down" : "moneybag,shopping_cart";

  return ntfyPost(topic, title, message, tags);
}

export async function sendAdminDeliveryNotification(orderData: {
  orderId: string;
  customerName: string;
  product: string;
  beneficiary: string;
}): Promise<boolean> {
  if (process.env.NTFY_DISABLE === "1" || process.env.NTFY_DISABLE === "true") {
    return true;
  }

  const topic = ntfyTopic();
  const title = `✅ Delivered: ${orderData.product}`;
  const message = [
    "📦 Bundle delivered!",
    `Customer: ${orderData.customerName}`,
    `Product: ${orderData.product}`,
    `To: ${orderData.beneficiary}`,
    `ID: ${orderData.orderId}`,
  ].join("\n");
  const tags = "white_check_mark,package";

  return ntfyPost(topic, title, message, tags);
}

/**
 * Called after wallet credit succeeds (first time only).
 * Fixed: was passing `creditAmountGhs` but function expected `amountGhs` — now unified.
 */
export async function notifyAdminWalletDepositCredited(params: {
  userId: string;
  reference: string;
  amountGhs: number;         // ← consistent name, matches all call sites
  creditAmountGhs?: number;  // ← accepts legacy callers that pass this instead
}): Promise<void> {
  try {
    // Resolve amount from whichever field the caller provided
    const amount = Number(params.amountGhs ?? params.creditAmountGhs ?? 0);

    const admin = createAdminClient();
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", params.userId)
      .maybeSingle();

    const customerName =
      (p?.full_name && String(p.full_name).trim()) ||
      (p?.email && String(p.email).trim()) ||
      "Customer";

    await sendAdminOrderNotification({
      orderId: params.reference,
      customerName,
      amount,                  // ← always a real number now
      product: "Wallet Deposit",
      phoneNumber: p?.phone_number ? String(p.phone_number) : undefined,
    });
  } catch (e) {
    console.error("notifyAdminWalletDepositCredited:", e);
  }
}

export async function notifyAdminBundlePurchase(params: {
  userId: string;
  orderId: string;
  amountGhs: number;
  dataAmount: string;
  networkId: number;
  recipientMsisdn: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", params.userId)
      .maybeSingle();

    const customerName =
      (p?.full_name && String(p.full_name).trim()) ||
      (p?.email && String(p.email).trim()) ||
      "Customer";

    const product = `${params.dataAmount} (net ${params.networkId})`;

    await sendAdminOrderNotification({
      orderId: params.orderId,
      customerName,
      amount: params.amountGhs,
      product,
      phoneNumber: params.recipientMsisdn,
    });
  } catch (e) {
    console.error("notifyAdminBundlePurchase:", e);
  }
}

// ── Delivery notification helpers ─────────────────────────────────────────────

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

export async function loadPurchaseRowForDeliveryNotify(
  admin: SupabaseClient,
  transactionLookupKey: string
): Promise<{
  bundle_amount: string | null;
  recipient_msisdn: string | null;
  user_id: string;
} | null> {
  const key = transactionLookupKey.trim();
  if (!key) return null;

  const sel = "bundle_amount, recipient_msisdn, user_id";

  const { data: d1 } = await admin
    .from("transactions")
    .select(sel)
    .eq("reference", key)
    .eq("transaction_type", "purchase")
    .maybeSingle();
  if (d1) return d1;

  const { data: d2 } = await admin
    .from("transactions")
    .select(sel)
    .eq("transaction_code", key)
    .eq("transaction_type", "purchase")
    .maybeSingle();
  if (d2) return d2;

  if (looksLikeUuid(key)) {
    const { data: d3 } = await admin
      .from("transactions")
      .select(sel)
      .eq("id", key)
      .eq("transaction_type", "purchase")
      .maybeSingle();
    if (d3) return d3;
  }

  return null;
}

/** Call when admin sets status to delivered and it was not delivered before. */
export async function notifyAdminOrderDeliveredIfNeeded(params: {
  admin: SupabaseClient;
  transaction_id: string;
  previousStatus: string | null | undefined;
  newStatus: string;
}): Promise<void> {
  const next = normalizeOrderStatus(params.newStatus);
  if (next !== "delivered") return;
  const prev = params.previousStatus
    ? normalizeOrderStatus(params.previousStatus)
    : "";
  if (prev === "delivered") return;

  try {
    const tx = await loadPurchaseRowForDeliveryNotify(
      params.admin,
      params.transaction_id
    );
    if (!tx?.user_id) return;

    const { data: p } = await params.admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", tx.user_id)
      .maybeSingle();

    const customerName =
      (p?.full_name && String(p.full_name).trim()) ||
      (p?.email && String(p.email).trim()) ||
      "Customer";

    await sendAdminDeliveryNotification({
      orderId: params.transaction_id,
      customerName,
      product: tx.bundle_amount || "Data bundle",
      beneficiary: tx.recipient_msisdn || "—",
    });
  } catch (e) {
    console.error("notifyAdminOrderDeliveredIfNeeded:", e);
  }
}