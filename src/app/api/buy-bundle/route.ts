/**
 * src/app/api/buy-bundle/route.ts
 *
 * Authenticated wallet purchase using DataKazina /buy-data-package.
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                 from "@/lib/supabase/server";
import { createAdminClient }            from "@/lib/supabase/admin";
import type { SupabaseClient }          from "@supabase/supabase-js";
import { datakazinaAPI }                from "@/lib/datakazina";
import { normalizePhoneNumber }         from "@/lib/networks";
import { extractDakazinaOrderCode }     from "@/lib/dakazina-order-code";
import {
  displayNetworkIdToDatakazina,
  resolveDisplayNetworkId,
} from "@/lib/network-id-map";
import { notifyAdminBundlePurchase }    from "@/lib/server/notifications";

// ntfy configuration
const NTFY_TOPIC = process.env.NTFY_TOPIC || "bundle-ghana";
const NTFY_URL   = `https://ntfy.sh/${NTFY_TOPIC}`;

async function sendNtfyNotification(title: string, message: string) {
  try {
    const asciiTitle = String(title).replace(/[^\x20-\x7E]/g, "").trim() || "Notification";
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        "Title":    asciiTitle,
        "Priority": "high",
      },
      body: message,
    });
  } catch (error) {
    console.error("[buy-bundle] Failed to send ntfy notification:", error);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function abortPendingPurchase(
  admin:          SupabaseClient,
  userId:         string,
  transactionId:  string,
  restoreBalance: number,
  reason:         string
): Promise<void> {
  console.error(`[buy-bundle][ABORT] ${reason}`);
  await Promise.all([
    admin
      .from("profiles")
      .update({ wallet_balance: restoreBalance, updated_at: new Date().toISOString() })
      .eq("id", userId),
    admin.from("transactions").delete().eq("id", transactionId),
  ]);
}

function isDuplicateOrConflict(httpStatus: number, rawText: string): boolean {
  if (httpStatus === 409) return true;
  const t = rawText.toLowerCase();
  return (
    t.includes("already in progress")     ||
    t.includes("order already exist")     ||
    t.includes("duplicate")               ||
    t.includes("conflicting transaction") ||
    t.includes("couldn't place order")
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // STEP 1 — Auth
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    console.error("[buy-bundle][STEP-1] Auth failed:", authErr?.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // STEP 2 — Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    recipientMsisdn,
    networkId,
    networkName,
    sharedBundle,
    price,
    dataAmount,
  } = body as {
    recipientMsisdn?: unknown;
    networkId?:       unknown;
    networkName?:     unknown;
    sharedBundle?:    unknown;
    price?:           unknown;
    dataAmount?:      unknown;
  };

  if (!recipientMsisdn || networkId == null || sharedBundle == null || price == null || !dataAmount) {
    console.error("[buy-bundle][STEP-2] Missing fields");
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const recipient_msisdn = normalizePhoneNumber(String(recipientMsisdn));
  if (!recipient_msisdn || recipient_msisdn.length < 10) {
    console.error("[buy-bundle][STEP-2] Bad phone:", recipientMsisdn, "→", recipient_msisdn);
    return NextResponse.json({ error: "Invalid recipient phone number" }, { status: 400 });
  }

  // STEP 3 — Load wallet
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    console.error("[buy-bundle][STEP-3] Profile fetch failed:", profileErr);
    return NextResponse.json({ error: "Could not retrieve user profile" }, { status: 500 });
  }

  const balanceBefore = Number(profile.wallet_balance);

  if (balanceBefore < p) {
    return NextResponse.json(
      { error: "Insufficient funds. Please top up your wallet." },
      { status: 400 }
    );
  }

  // STEP 4 — Debit wallet + insert pending transaction
  const reference   = `loc-${crypto.randomUUID()}`;
  const shortRef    = `SB-${Date.now()}`;
  const description = `Purchase of ${dataAmount} for ${recipient_msisdn}`;

  const { error: walletErr } = await admin
    .from("profiles")
    .update({ wallet_balance: balanceBefore - p, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (walletErr) {
    console.error("[buy-bundle][STEP-4] Wallet debit failed:", walletErr);
    return NextResponse.json({ error: "Could not update wallet" }, { status: 500 });
  }

  const displayNetworkId = resolveDisplayNetworkId({
    displayNetworkId:   Number(networkId),
    displayNetworkName: networkName != null ? String(networkName) : undefined,
  });

  const { data: insertedRow, error: insertErr } = await admin
    .from("transactions")
    .insert({
      user_id:          user.id,
      reference,
      transaction_code: reference,
      status:           "pending",
      transaction_type: "purchase",
      amount:           -p,
      recipient_msisdn,
      network_id:       displayNetworkId,
      shared_bundle:    Number(sharedBundle),
      bundle_amount:    dataAmount,
      description,
    })
    .select("id")
    .single();

  if (insertErr || !insertedRow) {
    console.error("[buy-bundle][STEP-4] Transaction insert failed:", {
      code: insertErr.code, message: insertErr.message,
    });
    await admin
      .from("profiles")
      .update({ wallet_balance: balanceBefore, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ error: "Could not create order record" }, { status: 500 });
  }

  const transactionId = insertedRow.id;

  // STEP 5 — Call DataKazina /buy-data-package
  const datakazinaNetworkId = displayNetworkIdToDatakazina(displayNetworkId);

  const purchaseParams = {
    recipient_msisdn,
    network_id:       datakazinaNetworkId,
    shared_bundle:    Number(sharedBundle),
    incoming_api_ref: shortRef,  // short clean ref e.g. SB-1716508336000
  };

  // Parse dataAmount to check bundle size (e.g., "20 GB" -> 20)
  const sizeMatch = String(dataAmount).match(/(\d+(?:\.\d+)?)/);
  const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
  const isLargeBundle = sizeGb >= 20;

  // For MTN bundles >= 20GB, use base endpoint instead of main endpoint
  // (main endpoint may not support large MTN bundles)
  const useMainEndpoint = !(displayNetworkId === 1 && isLargeBundle);

  try {
    const result = await datakazinaAPI.purchaseDataPackage(purchaseParams, useMainEndpoint);

    // STEP 6a — Provider error
    if (!result.ok) {
      const isDupe = isDuplicateOrConflict(result.status, result.rawText);
      console.error("[buy-bundle][STEP-6a] Provider error:", {
        status: result.status, rawText: result.rawText, isDupe,
      });

      if (isDupe) {
        await admin
          .from("transactions")
          .update({
            status:      "pending",
            description: `${description} (duplicate acknowledged)`,
          })
          .eq("id", transactionId);

        return NextResponse.json(
          { error: "Order already in progress. Check My Orders or wait a few minutes.", code: "ORDER_IN_PROGRESS" },
          { status: 409 }
        );
      }

      await abortPendingPurchase(admin, user.id, transactionId, balanceBefore, result.rawText);
      return NextResponse.json(
        { error: result.rawText || "Provider rejected the request", code: "PROVIDER_ERROR" },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    // STEP 6b — Provider accepted; save Dakazina transaction code to database
    const providerCode = extractDakazinaOrderCode(
      (result.data ?? {}) as Record<string, unknown>,
      shortRef  // fallback to shortRef (SB-XXXXX), NOT the internal loc-UUID
    );

    console.log("[buy-bundle][STEP-6b] providerCode to save:", providerCode);

    const patch = {
      reference:         providerCode,
      transaction_code:  providerCode,
      dakazina_order_id: providerCode,
      status:            "pending",
      description:       `${description} | api_ref:${shortRef}`,
    };

    const { error: updateErr } = await admin
      .from("transactions")
      .update(patch)
      .eq("id", transactionId);

    if (updateErr) {
      console.error("[buy-bundle][STEP-6b] Transaction update failed:", updateErr);
      // Provider already placed the order — do not fail checkout
    } else {
      console.log("[buy-bundle][STEP-6b] Successfully saved dakazina_order_id:", providerCode);
    }

    void notifyAdminBundlePurchase({
      userId:          user.id,
      orderId:         providerCode,
      amountGhs:       p,
      dataAmount:      String(dataAmount),
      networkId:       displayNetworkId,
      recipientMsisdn: recipient_msisdn,
    });

    const ntfyMessage = `
🛒 MAIN SITE PURCHASE COMPLETED
========================================

📋 Purchase Details:
User ID: ${user.id}
Recipient Phone: ${recipient_msisdn}
Package: ${String(dataAmount)}
Amount Paid: GHS ${p.toFixed(2)}
Transaction Code: ${providerCode}

⏰ Completed: ${new Date().toISOString()}
    `.trim();

    void sendNtfyNotification(
      `Purchase: GHS ${p.toFixed(2)} - User ${user.id}`,
      ntfyMessage
    );

    return NextResponse.json({
      success:          true,
      transaction_code: providerCode,
      reference:        providerCode,
      local_reference:  reference,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[buy-bundle][STEP-5] Unhandled exception:", msg);
    await abortPendingPurchase(admin, user.id, transactionId, balanceBefore, msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}