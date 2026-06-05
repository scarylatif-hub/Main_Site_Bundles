// src/lib/server/notifications.ts

import { normalizeOrderStatus } from "@/lib/order-status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const rawVapidEmail = process.env.VAPID_EMAIL || "mailto:admin@sbbundles.com";
const vapidEmail = rawVapidEmail.startsWith("mailto:")
  ? rawVapidEmail
  : `mailto:${rawVapidEmail}`;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function sendWebPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping web push");
    return;
  }

  try {
    const admin = createAdminClient();
    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching push subscriptions:", error);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payloadString = JSON.stringify(payload);

    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadString);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("Cleaning up expired push subscription:", sub.id);
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Error sending push notification:", err);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error("Failed to dispatch push notifications:", err);
  }
}


function ntfyTopic(): string {
  return (process.env.NTFY_TOPIC || "bundle-ghana").trim();
}

function ntfyBaseUrl(): string {
  return (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
}

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
        Title: title,
        Priority: "high",
        Tags: tags,
      },
      body: message,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`ntfy error [${res.status}] ${url}:`, text.slice(0, 300));
    }

    return res.ok;
  } catch (error) {
    console.error("ntfy fetch failed:", error);
    return false;
  }
}

export async function sendNtfyNotification(params: {
  title: string;
  message: string;
  tags?: string;
  topic?: string;
}): Promise<boolean> {
  if (process.env.NTFY_DISABLE === "1" || process.env.NTFY_DISABLE === "true") {
    return true;
  }

  return ntfyPost(
    params.topic || ntfyTopic(),
    params.title,
    params.message,
    params.tags || "bell"
  );
}

export async function sendAdminOrderNotification(orderData: {
  orderId: string;
  customerName: string;
  amount: number;
  product: string;
  phoneNumber?: string;
}): Promise<boolean> {
  const isDeposit = orderData.product === "Wallet Deposit";
  const priceStr = safeFormatPrice(orderData.amount);

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

  return sendNtfyNotification({
    title,
    message,
    tags: isDeposit ? "dollar,arrow_down" : "moneybag,shopping_cart",
  });
}

export async function sendAdminDeliveryNotification(orderData: {
  orderId: string;
  customerName: string;
  product: string;
  beneficiary: string;
}): Promise<boolean> {
  const title = `Delivered: ${orderData.product}`;
  const message = [
    "📦 Bundle delivered",
    `Customer: ${orderData.customerName}`,
    `Product: ${orderData.product}`,
    `To: ${orderData.beneficiary}`,
    `ID: ${orderData.orderId}`,
  ].join("\n");

  return sendNtfyNotification({
    title,
    message,
    tags: "white_check_mark,package",
  });
}

export async function notifyAdminWalletDepositCredited(params: {
  userId: string;
  reference: string;
  amountGhs: number;
  creditAmountGhs?: number;
}): Promise<void> {
  try {
    const amount = Number(params.amountGhs ?? params.creditAmountGhs ?? 0);
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", params.userId)
      .maybeSingle();

    const customerName =
      (profile?.full_name && String(profile.full_name).trim()) ||
      (profile?.email && String(profile.email).trim()) ||
      "Customer";

    await sendAdminOrderNotification({
      orderId: params.reference,
      customerName,
      amount,
      product: "Wallet Deposit",
      phoneNumber: profile?.phone_number ? String(profile.phone_number) : undefined,
    });

    // Notify user via Web Push
    await sendWebPushNotification(params.userId, {
      title: "Wallet Funded! 💰",
      body: `Your wallet has been credited with GHS ${amount.toFixed(2)}.`,
      url: "/wallet",
    });
  } catch (error) {
    console.error("notifyAdminWalletDepositCredited:", error);
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
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", params.userId)
      .maybeSingle();

    const customerName =
      (profile?.full_name && String(profile.full_name).trim()) ||
      (profile?.email && String(profile.email).trim()) ||
      "Customer";

    await sendAdminOrderNotification({
      orderId: params.orderId,
      customerName,
      amount: params.amountGhs,
      product: `${params.dataAmount} (net ${params.networkId})`,
      phoneNumber: params.recipientMsisdn,
    });

    // Notify user via Web Push
    await sendWebPushNotification(params.userId, {
      title: "Order Received! 🛒",
      body: `Your order for ${params.dataAmount} data to ${params.recipientMsisdn} has been submitted.`,
      url: "/orders",
    });
  } catch (error) {
    console.error("notifyAdminBundlePurchase:", error);
  }
}

export async function notifyStoreCreationRequested(params: {
  userId: string;
  storeName: string;
  storeSlug: string;
  resellerName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}): Promise<boolean> {
  const storeDomain = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";

  return sendNtfyNotification({
    title: `Store Created: ${params.storeName}`,
    message: [
      "🏪 New store creation request",
      `Store: ${params.storeName}`,
      `Slug: ${params.storeSlug}`,
      `URL: https://${storeDomain}/store/${params.storeSlug}`,
      `Owner: ${params.resellerName || "N/A"}`,
      `Email: ${params.email || "N/A"}`,
      `Phone: ${params.phoneNumber || "N/A"}`,
      `User ID: ${params.userId}`,
      "Status: Pending approval",
      "Default profit margin: 5%",
      `Created: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "store,shopping_cart,new",
  });
}

export async function notifyStoreOrderCompleted(params: {
  storeId: string;
  orderId: string;
  customerPhone: string;
  packageLabel: string;
  amountGhs: number;
  transactionCode: string;
  storeProfitGhs: number;
}): Promise<boolean> {
  return sendNtfyNotification({
    title: `Store Order: GHS ${safeFormatPrice(params.amountGhs)}`,
    message: [
      "🛒 Store order completed",
      `Store ID: ${params.storeId}`,
      `Order ID: ${params.orderId}`,
      `Customer Phone: ${params.customerPhone}`,
      `Package: ${params.packageLabel}`,
      `Amount Paid: GHS ${safeFormatPrice(params.amountGhs)}`,
      `Store Profit: GHS ${safeFormatPrice(params.storeProfitGhs)}`,
      `Transaction Code: ${params.transactionCode}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "shopping_cart,white_check_mark,moneybag",
  });
}

export async function notifyEarningsTransferredToWallet(params: {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  storeName?: string | null;
  amountGhs: number;
  previousWalletBalanceGhs: number;
  newWalletBalanceGhs: number;
  lifetimeEarningsGhs: number;
  availableBeforeGhs: number;
  availableAfterGhs: number;
}): Promise<boolean> {
  return sendNtfyNotification({
    title: `Earnings Transfer: GHS ${safeFormatPrice(params.amountGhs)}`,
    message: [
      "💰 Earnings moved to wallet",
      `Amount: GHS ${safeFormatPrice(params.amountGhs)}`,
      `Wallet Before: GHS ${safeFormatPrice(params.previousWalletBalanceGhs)}`,
      `Wallet After: GHS ${safeFormatPrice(params.newWalletBalanceGhs)}`,
      `Owner: ${params.fullName || "N/A"}`,
      `Store: ${params.storeName || "N/A"}`,
      `Email: ${params.email || "N/A"}`,
      `Phone: ${params.phoneNumber || "N/A"}`,
      `User ID: ${params.userId}`,
      `Lifetime Earnings: GHS ${safeFormatPrice(params.lifetimeEarningsGhs)}`,
      `Available Before: GHS ${safeFormatPrice(params.availableBeforeGhs)}`,
      `Available After: GHS ${safeFormatPrice(params.availableAfterGhs)}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "moneybag,arrow_right,bank",
  });
}

export async function notifyWithdrawalRequested(params: {
  withdrawalId: string;
  reference: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  momoNumber: string;
  momoName: string;
  amountGhs: number;
  lifetimeEarningsGhs: number;
  availableBeforeGhs: number;
  availableAfterGhs: number;
}): Promise<boolean> {
  return sendNtfyNotification({
    title: `Withdrawal Request: GHS ${safeFormatPrice(params.amountGhs)}`,
    message: [
      "🚨 Withdrawal request submitted",
      `Amount: GHS ${safeFormatPrice(params.amountGhs)}`,
      `Reference: ${params.reference}`,
      `Withdrawal ID: ${params.withdrawalId}`,
      `MoMo Name: ${params.momoName}`,
      `MoMo Number: ${params.momoNumber}`,
      `Owner: ${params.fullName || "N/A"}`,
      `Email: ${params.email || "N/A"}`,
      `Phone: ${params.phoneNumber || "N/A"}`,
      `User ID: ${params.userId}`,
      `Lifetime Earnings: GHS ${safeFormatPrice(params.lifetimeEarningsGhs)}`,
      `Available Before: GHS ${safeFormatPrice(params.availableBeforeGhs)}`,
      `Available After: GHS ${safeFormatPrice(params.availableAfterGhs)}`,
      `Requested: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "warning,money_with_wings,iphone",
  });
}

export async function notifyWithdrawalCompleted(params: {
  withdrawalId: string;
  reference?: string | null;
  amountGhs: number;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  momoNumber?: string | null;
  momoName?: string | null;
  method?: string | null;
  userId?: string;
}): Promise<boolean> {
  if (params.userId) {
    void sendWebPushNotification(params.userId, {
      title: "Withdrawal Completed! ✅",
      body: `Your withdrawal of GHS ${safeFormatPrice(params.amountGhs)} has been processed to ${params.momoNumber || 'your mobile money account'}.`,
      url: "/reseller/dashboard",
    });
  }

  return sendNtfyNotification({
    title: `Withdrawal Completed: GHS ${safeFormatPrice(params.amountGhs)}`,
    message: [
      "✅ Withdrawal completed",
      `Withdrawal ID: ${params.withdrawalId}`,
      `Amount: GHS ${safeFormatPrice(params.amountGhs)}`,
      `Reference: ${params.reference || "N/A"}`,
      `Owner: ${params.fullName || "N/A"}`,
      `Email: ${params.email || "N/A"}`,
      `Phone: ${params.phoneNumber || "N/A"}`,
      `MoMo Name: ${params.momoName || "N/A"}`,
      `MoMo Number: ${params.momoNumber || "N/A"}`,
      `Method: ${params.method || "N/A"}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "white_check_mark,moneybag,bank",
  });
}

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
  if (!key) {
    return null;
  }

  const sel = "bundle_amount, recipient_msisdn, user_id";

  const { data: byReference } = await admin
    .from("transactions")
    .select(sel)
    .eq("reference", key)
    .eq("transaction_type", "purchase")
    .maybeSingle();
  if (byReference) {
    return byReference;
  }

  const { data: byCode } = await admin
    .from("transactions")
    .select(sel)
    .eq("transaction_code", key)
    .eq("transaction_type", "purchase")
    .maybeSingle();
  if (byCode) {
    return byCode;
  }

  if (looksLikeUuid(key)) {
    const { data: byId } = await admin
      .from("transactions")
      .select(sel)
      .eq("id", key)
      .eq("transaction_type", "purchase")
      .maybeSingle();
    if (byId) {
      return byId;
    }
  }

  return null;
}

export async function notifyAdminOrderDeliveredIfNeeded(params: {
  admin: SupabaseClient;
  transaction_id: string;
  previousStatus: string | null | undefined;
  newStatus: string;
}): Promise<void> {
  const next = normalizeOrderStatus(params.newStatus);
  if (next !== "delivered") {
    return;
  }

  const prev = params.previousStatus
    ? normalizeOrderStatus(params.previousStatus)
    : "";
  if (prev === "delivered") {
    return;
  }

  try {
    const tx = await loadPurchaseRowForDeliveryNotify(
      params.admin,
      params.transaction_id
    );
    if (!tx?.user_id) {
      return;
    }

    const { data: profile } = await params.admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", tx.user_id)
      .maybeSingle();

    const customerName =
      (profile?.full_name && String(profile.full_name).trim()) ||
      (profile?.email && String(profile.email).trim()) ||
      "Customer";

    await sendAdminDeliveryNotification({
      orderId: params.transaction_id,
      customerName,
      product: tx.bundle_amount || "Data bundle",
      beneficiary: tx.recipient_msisdn || "-",
    });

    // Notify user via Web Push
    await sendWebPushNotification(tx.user_id, {
      title: "Order Delivered! 📦",
      body: `Your bundle (${tx.bundle_amount || 'Data bundle'}) was successfully delivered to ${tx.recipient_msisdn || ''}.`,
      url: "/orders",
    });
  } catch (error) {
    console.error("notifyAdminOrderDeliveredIfNeeded:", error);
  }
}
