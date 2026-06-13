import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { getRetailPriceGhs } from "@/lib/retail-prices";
import { getMinimumPrice } from "@/lib/minimum-prices";
import { formatDataPackageLabel, isConsumerDataBundle, parseDataPackageVolumeGb } from "@/lib/package-display";
import { datakazinaNetworkIdToDisplay, displayNetworkIdFromProviderLabel, displayNetworkIdToDatakazina } from "@/lib/network-id-map";
import { normalizePhoneNumber } from "@/lib/networks";
import { computeResellerEarningsSummary, computeResellerProfitGhs } from "@/lib/reseller-earnings";
import { extractDakazinaOrderCode } from "@/lib/dakazina-order-code";
import { sendNtfyNotification } from "@/lib/server/notifications";
import { verifyPaystackPayment } from "@/lib/paystack-verify";

const AGENT_API_KEY = process.env.AGENT_APP_API_KEY?.trim();
const AGENT_JWT_SECRET = (process.env.AGENT_JWT_SECRET?.trim() || AGENT_API_KEY)?.trim();

export type AgentJwtPayload = {
  sub?: string;
  store_id?: string;
  reseller_slug?: string;
  exp?: number;
  [key: string]: unknown;
};

export function requireAgentApiKey(request: Request) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey || apiKey !== AGENT_API_KEY) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }
  return null;
}

export function verifyAgentJwt(token: string): AgentJwtPayload | null {
  if (!token || !AGENT_JWT_SECRET) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header64, payload64, signature64] = parts;

  let header: Record<string, unknown>;
  let payload: AgentJwtPayload;
  try {
    const headerJson = Buffer.from(header64, "base64url").toString("utf-8");
    const payloadJson = Buffer.from(payload64, "base64url").toString("utf-8");
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (String(header.alg || "").toUpperCase() !== "HS256") {
    return null;
  }

  const expectedSignature = createHmac("sha256", AGENT_JWT_SECRET)
    .update(`${header64}.${payload64}`)
    .digest("base64url");

  try {
    const signatureBuffer = Buffer.from(signature64, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  if (payload.exp != null) {
    const expiry = Number(payload.exp);
    if (!Number.isFinite(expiry) || Date.now() / 1000 > expiry) {
      return null;
    }
  }

  return payload;
}

export async function requireAgentJwt(request: Request) {
  const apiError = requireAgentApiKey(request);
  if (apiError) return apiError;

  const authHeader = request.headers.get("authorization")?.trim() || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Agent JWT authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyAgentJwt(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired Agent JWT" },
      { status: 401 }
    );
  }

  const storeId = String(payload.store_id || payload.sub || "").trim();
  if (!storeId) {
    return NextResponse.json(
      { error: "Agent JWT missing store identifier" },
      { status: 401 }
    );
  }

  return { storeId, payload };
}

export async function loadAgentStoreByIdOrSlug(identifier: string) {
  const admin = createAdminClient();
  const normalized = String(identifier).trim();

  let storeProfile = await admin
    .from("profiles")
    .select(
      "id,is_reseller,reseller_approved,store_active,store_name,reseller_slug,profit_margin,wallet_balance,full_name,email,phone_number,store_description,contact_number,whatsapp_link,avatar_url"
    )
    .eq("id", normalized)
    .maybeSingle();

  if (!storeProfile.data && normalized) {
    storeProfile = await admin
      .from("profiles")
      .select(
        "id,is_reseller,reseller_approved,store_active,store_name,reseller_slug,profit_margin,wallet_balance,full_name,email,phone_number,store_description,contact_number,whatsapp_link,avatar_url"
      )
      .eq("reseller_slug", normalized)
      .maybeSingle();
  }

  return storeProfile;
}

export function mapDataKazinaPackages(rawPackages: unknown[]) {
  const mapped = [] as Array<Record<string, unknown>>;

  for (const rawPkg of rawPackages) {
    if (!rawPkg || typeof rawPkg !== "object") continue;
    const pkg = rawPkg as Record<string, unknown>;
    if (!isConsumerDataBundle(pkg)) continue;

    const volumeGb = parseDataPackageVolumeGb(pkg);
    if (volumeGb == null) continue;

    const packageId = Number(pkg.id);
    const providerLabel = pkg.network != null ? String(pkg.network) : "";
    const fromLabel = displayNetworkIdFromProviderLabel(providerLabel);
    const rawNetId = Number(pkg.network_id);
    const displayNetId =
      fromLabel ??
      (Number.isFinite(rawNetId)
        ? datakazinaNetworkIdToDisplay(Math.trunc(rawNetId))
        : 1);
    const netFromId = displayNetId || 1;

    let networkName = (netFromId === 2 ? "Telecel" : netFromId === 3 ? "AirtelTigo" : "MTN") as string;
    if (
      providerLabel &&
      (providerLabel.includes("AT") ||
        providerLabel.includes("iSHare") ||
        providerLabel.includes("BigTime"))
    ) {
      networkName = "AirtelTigo";
    } else if (providerLabel && providerLabel.toLowerCase().includes("telecel")) {
      networkName = "Telecel";
    } else if (providerLabel && providerLabel.toLowerCase().includes("mtn")) {
      networkName = "MTN";
    }

    const dataAmount = formatDataPackageLabel(pkg, volumeGb);
    const validity = pkg.validity != null ? String(pkg.validity) : "30 days";
    const manualPrice = getRetailPriceGhs(displayNetId, volumeGb);

    mapped.push({
      id: String(packageId),
      network: { id: displayNetId, name: networkName },
      providerNetworkId: Math.trunc(rawNetId),
      dataAmount,
      validity,
      sharedBundle: volumeGb,
      price: manualPrice ?? Number(pkg.price || pkg.console_price || 0),
    });
  }

  mapped.sort((a, b) => {
    const aSize = Number(a.sharedBundle || 0);
    const bSize = Number(b.sharedBundle || 0);
    return aSize - bSize;
  });

  return mapped;
}

export async function fetchAgentPackages() {
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok || !pkgResult.data) {
    return { ok: false, error: "Failed to load packages" };
  }
  return { ok: true, packages: mapDataKazinaPackages(pkgResult.data) };
}

export async function buildAgentStorePrices(storeId: string) {
  const storeProfileResponse = await loadAgentStoreByIdOrSlug(storeId);
  if (storeProfileResponse.error) {
    return { ok: false, status: 500, error: "Failed to load store profile" };
  }
  const storeOwner = storeProfileResponse.data;
  if (!storeOwner) {
    return { ok: false, status: 404, error: "Agent store not found" };
  }

  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok || !pkgResult.data) {
    return { ok: false, status: 502, error: "Failed to fetch packages from provider" };
  }

  const admin = createAdminClient();
  const { data: resellerPrices } = await admin
    .from("reseller_prices")
    .select("package_id,selling_price")
    .eq("reseller_id", storeOwner.id);

  const customPriceMap = new Map<number, number>();
  if (resellerPrices) {
    for (const price of resellerPrices) {
      const packageId = Number(price.package_id);
      const sellingPrice = Number(price.selling_price);
      if (Number.isFinite(packageId) && Number.isFinite(sellingPrice)) {
        customPriceMap.set(packageId, sellingPrice);
      }
    }
  }

  const storeProfitMargin = Number(storeOwner.profit_margin || 0.05);
  const packages = mapDataKazinaPackages(pkgResult.data).map((pkg) => {
    const sharedBundle = Number(pkg.sharedBundle || 0);
    const displayNetworkId = Number(((pkg.network as any)?.id) || 1);
    const networkName =
      displayNetworkId === 2 ? "TELECEL" :
      displayNetworkId === 3 ? "AIRTELTIGO" :
      "MTN";

    const retailPrice =
      getRetailPriceGhs(displayNetworkId, sharedBundle) ??
      Number(pkg.price || 0);

    const adminProfitMargin = sharedBundle >= 10 ? 0.10 : 0.114;
    const adminPrice = retailPrice * (1 + adminProfitMargin);
    const mainSitePrice = getMinimumPrice(networkName, sharedBundle) ?? adminPrice;
    const defaultStorePrice = adminPrice * (1 + storeProfitMargin);
    const customPrice = customPriceMap.get(Number(pkg.id));
    const sellingPrice = Math.max(Number(customPrice ?? defaultStorePrice), mainSitePrice);

    return {
      ...pkg,
      cost_price: Number(mainSitePrice.toFixed(2)),
      selling_price: Number(sellingPrice.toFixed(2)),
    };
  });

  return { ok: true, packages };
}

export async function getAgentStoreProfile(storeId: string) {
  const response = await loadAgentStoreByIdOrSlug(storeId);
  if (response.error) {
    return { ok: false, status: 500, error: "Failed to load store profile" };
  }
  const storeOwner = response.data;
  if (!storeOwner) {
    return { ok: false, status: 404, error: "Agent store not found" };
  }

  return {
    ok: true,
    profile: {
      id: storeOwner.id,
      store_name: storeOwner.store_name,
      reseller_slug: storeOwner.reseller_slug,
      full_name: storeOwner.full_name,
      email: storeOwner.email,
      phone_number: storeOwner.phone_number,
      wallet_balance: Number(storeOwner.wallet_balance || 0),
      profit_margin: Number(storeOwner.profit_margin || 0),
      reseller_approved: storeOwner.reseller_approved || false,
      store_active: storeOwner.store_active || false,
      store_description: storeOwner.store_description || null,
      contact_number: storeOwner.contact_number || null,
      whatsapp_link: storeOwner.whatsapp_link || null,
      avatar_url: storeOwner.avatar_url || null,
      store_url:
        storeOwner.reseller_slug && process.env.MASTER_SITE_URL
          ? `${process.env.MASTER_SITE_URL.replace(/\/$/, "")}/store/${storeOwner.reseller_slug}`
          : null,
    },
  };
}

export async function getAgentStoreCustomers(storeId: string) {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("customer_phone,customer_email,customer_name,phone_number,customer_id,created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  const customers: Array<{ phone: string; email: string | null; name: string | null; last_order_at: string }> = [];
  const seen = new Set<string>();

  for (const order of orders || []) {
    const phone = normalizePhoneNumber(String(order.customer_phone || order.phone_number || "")).trim();
    const email = order.customer_email ? String(order.customer_email).trim() : null;
    const name = order.customer_name ? String(order.customer_name).trim() : null;
    if (!phone && !email) continue;

    const key = `${phone || "unknown"}|${email || "unknown"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    customers.push({
      phone,
      email,
      name,
      last_order_at: String(order.created_at || ""),
    });
  }

  return customers;
}

export async function getAgentStoreOrders(storeId: string) {
  const admin = createAdminClient();
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id,customer_email,customer_phone,customer_name,phone_number,amount,status,package_id,network_id,paystack_transaction_id,dakazina_order_id,created_at"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, status: 500, error: "Failed to load orders" };
  }

  return {
    ok: true,
    orders: (orders || []).map((order: any) => ({
      id: order.id,
      customer_phone: normalizePhoneNumber(String(order.customer_phone || order.phone_number || "")).trim(),
      customer_email: order.customer_email || null,
      customer_name: order.customer_name || null,
      amount: Number(order.amount || 0),
      status: order.status,
      package_id: order.package_id,
      network_id: order.network_id,
      paystack_transaction_id: order.paystack_transaction_id || null,
      dakazina_order_id: order.dakazina_order_id || null,
      created_at: order.created_at,
    })),
  };
}

export async function getAgentEarningsSummary(storeId: string) {
  const storeProfile = await getAgentStoreProfile(storeId);
  if (!storeProfile.ok || !storeProfile.profile) {
    return { ok: false, status: storeProfile.status, error: storeProfile.error };
  }

  const admin = createAdminClient();
  const earnings = await computeResellerEarningsSummary(admin, storeId);
  return {
    ok: true,
    earnings: {
      ...earnings,
      wallet_balance: storeProfile.profile.wallet_balance,
    },
  };
}

export async function createAgentOrder(params: {
  storeId: string;
  email?: string;
  recipientMsisdn: string;
  networkId: number;
  providerNetworkId?: number;
  packageId: number | string;
  amount: number;
  paymentReference: string;
  customerName?: string;
}) {
  const {
    storeId,
    email,
    customerName,
    recipientMsisdn,
    networkId,
    providerNetworkId,
    packageId,
    amount,
    paymentReference,
  } = params;

  const admin = createAdminClient();

  const { data: existingOrder } = await admin
    .from("orders")
    .select("id,paystack_transaction_id")
    .eq("payment_reference", paymentReference)
    .maybeSingle();

  if (existingOrder) {
    return {
      ok: true,
      duplicate: true,
      transaction_code: existingOrder.paystack_transaction_id || paymentReference,
    };
  }

  const paymentVerified = await verifyPaystackPayment(paymentReference);
  if (!paymentVerified) {
    return { ok: false, status: 402, error: "Payment could not be verified" };
  }

  const { data: storeOwner, error: storeError } = await admin
    .from("profiles")
    .select("id,is_reseller,reseller_approved,store_active,profit_margin,store_name,reseller_slug")
    .eq("id", storeId)
    .single();

  if (storeError || !storeOwner) {
    return { ok: false, status: 404, error: "Agent store not found" };
  }
  if (!storeOwner.is_reseller || !storeOwner.reseller_approved || !storeOwner.store_active) {
    return { ok: false, status: 400, error: "Agent store is not active" };
  }

  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok || !pkgResult.data) {
    return { ok: false, status: 502, error: "Could not fetch available packages" };
  }

  const pkg = pkgResult.data.find((p: any) => String(p.id) === String(packageId));
  if (!pkg) {
    return { ok: false, status: 404, error: "Package not found" };
  }

  const recipient = normalizePhoneNumber(String(recipientMsisdn));
  if (!recipient || recipient.length < 10) {
    return { ok: false, status: 400, error: "Invalid recipient phone number" };
  }

  const upfrontResellerProfit = computeResellerProfitGhs({
    amount,
    consolePrice: pkg.console_price ?? pkg.price ?? 0,
  });

  const { data: newOrder, error: insertErr } = await admin
    .from("orders")
    .insert({
      customer_id: null,
      store_id: storeOwner.id,
      package_id: Number(packageId),
      network_id: Number(networkId),
      phone_number: recipient,
      amount: Number(amount),
      status: "processing",
      customer_email: email ?? null,
      customer_phone: recipient,
      customer_name: customerName ?? null,
      payment_reference: paymentReference,
      reseller_profit: upfrontResellerProfit,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !newOrder) {
    return { ok: false, status: 500, error: "Failed to create order record" };
  }

  const providerNetworkIdValue =
    providerNetworkId != null
      ? Number(providerNetworkId)
      : undefined;

  const datakazinaNetworkId = displayNetworkIdToDatakazina(
    Number(networkId),
    providerNetworkIdValue
  );

  const dakazinaRef = `SB-${Date.now()}`;
  const purchaseParams = {
    recipient_msisdn: recipient,
    network_id: datakazinaNetworkId,
    shared_bundle: Number(pkg.id),
    incoming_api_ref: dakazinaRef,
  };

  const deliveryResult = await retryPurchase(purchaseParams);
  if (!deliveryResult.ok) {
    await admin
      .from("orders")
      .update({ status: "failed", error_message: deliveryResult.error })
      .eq("id", newOrder.id);

    return { ok: false, status: 502, error: "Data delivery failed" };
  }

  const deliveryData = deliveryResult.data ?? {};
  const providerCode = String(
    (deliveryData as any).transaction_code ?? (deliveryData as any).reference ?? dakazinaRef
  );
  const dakazinaOrderCode = extractDakazinaOrderCode(
    deliveryData as Record<string, unknown>,
    providerCode
  );

  await admin
    .from("orders")
    .update({
      status: "delivered",
      paystack_transaction_id: providerCode,
      dakazina_order_id: dakazinaOrderCode,
      error_message: null,
      reseller_profit: upfrontResellerProfit > 0 ? upfrontResellerProfit : 0,
    })
    .eq("id", newOrder.id);

  const consolePrice = Number(pkg.console_price ?? pkg.price ?? 0);
  const resellerProfit = upfrontResellerProfit;
  const resellerCost = consolePrice * 1.14;
  const profitMargin = ((resellerProfit / Number(amount)) * 100).toFixed(2);
  const platformProfit = Number(amount) - resellerCost - resellerProfit;

  await admin
    .from("profit_records")
    .insert({
      order_id: newOrder.id,
      store_id: storeOwner.id,
      actual_cost: resellerCost,
      selling_price: Number(amount),
      reseller_profit: resellerProfit > 0 ? resellerProfit : 0,
      platform_profit: platformProfit,
      profit_margin: Number(profitMargin),
    });

  void sendOrderNotification({
    storeOwner,
    paymentReference,
    providerCode,
    recipient,
    amount,
    packageId: Number(packageId),
  });

  return {
    ok: true,
    transaction_code: providerCode,
    reference: providerCode,
  };
}

async function retryPurchase(purchaseParams: {
  recipient_msisdn: string;
  network_id: number;
  shared_bundle: number;
  incoming_api_ref: string;
}) {
  const maxAttempts = 3;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await datakazinaAPI.purchaseDataPackage(purchaseParams);
    if (result.ok && result.data) {
      return { ok: true, data: result.data };
    }
    if (attempt === maxAttempts) {
      return { ok: false, error: result.rawText || "Provider did not return success" };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { ok: false, error: "Unknown error" };
}


function sendOrderNotification(params: {
  storeOwner: any;
  paymentReference: string;
  providerCode: string;
  recipient: string;
  amount: number;
  packageId: number;
}) {
  const { storeOwner, paymentReference, providerCode, recipient, amount, packageId } = params;
  void sendNtfyNotification({
    title: `Agent store order: GHS ${Number(amount).toFixed(2)}`,
    message: [
      "🛒 AGENT ORDER COMPLETED",
      `Store: ${String(storeOwner.store_name || "Unnamed store")}`,
      `Store ID: ${storeOwner.id}`,
      `Order Ref: ${paymentReference}`,
      `Provider Ref: ${providerCode}`,
      `Recipient: ${recipient}`,
      `Package ID: ${packageId}`,
      `Amount Paid: GHS ${Number(amount).toFixed(2)}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "agent_order,shopping_cart",
  });
}
