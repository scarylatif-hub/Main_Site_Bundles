/**
 * Format a number as a currency price in GHS
 */
export function formatPrice(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format a number as currency with GHS symbol
 */
export function formatCurrency(amount: number): string {
  return `GH₵${formatPrice(amount)}`;
}
