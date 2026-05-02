/**
 * src/app/api/buy-bundle/route.ts
 *
 * Every failure point logs a [buy-bundle][STEP-N] prefix so you can
 * grep your terminal / Vercel logs and see exactly where it broke.
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                 from "@/lib/supabase/server";
import { createAdminClient }            from "@/lib/supabase/admin";
import type { SupabaseClient }          from "@supabase/supabase-js";
import { datakazinaAPI }                from "@/lib/datakazina";
import { normalizePhoneNumber }         from "@/lib/networks";
import { notifyAdminBundlePurchase }    from "@/lib/server/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function abortPendingPurchase(
  admin:          SupabaseClient,
  userId:         string,
  reference:      string,
  restoreBalance: number,
  reason:         string
): Promise<void> {
  console.error(`[buy-bundle][ABORT] ${reason} — restoring balance ${restoreBalance} for user ${userId}`);
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ── STEP 1: Auth ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    console.error("[buy-bundle][STEP-1] Auth failed:", authErr?.message ?? "no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[buy-bundle][STEP-1] Auth OK — user:", user.id);

  // ── STEP 2: Parse body ────────────────────────────────────────────────────
  let body: {
    recipientMsisdn?: unknown;
    networkId?:       unknown;
    sharedBundle?:    unknown;
    price?:           unknown;
    dataAmount?:      unknown;
  };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[buy-bundle][STEP-2] JSON parse failed:", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recipientMsisdn, networkId, sharedBundle, price, dataAmount } = body;

  // Log exactly what arrived so you can see type mismatches
  console.log("[buy-bundle][STEP-2] Body received:", {
    recipientMsisdn,
    networkId,
    networkIdType:   typeof networkId,
    sharedBundle,
    sharedBundleType: typeof sharedBundle,
    price,
    priceType:       typeof price,
    dataAmount,
  });

  if (
    !recipientMsisdn ||
    networkId  == null ||
    sharedBundle == null ||
    price      == null ||
    !dataAmount
  ) {
    console.error("[buy-bundle][STEP-2] Validation failed — missing fields:", {
      hasRecipient:    !!recipientMsisdn,
      hasNetworkId:    networkId  != null,
      hasSharedBundle: sharedBundle != null,
      hasPrice:        price      != null,
      hasDataAmount:   !!dataAmount,
    });
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) {
    console.error("[buy-bundle][STEP-2] Invalid price:", price);
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const recipient_msisdn = normalizePhoneNumber(String(recipientMsisdn));
  if (!recipient_msisdn || recipient_msisdn.length < 10) {
    console.error("[buy-bundle][STEP-2] Invalid phone after normalise:", {
      raw: recipientMsisdn,
      normalised: recipient_msisdn,
    });
    return NextResponse.json({ error: "Invalid recipient phone number" }, { status: 400 });
  }

  console.log("[buy-bundle][STEP-2] Validated OK:", {
    recipient_msisdn,
    networkId: Number(networkId),
    sharedBundle: Number(sharedBundle),
    price: p,
    dataAmount,
  });

  // ── STEP 3: Load wallet ───────────────────────────────────────────────────
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
  console.log("[buy-bundle][STEP-3] Wallet balance:", balanceBefore, "— required:", p);

  if (balanceBefore < p) {
    console.error("[buy-bundle][STEP-3] Insufficient funds:", { balanceBefore, required: p });
    return NextResponse.json(
      { error: "Insufficient funds. Please top up your wallet." },
      { status: 400 }
    );
  }

  // ── STEP 4: Debit wallet + insert pending transaction ─────────────────────
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
      code:    insertErr.code,
      message: insertErr.message,
      details: insertErr.details,
    });
    await admin
      .from("profiles")
      .update({ wallet_balance: balanceBefore, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ error: "Could not create order record" }, { status: 500 });
  }

  console.log("[buy-bundle][STEP-4] Wallet debited, pending tx inserted. Reference:", reference);

  // ── STEP 5: Call DataKazina ───────────────────────────────────────────────
  const purchaseParams = {
    recipient_msisdn,
    network_id:       Number(networkId),
    shared_bundle:    Number(sharedBundle),
    incoming_api_ref: reference,
  };
  console.log("[buy-bundle][STEP-5] Calling DataKazina with:", purchaseParams);

  try {
    const result = await datakazinaAPI.purchaseDataPackage(purchaseParams);

    console.log("[buy-bundle][STEP-5] DataKazina raw response:", {
      ok:      result.ok,
      status:  result.status,
      data:    result.ok ? result.data : null,
      rawText: result.ok ? "" : result.rawText,
    });

    // ── STEP 6a: Provider error ─────────────────────────────────────────────
    if (!result.ok) {
      const isDupe = isDuplicateOrConflict(result.status, result.rawText);
      console.error("[buy-bundle][STEP-6a] DataKazina error:", {
        status:  result.status,
        rawText: result.rawText,
        isDupe,
      });

      if (isDupe) {
        await admin
          .from("transactions")
          .update({ status: "placed", description: `${description} (duplicate acknowledged)` })
          .eq("user_id", user.id)
          .eq("reference", reference);

        return NextResponse.json(
          {
            error: "Order already in progress for this number and bundle. " +
                   "Check My Orders or wait a few minutes.",
            code: "ORDER_IN_PROGRESS",
          },
          { status: 409 }
        );
      }

      await abortPendingPurchase(admin, user.id, reference, balanceBefore, result.rawText);
      return NextResponse.json(
        { error: result.rawText || "Provider rejected the purchase request", code: "PROVIDER_ERROR" },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    // ── STEP 6b: Success ────────────────────────────────────────────────────
    const providerCode =
      result.data.transaction_code ??
      result.data.reference ??
      reference;

    console.log("[buy-bundle][STEP-6b] Success — providerCode:", providerCode);

    if (!providerCode) {
      console.error("[buy-bundle][STEP-6b] No transaction code in response:", result.data);
      await abortPendingPurchase(
        admin, user.id, reference, balanceBefore,
        "Provider returned success without transaction code"
      );
      return NextResponse.json(
        { error: "Provider returned success without a transaction reference. Contact support." },
        { status: 502 }
      );
    }

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
      console.warn("[buy-bundle][STEP-6b] Primary update failed, trying fallback:", updateErr.message);
      await admin
        .from("transactions")
        .update(patch)
        .eq("user_id", user.id)
        .eq("transaction_code", reference);
    }

    void notifyAdminBundlePurchase({
      userId:          user.id,
      orderId:         String(providerCode),
      amountGhs:       p,
      dataAmount:      String(dataAmount),
      networkId:       Number(networkId),
      recipientMsisdn: recipient_msisdn,
    });

    console.log("[buy-bundle][STEP-6b] Purchase complete:", providerCode);
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