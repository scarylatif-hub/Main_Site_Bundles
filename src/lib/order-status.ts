// src/lib/order-status.ts

/** Admin-editable / provider statuses */
export const ORDER_STATUSES = [
  "placed",
  "processing",
  "delivered",
  "canceled",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export function normalizeOrderStatus(s: string): string {
  return String(s).toLowerCase().trim();
}

/** What customers see: never "failed" (provider retries / re-places). */
export function statusForCustomer(raw: string | null | undefined): string {
  if (raw == null) return "placed";
  const s = normalizeOrderStatus(raw);
  if (s === "failed" || s === "fail" || s === "error") return "placed";
  if (s === "success" || s === "completed") return "delivered"; // fix: completed = delivered
  if (s === "pending") return "processing";
  return s;
}

export function isOrderStatusAllowed(s: string): boolean {
  return (ORDER_STATUSES as readonly string[]).includes(normalizeOrderStatus(s));
}

/** Maps provider / admin status strings to a badge bucket. */
export type OrderStatusDisplayBucket =
  | "placed"
  | "processing"
  | "delivered"
  | "canceled"
  | "other";

export function classifyOrderStatusForDisplay(
  raw: string | null | undefined
): OrderStatusDisplayBucket {
  if (raw == null || String(raw).trim() === "") return "other";
  const s = normalizeOrderStatus(raw);
  if (s === "placed") return "placed";
  if (s === "pending" || s === "processing") return "processing";
  if (s === "delivered" || s === "success" || s === "completed") return "delivered"; // fix
  if (s === "canceled" || s === "cancelled" || s === "failed" || s === "fail") return "canceled";
  return "other";
}