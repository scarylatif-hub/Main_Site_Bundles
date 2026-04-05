import { createAdminClient } from "@/lib/supabase/admin";

export type PaystackVerifyData = {
  status: string;
  reference: string;
  amount: number;
  metadata?: {
    userId?: string;
    user_id?: string;
    type?: string;
    description?: string;
    creditAmountGhs?: string;
  };
};

function paystackUserId(
  meta?: PaystackVerifyData["metadata"] | Record<string, unknown>
): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const u = m.userId ?? m.user_id;
  return u != null && String(u).trim() !== "" ? String(u) : undefined;
}

export function resolveCreditGhsFromPaystackData(data: PaystackVerifyData): number {
  const meta = data.metadata;
  const type = meta?.type?.toLowerCase();
  let amountGhs = data.amount / 100;
  if (
    (type === "deposit" ||
      type === "wallet_deposit" ||
      type === "wallet") &&
    meta?.creditAmountGhs != null
  ) {
    const credit = Number(meta.creditAmountGhs);
    if (!Number.isNaN(credit) && credit > 0) {
      amountGhs = credit;
    }
  }
  return amountGhs;
}

type ClaimResult = { credited: boolean; reason?: string };

async function claimPaystackDeposit(
  reference: string,
  userId: string,
  creditAmountGhs: number,
  description: string
): Promise<ClaimResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_paystack_deposit", {
    p_reference: reference,
    p_user_id: userId,
    p_credit_amount_ghs: creditAmountGhs,
    p_description: description,
  });

  if (error) {
    if (
      error.message?.includes("claim_paystack_deposit") ||
      error.code === "42883"
    ) {
      console.error(
        "claim_paystack_deposit missing — run migrations/005_payment_events.sql in Supabase:",
        error.message
      );
    } else {
      console.error("claim_paystack_deposit RPC error:", error);
    }
    return { credited: false, reason: "rpc_error" };
  }

  const row = data as { credited?: boolean; reason?: string } | null;
  if (row?.credited === true) {
    return { credited: true, reason: "ok" };
  }
  if (row?.reason === "already_processed") {
    return { credited: false, reason: "already_processed" };
  }
  return { credited: false, reason: row?.reason ?? "unknown" };
}

export async function hasPaymentEventForReference(
  reference: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_events")
    .select("id")
    .eq("reference", reference)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Ledger already has a deposit for this Paystack reference — wallet was credited once.
 * Checks transaction_code and (if column exists) reference.
 */
export async function hasExistingDepositForReference(
  reference: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: byCode } = await admin
    .from("transactions")
    .select("id")
    .eq("transaction_type", "deposit")
    .eq("transaction_code", reference)
    .maybeSingle();
  if (byCode) return true;

  const { data: byRef, error } = await admin
    .from("transactions")
    .select("id")
    .eq("transaction_type", "deposit")
    .eq("reference", reference)
    .maybeSingle();

  if (
    error &&
    (error.code === "42703" ||
      String(error.message).toLowerCase().includes("reference"))
  ) {
    return false;
  }
  return Boolean(byRef);
}

async function backfillPaymentEventRow(params: {
  reference: string;
  userId: string;
  amountGhs: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("payment_events").insert({
    reference: params.reference,
    status: "success",
    amount: params.amountGhs,
    user_id: params.userId,
  });
  if (error && error.code !== "23505") {
    console.warn("payment_events backfill:", error.message);
  }
}

/**
 * Signed webhook / verified API payload: attempt one-time credit (DB unique on reference).
 */
export async function processPaystackChargeFromProvider(params: {
  reference: string;
  amountPesewas: number;
  metadata?: PaystackVerifyData["metadata"];
}): Promise<ClaimResult> {
  const userId = paystackUserId(params.metadata);
  if (!userId) {
    console.error("Paystack: missing userId/user_id in metadata", params.reference);
    return { credited: false, reason: "no_user" };
  }

  const data: PaystackVerifyData = {
    status: "success",
    reference: params.reference,
    amount: params.amountPesewas,
    metadata: params.metadata,
  };
  const amountGhs = resolveCreditGhsFromPaystackData(data);
  const description =
    params.metadata?.description || `Paystack deposit: ${params.reference}`;

  if (await hasPaymentEventForReference(params.reference)) {
    return { credited: false, reason: "already_processed" };
  }

  if (await hasExistingDepositForReference(params.reference)) {
    await backfillPaymentEventRow({
      reference: params.reference,
      userId,
      amountGhs,
    });
    return { credited: false, reason: "already_processed" };
  }

  return claimPaystackDeposit(
    params.reference,
    userId,
    amountGhs,
    description
  );
}

/**
 * After Paystack verify API returns success — same idempotent claim as webhook.
 */
export async function creditWalletFromPaystackSuccess(
  data: PaystackVerifyData
): Promise<ClaimResult> {
  if (data.status !== "success") {
    return { credited: false, reason: "not_success" };
  }
  return processPaystackChargeFromProvider({
    reference: data.reference,
    amountPesewas: data.amount,
    metadata: data.metadata,
  });
}

export type VerifyFlowResult = {
  ok: boolean;
  success: boolean;
  credited?: boolean;
  reason?: string;
  source?: string;
  reference?: string;
  message?: string;
};

/**
 * Browser / redirect verify path: if webhook already credited, skip Paystack HTTP call;
 * else verify with Paystack then claim (race-safe via UNIQUE(reference)).
 */
export async function completePaystackDepositVerification(options: {
  reference: string;
  sessionUserId?: string;
}): Promise<VerifyFlowResult> {
  const { reference, sessionUserId } = options;

  if (await hasPaymentEventForReference(reference)) {
    return {
      ok: true,
      success: true,
      credited: true,
      reason: "already_processed",
      source: "existing",
      reference,
    };
  }

  if (await hasExistingDepositForReference(reference)) {
    return {
      ok: true,
      success: true,
      credited: true,
      reason: "already_processed",
      source: "legacy_ledger",
      reference,
    };
  }

  let verified: Awaited<ReturnType<typeof fetchPaystackTransaction>>;
  try {
    verified = await fetchPaystackTransaction(reference);
  } catch (e) {
    console.error("fetchPaystackTransaction:", e);
    return {
      ok: false,
      success: false,
      message: e instanceof Error ? e.message : "verify_failed",
      reference,
    };
  }

  if (!verified.ok) {
    return {
      ok: true,
      success: false,
      message: verified.message,
      reference,
    };
  }

  const d = verified.data;
  if (d.status !== "success") {
    return {
      ok: true,
      success: false,
      message: "not_success",
      reference: d.reference,
    };
  }

  const metaUserId = paystackUserId(d.metadata);
  if (!metaUserId) {
    return {
      ok: true,
      success: false,
      reason: "no_user",
      reference: d.reference,
    };
  }
  if (sessionUserId && metaUserId !== sessionUserId) {
    return {
      ok: false,
      success: false,
      message: "forbidden",
      reference: d.reference,
    };
  }

  const result = await creditWalletFromPaystackSuccess(d);

  if (result.credited) {
    return {
      ok: true,
      success: true,
      credited: true,
      reason: result.reason,
      source: "verify",
      reference: d.reference,
    };
  }

  if (result.reason === "already_processed") {
    return {
      ok: true,
      success: true,
      credited: true,
      reason: "already_processed",
      source: "webhook_won_race",
      reference: d.reference,
    };
  }

  return {
    ok: true,
    success: result.reason === "not_success" ? false : true,
    credited: false,
    reason: result.reason,
    source: "verify",
    reference: d.reference,
  };
}

export async function fetchPaystackTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("Paystack not configured");
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    }
  );

  const json = await res.json();
  if (!res.ok || !json.status) {
    return { ok: false as const, message: json.message || "verify_failed" };
  }

  return { ok: true as const, data: json.data as PaystackVerifyData };
}
