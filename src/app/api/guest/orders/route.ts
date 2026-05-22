/**
 * src/app/api/guest/orders/route.ts
 *
 * Post-Paystack-payment order processing for reseller store guests.
 *
 * Flow:
 *  1. Validate body (payment_reference is required)
 *  2. Idempotency check — bail early if reference already processed
 *  3. Verify payment with Paystack
 *  4. Validate store is active
 *  5. Resolve package from DataKazina
 *  6. Normalise phone number
 *  7. Insert order row in "processing" state (second idempotency anchor)
 *  8. Call DataKazina to deliver bundle
 *  9. Update order status; credit reseller wallet on success
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient }          from "@/lib/supabase/admin";
import { datakazinaAPI }              from "@/lib/datakazina";
import { retryWithBackoff }           from "@/lib/server/retry";
import { normalizePhoneNumber }       from "@/lib/networks";
import { displayNetworkIdToDatakazina } from "@/lib/network-id-map";
import { computeResellerProfitGhs } from "@/lib/reseller-earnings";
import { sendNtfyNotification } from "@/lib/server/notifications";
import { extractDakazinaOrderCode } from "@/lib/dakazina-order-code";

// ── Paystack verification ─────────────────────────────────────────────────────

async function verifyPaystackPayment(reference: string): Promise<boolean> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[guest/orders] PAYSTACK_SECRET_KEY not configured");
    return false;
  }
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    if (!res.ok) return false;
    const json = await res.json();
    return json?.data?.status === "success";
  } catch (err) {
    console.error("[guest/orders] Paystack verify threw:", err);
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse + validate
  let body: {
    store_id?:          string;
    package_id?:        number | string;
    network_id?:        number | string;
    phone_number?:      string;
    email?:             string;
    amount?:            number | string;
    payment_reference?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { store_id, package_id, network_id, phone_number, email, amount, payment_reference } = body;

  if (!store_id || !package_id || !network_id || !phone_number || !amount || !payment_reference) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Idempotency — same Paystack reference already in the orders table?
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id, status, paystack_transaction_id")
    .eq("payment_reference", payment_reference)
    .maybeSingle();

  if (existingOrder) {
    return NextResponse.json(
      {
        success:          true,
        message:          "Order already processed",
        transaction_code: existingOrder.paystack_transaction_id ?? payment_reference,
      },
      { status: 200 }
    );
  }

  // 3. Verify payment with Paystack
  const paymentVerified = await verifyPaystackPayment(payment_reference);
  if (!paymentVerified) {
    return NextResponse.json(
      {
        error:
          "Payment could not be verified. Contact support with reference: " +
          payment_reference,
      },
      { status: 402 }
    );
  }

  // 4. Validate store
  const { data: storeOwner, error: storeErr } = await admin
    .from("profiles")
    .select("id, is_reseller, reseller_approved, store_active, wallet_balance, profit_margin, store_name, reseller_slug")
    .eq("id", store_id)
    .single();

  if (storeErr || !storeOwner) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  if (!storeOwner.is_reseller || !storeOwner.reseller_approved || !storeOwner.store_active) {
    return NextResponse.json({ error: "Store is not active" }, { status: 400 });
  }

  // 5. Resolve package from DataKazina
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok) {
    console.error("[guest/orders] Failed to fetch packages from provider");
    return NextResponse.json({ error: "Could not fetch available packages" }, { status: 502 });
  }
  // Removed package logging to prevent exposing sensitive data in console
  const pkg = pkgResult.data.find((p) => String(p.id) === String(package_id));
  if (!pkg) {
    console.error("[guest/orders] Package not found.");
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  // Removed package logging to prevent exposing sensitive data in console

  // 6. Normalise phone number
  const recipient_msisdn = normalizePhoneNumber(String(phone_number));
  if (!recipient_msisdn || recipient_msisdn.length < 10) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // Pre-compute reseller profit so earnings can accrue immediately after paid order creation.
  const upfrontResellerProfit = computeResellerProfitGhs({
    amount,
    consolePrice: pkg.console_price ?? pkg.price ?? 0,
  });

  // 7. Insert order in "processing" — acts as second idempotency anchor
  const { data: newOrder, error: insertErr } = await admin
    .from("orders")
    .insert({
      customer_id:       null,
      store_id,
      package_id:        Number(package_id),
      network_id:        Number(network_id),
      phone_number:      recipient_msisdn,
      amount:            Number(amount),
      status:            "processing",
      customer_email:    email ?? null,
      customer_phone:    recipient_msisdn,
      payment_reference,
      reseller_profit:    upfrontResellerProfit,
      created_at:        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !newOrder) {
    console.error("[guest/orders] Order insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to create order record" }, { status: 500 });
  }

  // 8. Call DataKazina (with retry)
  const dakazinaRef = `guest-${newOrder.id}`;

  // Map display network ID to DataKazina network ID
  const datakazinaNetworkId = displayNetworkIdToDatakazina(Number(network_id));
  // Removed network mapping logging to prevent exposing internal logic

  const purchaseParams = {
    recipient_msisdn,
    network_id: datakazinaNetworkId,
    shared_bundle: Number(pkg.id),
    incoming_api_ref: dakazinaRef,
  };
  // Removed parameter logging to prevent exposing API call details

  const deliveryResult = await retryWithBackoff(
    async () => {
      const res = await datakazinaAPI.purchaseDataPackage(purchaseParams);

      // Removed response logging to prevent exposing API responses in console

      if (!res.ok) {
        throw new Error(`Provider error ${res.status}`);
      }
      if (!res.data.transaction_code && !res.data.reference) {
        throw new Error(String(res.data.message ?? "No transaction code in response"));
      }
      return res.data;
    },
    3,
    2_000
  );

  // 9. Handle delivery outcome
  if (!deliveryResult.success) {
    console.error("[guest/orders] All retries exhausted for order", newOrder.id, deliveryResult.error);

    await admin
      .from("orders")
      .update({
        status:        "failed",
        error_message: deliveryResult.error,
      })
      .eq("id", newOrder.id);

    return NextResponse.json(
      {
        error:
          "Data delivery failed. " +
          "Contact support with reference: " +
          payment_reference,
      },
      { status: 502 }
    );
  }

  const providerCode =
    deliveryResult.data.transaction_code ??
    deliveryResult.data.reference ??
    dakazinaRef;

  // Extract Dakazina's order code (e.g., ORDER-703436) from the response
  const dakazinaOrderCode = extractDakazinaOrderCode(
    (deliveryResult.data ?? {}) as Record<string, unknown>,
    providerCode
  );

  // Removed success logging to prevent exposing transaction codes

  // Calculate reseller profit before updating order
  const consolePrice = Number(pkg.console_price ?? pkg.price ?? 0);
  const resellerProfit = upfrontResellerProfit;
  const resellerCost = consolePrice * 1.14;

  // Removed profit calculation logging to prevent exposing financial data

  await admin
    .from("orders")
    .update({
      status:                   "delivered",
      paystack_transaction_id:  providerCode,
      dakazina_order_id:        dakazinaOrderCode,
      error_message:            null,
      reseller_profit:          resellerProfit > 0 ? resellerProfit : 0,
    })
    .eq("id", newOrder.id);

  // Removed profit logging to prevent exposing financial data in console

  // Store profit is tracked in orders table via reseller_profit field
  // It will be available as earnings in the reseller dashboard
  // Do NOT credit wallet balance - earnings should be moved to wallet manually

  // Create detailed profit record for store order
  const profitMargin = ((resellerProfit / Number(amount)) * 100).toFixed(2);
  const platformProfit = Number(amount) - resellerCost - resellerProfit;
  
  await admin
    .from("profit_records")
    .insert({
      order_id: newOrder.id,
      store_id: store_id,
      actual_cost: resellerCost,
      selling_price: Number(amount),
      reseller_profit: resellerProfit > 0 ? resellerProfit : 0,
      platform_profit: platformProfit,
      profit_margin: Number(profitMargin),
    });

  const buyerLabel =
    String(email || "").trim() || "Guest customer (unknown name)";
  const storeLabel =
    String(storeOwner.store_name || "").trim() || "Unnamed store";
  const storeSlug = String(storeOwner.reseller_slug || "").trim();
  const storeUrl = storeSlug
    ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${storeSlug}`
    : "N/A";

  await sendNtfyNotification({
    title: `Store Order: GHS ${Number(amount).toFixed(2)}`,
    message: [
      "🛒 STORE ORDER COMPLETED",
      `Store: ${storeLabel}`,
      `Store URL: ${storeUrl}`,
      `Store ID: ${store_id}`,
      `Order ID: ${newOrder.id}`,
      `Payment Ref: ${payment_reference}`,
      `Provider Ref: ${providerCode}`,
      `Buyer: ${buyerLabel}`,
      `Recipient Phone: ${recipient_msisdn}`,
      `Package: ${pkg.volume || pkg.shared_bundle}GB`,
      `Amount Paid: GHS ${Number(amount).toFixed(2)}`,
      `Store Profit: GHS ${resellerProfit > 0 ? resellerProfit.toFixed(2) : "0.00"}`,
      `Completed: ${new Date().toISOString()}`,
    ].join("\n"),
    tags: "shopping_cart,moneybag,iphone",
  });

  return NextResponse.json({
    success:          true,
    transaction_code: providerCode,
    reference:        providerCode,
  });
}