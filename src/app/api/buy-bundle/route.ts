/**
 * src/app/api/buy-bundle/route.ts
 *
 * Authenticated wallet purchase using DataKazina /buy-data-package.
 *
 * Because the DataKazina response body is undocumented, we treat any
 * 2xx HTTP status as a successful delivery. The raw response is logged
 * so you can see the real shape the first time a purchase goes through.
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                 from "@/lib/supabase/server";
import { createAdminClient }            from "@/lib/supabase/admin";
import type { SupabaseClient }          from "@supabase/supabase-js";
import { datakazinaAPI }                from "@/lib/datakazina";
import { normalizePhoneNumber } from "@/lib/networks";
import { displayNetworkIdToDatakazina } from "@/lib/network-id-map";
import { notifyAdminBundlePurchase }    from "@/lib/server/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function abortPendingPurchase(
  admin:          SupabaseClient,
  userId:         string,
  reference:      string,
  restoreBalance: number,
  reason:         string
): Promise<void> {
  console.error(`[buy-bundle][ABORT] ${reason}`);
  await Promise.all([
    admin
      .from("profiles")
      .update({ wallet_balance: restoreBalance, updated_at: new Date().toISOString() })
      .eq("id", userId),
    admin
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .eq("reference", reference),
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

/**
 * Extract the best available transaction code from whatever DataKazina returns.
 * Since the response shape is undocumented we check every likely field name.
 */
function extractProviderCode(data: Record<string, unknown>, fallback: string): string {
  const candidates = [
    "transaction_code",
    "transactionCode",
    "transaction_id",
    "transactionId",
    "reference",
    "ref",
    "order_id",
    "orderId",
    "id",
  ];
  for (const key of candidates) {
    if (data[key] && String(data[key]).trim()) {
      return String(data[key]).trim();
    }
  }
  // DataKazina might nest under message or status objects
  for (const val of Object.values(data)) {
    if (typeof val === "string" && val.trim().length > 4) {
      // Return first non-trivial string value as a last resort
      return val.trim();
    }
  }
  return fallback;
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

  const { recipientMsisdn, networkId, sharedBundle, price, dataAmount } = body as {
    recipientMsisdn?: unknown;
    networkId?:       unknown;
    sharedBundle?:    unknown;
    price?:           unknown;
    dataAmount?:      unknown;
  };

  // Removed body logging to prevent exposing sensitive data in console

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
  // Removed balance logging to prevent exposing financial data in console

  if (balanceBefore < p) {
    return NextResponse.json(
      { error: "Insufficient funds. Please top up your wallet." },
      { status: 400 }
    );
  }

  // STEP 4 — Debit wallet + insert pending transaction
  const reference   = `loc-${crypto.randomUUID()}`;
  const description = `Purchase of ${dataAmount} for ${recipient_msisdn}`;

  const { error: walletErr } = await admin
    .from("profiles")
    .update({ wallet_balance: balanceBefore - p, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (walletErr) {
    console.error("[buy-bundle][STEP-4] Wallet debit failed:", walletErr);
    return NextResponse.json({ error: "Could not update wallet" }, { status: 500 });
  }

  const { error: insertErr } = await admin.from("transactions").insert({
    user_id:          user.id,
    reference,
    transaction_code: reference,
    status:           "pending",
    transaction_type: "purchase",
    amount:           -p,
    recipient_msisdn,
    network_id:       Number(networkId),
    shared_bundle:    Number(sharedBundle),
    bundle_amount:    dataAmount,
    description,
  });

  if (insertErr) {
    console.error("[buy-bundle][STEP-4] Transaction insert failed:", {
      code: insertErr.code, message: insertErr.message,
    });
    await admin
      .from("profiles")
      .update({ wallet_balance: balanceBefore, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ error: "Could not create order record" }, { status: 500 });
  }

  // Removed transaction logging to prevent exposing sensitive data in console

  // STEP 5 — Call DataKazina /buy-data-package
  // Map display network ID to DataKazina network ID
  const datakazinaNetworkId = displayNetworkIdToDatakazina(Number(networkId));
  // Removed network ID mapping logging to prevent exposing internal logic

  const purchaseParams = {
    recipient_msisdn,
    network_id:       datakazinaNetworkId,
    shared_bundle:    Number(sharedBundle), // pkg.id from the package list
    incoming_api_ref: reference,
  };
  // removed parameter logging to prevent exposing API call details

  try {
    const result = await datakazinaAPI.purchaseDataPackage(purchaseParams);

    // Log the full raw response so we learn what DataKazina actually returns
    // Removed response logging to prevent exposing API responses in console

    // STEP 6a — Provider error
    if (!result.ok) {
      const isDupe = isDuplicateOrConflict(result.status, result.rawText);
      console.error("[buy-bundle][STEP-6a] Provider error:", {
        status: result.status, rawText: result.rawText, isDupe,
      });

      if (isDupe) {
        await admin
          .from("transactions")
          .update({ status: "placed", description: `${description} (duplicate acknowledged)` })
          .eq("user_id", user.id)
          .eq("reference", reference);

        return NextResponse.json(
          { error: "Order already in progress. Check My Orders or wait a few minutes.", code: "ORDER_IN_PROGRESS" },
          { status: 409 }
        );
      }

      await abortPendingPurchase(admin, user.id, reference, balanceBefore, result.rawText);
      return NextResponse.json(
        { error: result.rawText || "Provider rejected the request", code: "PROVIDER_ERROR" },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    // STEP 6b — 2xx = success (response shape may vary)
    const providerCode = extractProviderCode(
      result.data as Record<string, unknown>,
      reference // fallback to our own reference if DataKazina returns nothing useful
    );

  // Removed success logging to prevent exposing transaction codes

    // Mark transaction as placed
    const patch = {
      reference:        providerCode,
      transaction_code: providerCode,
      status:           "placed",
      description,
    };

    const { error: updateErr } = await admin
      .from("transactions")
      .update(patch)
      .eq("user_id", user.id)
      .eq("reference", reference);

    if (updateErr) {
      // Fallback: match by transaction_code in case reference already changed
      // Removed error logging to prevent exposing sensitive database errors in console
      await admin
        .from("transactions")
        .update(patch)
        .eq("user_id", user.id)
        .eq("transaction_code", reference);
    }

    void notifyAdminBundlePurchase({
      userId:          user.id,
      orderId:         providerCode,
      amountGhs:       p,
      dataAmount:      String(dataAmount),
      networkId:       Number(networkId),
      recipientMsisdn: recipient_msisdn,
    });

    return NextResponse.json({
      success:          true,
      transaction_code: providerCode,
      reference:        providerCode,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[buy-bundle][STEP-5] Unhandled exception:", msg);
    await abortPendingPurchase(admin, user.id, reference, balanceBefore, msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}