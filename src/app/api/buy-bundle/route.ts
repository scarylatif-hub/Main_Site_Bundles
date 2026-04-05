import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cheapBundlesPackagesUrl,
  getCheapBundlesApiKey,
} from "@/lib/cheap-bundles-config";
import { readFetchJson } from "@/lib/fetch-json";
import { normalizePhoneNumber } from "@/lib/networks";
import { displayNetworkIdToApi } from "@/lib/network-id-map";

function providerTxCode(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const o = result as Record<string, unknown>;
  const v = o.transaction_code ?? o.transactionCode ?? o.reference;
  return v != null ? String(v) : null;
}

function providerMessage(result: unknown): string {
  if (!result || typeof result !== "object") return "Unknown provider response";
  const o = result as Record<string, unknown>;
  const m = o.message ?? o.error ?? o.detail;
  return m != null ? String(m) : "Unknown external API error";
}

/**
 * Restore wallet and remove the pending purchase row (ledger stays consistent).
 */
async function abortPendingPurchase(
  admin: SupabaseClient,
  userId: string,
  reference: string,
  restoreBalance: number
): Promise<void> {
  await admin
    .from("profiles")
    .update({
      wallet_balance: restoreBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  await admin
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("reference", reference);
}

/**
 * POST /api/buy-bundle
 * 1) Verify session (SSR Supabase client).
 * 2) Debit wallet + insert transactions row (pending) with unique `reference`.
 * 3) Call provider server-side only.
 * 4) On success: set reference + transaction_code to provider id, status placed.
 * 5) On failure: refund wallet + delete pending row.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    recipientMsisdn?: string;
    networkId?: number;
    sharedBundle?: number;
    price?: number;
    dataAmount?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recipientMsisdn, networkId, sharedBundle, price, dataAmount } = body;

  if (
    !recipientMsisdn ||
    networkId === undefined ||
    networkId === null ||
    sharedBundle === undefined ||
    sharedBundle === null ||
    price === undefined ||
    !dataAmount
  ) {
    return NextResponse.json(
      { error: "Missing required fields for purchase" },
      { status: 400 }
    );
  }

  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const apiKey = getCheapBundlesApiKey();
  const buyUrl = cheapBundlesPackagesUrl("buy-other");
  if (!apiKey || !buyUrl) {
    console.error("Cheap Bundles API URL or Key is not configured.");
    return NextResponse.json(
      { error: "Internal server error: Service not configured" },
      { status: 500 }
    );
  }

  const recipient_msisdn = normalizePhoneNumber(String(recipientMsisdn));
  if (!recipient_msisdn || recipient_msisdn.length < 10) {
    return NextResponse.json(
      { error: "Invalid recipient phone number." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const reference = `loc-${crypto.randomUUID()}`;
  const description = `Purchase of ${dataAmount} for ${recipient_msisdn}`;

  const { data: prof, error: profileError } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  if (profileError || !prof) {
    console.error("buy-bundle profile:", profileError);
    return NextResponse.json(
      { error: "Could not retrieve user profile." },
      { status: 500 }
    );
  }

  const balanceBefore = Number(prof.wallet_balance);
  if (balanceBefore < p) {
    return NextResponse.json(
      { error: "Insufficient funds. Please top up your wallet." },
      { status: 400 }
    );
  }

  const balanceAfter = balanceBefore - p;
  const { error: walletErr } = await admin
    .from("profiles")
    .update({
      wallet_balance: balanceAfter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (walletErr) {
    console.error("buy-bundle wallet debit:", walletErr);
    return NextResponse.json(
      { error: "Could not update wallet." },
      { status: 500 }
    );
  }

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    reference,
    transaction_code: reference,
    status: "pending",
    transaction_type: "purchase",
    amount: -p,
    recipient_msisdn,
    network_id: networkId,
    shared_bundle: sharedBundle,
    bundle_amount: dataAmount,
    description,
  };

  const { error: insertErr } = await admin.from("transactions").insert(insertRow);

  if (insertErr) {
    console.error("buy-bundle pending insert:", insertErr);
    await admin
      .from("profiles")
      .update({
        wallet_balance: balanceBefore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    return NextResponse.json(
      { error: "Could not create order record." },
      { status: 500 }
    );
  }

  try {
    const apiNetworkId = displayNetworkIdToApi(Number(networkId));

    const externalApiResponse = await fetch(buyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        recipient_msisdn,
        network_id: apiNetworkId,
        shared_bundle: Number(sharedBundle),
        reference,
      }),
    });

    const { ok, status, data: result, rawText } =
      await readFetchJson(externalApiResponse);

    if (rawText.trim() === "") {
      console.error("External buy-other empty body", status);
      await abortPendingPurchase(admin, user.id, reference, balanceBefore);
      return NextResponse.json(
        { error: "Provider returned an empty response.", code: "PROVIDER_EMPTY" },
        { status: status >= 400 ? status : 502 }
      );
    }

    if (!ok) {
      const msg =
        result && typeof result === "object"
          ? providerMessage(result)
          : rawText.slice(0, 400);
      console.warn("External buy-other HTTP", status, msg);

      if (
        status === 409 ||
        /already in progress/i.test(msg) ||
        /please wait or check existing orders/i.test(msg) ||
        /duplicate|conflicting transaction/i.test(msg)
      ) {
        await abortPendingPurchase(admin, user.id, reference, balanceBefore);
        return NextResponse.json(
          {
            error:
              msg ||
              "Duplicate or conflicting transaction: the provider already has an order in progress for this number and bundle size. Wait or check My Orders.",
            code: "ORDER_IN_PROGRESS",
            httpStatus: 409,
          },
          { status: 409 }
        );
      }

      await abortPendingPurchase(admin, user.id, reference, balanceBefore);
      return NextResponse.json(
        {
          error: msg || `Provider request failed (${status})`,
          code: "PROVIDER_ERROR",
        },
        { status: status >= 400 ? status : 502 }
      );
    }

    const success =
      typeof result === "object" &&
      result !== null &&
      (result as { success?: boolean }).success === true;

    if (!success) {
      await abortPendingPurchase(admin, user.id, reference, balanceBefore);
      return NextResponse.json(
        {
          error:
            providerMessage(result) || "Failed to purchase bundle from provider",
        },
        { status: 400 }
      );
    }

    const providerCode = providerTxCode(result);
    if (!providerCode) {
      console.error("Provider success but missing transaction_code:", result);
      await abortPendingPurchase(admin, user.id, reference, balanceBefore);
      return NextResponse.json(
        {
          error:
            "Provider returned success without a transaction reference. Contact support.",
        },
        { status: 502 }
      );
    }

    const patch = {
      reference: providerCode,
      transaction_code: providerCode,
      status: "placed",
      description,
    };

    let { error: updateErr } = await admin
      .from("transactions")
      .update(patch)
      .eq("user_id", user.id)
      .eq("reference", reference);

    if (updateErr) {
      ({ error: updateErr } = await admin
        .from("transactions")
        .update(patch)
        .eq("user_id", user.id)
        .eq("transaction_code", reference));
    }

    if (updateErr) {
      console.error("buy-bundle post-provider update:", updateErr);
      return NextResponse.json(
        {
          success: true,
          warning:
            "Purchase succeeded but updating your order record failed. Contact support with this reference.",
          transaction_code: providerCode,
          reference: providerCode,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_code: providerCode,
      reference: providerCode,
      ...(typeof result === "object" && result !== null ? result : {}),
    });
  } catch (error: unknown) {
    console.error("Unhandled error in /api/buy-bundle:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    await abortPendingPurchase(admin, user.id, reference, balanceBefore);
    return NextResponse.json(
      { error: "Internal server error", details: msg },
      { status: 500 }
    );
  }
}
