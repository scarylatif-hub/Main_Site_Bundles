export function normalizeStatusForEarnings(raw: unknown): string {
  const status = String(raw ?? "").trim().toLowerCase();

  if (["delivered", "completed", "success"].includes(status)) {
    return "delivered";
  }

  if (["processing", "pending", "in_progress", "in-progress"].includes(status)) {
    return "processing";
  }

  if (["failed", "fail", "error", "canceled", "cancelled"].includes(status)) {
    return "canceled";
  }

  return status;
}

export function isSuccessfulEarningStatus(raw: unknown): boolean {
  return normalizeStatusForEarnings(raw) === "delivered";
}

export function isAccruedEarningStatus(raw: unknown): boolean {
  const normalized = normalizeStatusForEarnings(raw);
  return normalized === "delivered" || normalized === "processing";
}

export function computeResellerProfitGhs(input: {
  amount: unknown;
  consolePrice: unknown;
}): number {
  const amount = Number(input.amount || 0);
  const consolePrice = Number(input.consolePrice || 0);
  const adminMarkup = 0.14;
  const resellerCost = consolePrice * (1 + adminMarkup);
  const profit = amount - resellerCost;
  return profit > 0 ? profit : 0;
}

type ResellerEarningsSummary = {
  lifetimeEarnings: number;
  availableEarnings: number;
  transferredAmount: number;
  pendingWithdrawalAmount: number;
};

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Single source of truth for reseller earnings used by stats and payout routes.
 */
export async function computeResellerEarningsSummary(
  admin: any,
  userId: string
): Promise<ResellerEarningsSummary> {
  const { data: orderRows } = await admin
    .from("orders")
    .select("id,reseller_profit,status")
    .eq("store_id", userId);

  let lifetimeEarnings = 0;
  // Track only orders where we actually consumed a non-null reseller_profit from `orders`.
  // If `orders.reseller_profit` is null, we should still allow fallback from `profit_records`.
  const accountedOrderIds = new Set<string>();

  for (const order of orderRows || []) {
    if (!isAccruedEarningStatus(order.status)) continue;
    const profitValue = order.reseller_profit;
    if (profitValue === null || profitValue === undefined) continue;
    accountedOrderIds.add(String(order.id));
    lifetimeEarnings += Number(profitValue || 0);
  }

  // Backfill older orders that may have null orders.reseller_profit but have profit_records.
  const { data: profitRows } = await admin
    .from("profit_records")
    .select("order_id,reseller_profit")
    .eq("store_id", userId);

  for (const row of profitRows || []) {
    const orderId = String(row.order_id || "");
    if (orderId && accountedOrderIds.has(orderId)) continue;
    lifetimeEarnings += Number(row.reseller_profit || 0);
  }

  const { data: transferRows } = await admin
    .from("earnings_to_wallet_transfers")
    .select("amount,method,status")
    .eq("user_id", userId)
    .eq("source", "earnings");

  let transferredAmount = 0;
  let pendingWithdrawalAmount = 0;

  for (const row of transferRows || []) {
    const amount = Number(row.amount || 0);
    const method = String(row.method || "").toLowerCase();
    const status = String(row.status || "").toLowerCase();

    if (status === "completed") {
      transferredAmount += amount;
    }

    if (
      method === "momo" &&
      (status === "pending" || status === "processing" || status === "approved")
    ) {
      pendingWithdrawalAmount += amount;
    }
  }

  const availableEarnings = Math.max(
    0,
    lifetimeEarnings - transferredAmount - pendingWithdrawalAmount
  );

  return {
    lifetimeEarnings: round2(lifetimeEarnings),
    availableEarnings: round2(availableEarnings),
    transferredAmount: round2(transferredAmount),
    pendingWithdrawalAmount: round2(pendingWithdrawalAmount),
  };
}
