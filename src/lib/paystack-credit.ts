import { createAdminClient } from "@/lib/supabase/admin";

type PaystackVerifyData = {
  status: string;
  reference: string;
  amount: number;
  metadata?: {
    userId?: string;
    type?: string;
    description?: string;
    creditAmountGhs?: string;
  };
};

/**
 * Idempotent: credits wallet only once per Paystack reference.
 */
export async function creditWalletFromPaystackSuccess(
  data: PaystackVerifyData
): Promise<{ credited: boolean; reason?: string }> {
  if (data.status !== "success") {
    return { credited: false, reason: "not_success" };
  }

  const reference = data.reference;
  const userId = data.metadata?.userId;
  if (!userId) {
    return { credited: false, reason: "no_user" };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("transactions")
    .select("id")
    .eq("transaction_type", "deposit")
    .or(
      `transaction_code.eq.${reference},reference.eq.${reference}`
    )
    .maybeSingle();

  if (existing) {
    return { credited: false, reason: "already_processed" };
  }

  const meta = data.metadata;
  const type = meta?.type?.toLowerCase();
  let amountGhs = data.amount / 100;
  if (type === "deposit" && meta?.creditAmountGhs != null) {
    const credit = Number(meta.creditAmountGhs);
    if (!Number.isNaN(credit) && credit > 0) {
      amountGhs = credit;
    }
  }
  const description =
    meta?.description || `Paystack deposit: ${reference}`;

  const { error: rpcError } = await admin.rpc("add_to_wallet_and_log_transaction", {
    p_user_id: userId,
    p_amount: amountGhs,
    p_transaction_type: "deposit",
    p_status: "success",
    p_transaction_code: reference,
    p_description: description,
  });

  if (rpcError) {
    console.error("creditWalletFromPaystackSuccess RPC error:", rpcError);
    return { credited: false, reason: "rpc_error" };
  }

  return { credited: true };
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
