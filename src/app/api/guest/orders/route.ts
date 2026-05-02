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
import { normalizePhoneNumber, mapToDataKazinaNetworkId } from "@/lib/networks";

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
    .select("id, is_reseller, reseller_approved, store_active, wallet_balance, profit_margin")
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
    console.error("[guest/orders] Failed to fetch packages:", pkgResult.rawText);
    return NextResponse.json({ error: "Could not fetch available packages" }, { status: 502 });
  }
  const pkg = pkgResult.data.find((p) => String(p.id) === String(package_id));
  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // 6. Normalise phone number
  const recipient_msisdn = normalizePhoneNumber(String(phone_number));
  if (!recipient_msisdn || recipient_msisdn.length < 10) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

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

  // Map frontend network ID to DataKazina network ID
  const datakazinaNetworkId = mapToDataKazinaNetworkId(Number(network_id));
  console.log("[guest/orders] Network ID mapping:", { frontend: Number(network_id), datakazina: datakazinaNetworkId });

  const purchaseParams = {
    recipient_msisdn,
    network_id: datakazinaNetworkId,
    shared_bundle: Number(pkg.id),
    incoming_api_ref: dakazinaRef,
  };
  console.log("[guest/orders] Calling DataKazina with:", purchaseParams);

  const deliveryResult = await retryWithBackoff(
    async () => {
      const res = await datakazinaAPI.purchaseDataPackage(purchaseParams);

      console.log("[guest/orders] DataKazina response:", {
        ok: res.ok,
        status: res.status,
        data: res.ok ? res.data : null,
        rawText: res.ok ? "" : res.rawText,
      });

      if (!res.ok) {
        throw new Error(res.rawText || `DataKazina error ${res.status}`);
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

  console.log("[guest/orders] Updating order to completed:", providerCode);

  await admin
    .from("orders")
    .update({
      status:                   "completed",
      paystack_transaction_id:  providerCode,
      error_message:            null,
    })
    .eq("id", newOrder.id);

  console.log("[guest/orders] Order updated successfully, crediting reseller wallet");

  // Credit reseller profit (non-blocking — failure here must not affect the response)
  creditResellerWallet(admin, storeOwner, pkg, Number(amount)).catch((e) =>
    console.error("[guest/orders] Wallet credit failed:", e)
  );

  return NextResponse.json({
    success:          true,
    transaction_code: providerCode,
    reference:        providerCode,
  });
}

// ── Reseller wallet credit ────────────────────────────────────────────────────

async function creditResellerWallet(
  admin:      ReturnType<typeof createAdminClient>,
  storeOwner: { id: string; wallet_balance: number | null; profit_margin: number | null },
  pkg:        { console_price?: string | number; price?: string | number },
  amountPaid: number
): Promise<void> {
  const adminMarkup    = 0.14;
  const consolePrice   = Number(pkg.console_price ?? pkg.price ?? 0);
  const resellerCost   = consolePrice * (1 + adminMarkup);
  const resellerProfit = amountPaid - resellerCost;

  console.log("[guest/orders] Profit calculation:", {
    amountPaid,
    consolePrice,
    adminMarkup,
    resellerCost,
    resellerProfit,
  });

  if (resellerProfit <= 0) {
    console.log("[guest/orders] No profit to credit, skipping wallet update");
    return;
  }

  // Use increment via RPC if available — otherwise read-then-write is acceptable
  // here because the wallet credit is non-critical (can be reconciled manually).
  const currentBalance = Number(storeOwner.wallet_balance ?? 0);
  const newBalance = currentBalance + resellerProfit;

  console.log("[guest/orders] Crediting reseller wallet:", {
    storeId: storeOwner.id,
    currentBalance,
    profitToAdd: resellerProfit,
    newBalance,
  });

  const { error } = await admin
    .from("profiles")
    .update({ wallet_balance: newBalance })
    .eq("id", storeOwner.id);

  if (error) {
    console.error("[guest/orders] Wallet credit DB error:", error);
    throw error;
  }

  console.log("[guest/orders] Wallet credit successful");
}