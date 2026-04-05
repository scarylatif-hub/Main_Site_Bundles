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
  if (s === "success" || s === "completed") return "placed";
  if (s === "pending") return "processing";
  return s;
}

export function isOrderStatusAllowed(s: string): boolean {
  return (ORDER_STATUSES as readonly string[]).includes(normalizeOrderStatus(s));
}
