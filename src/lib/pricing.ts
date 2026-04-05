/**
 * Wholesale → retail: e.g. API 4.20 GHS → sell at 4.59 GHS.
 * Override with BUNDLE_RETAIL_MULTIPLIER (e.g. 1.0928571428571428 for 4.59/4.2).
 */
export function getRetailPriceMultiplier(): number {
  const raw = process.env.BUNDLE_RETAIL_MULTIPLIER;
  if (raw) {
    const n = parseFloat(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 4.59 / 4.2;
}

export function applyRetailPrice(wholesaleGhs: number): number {
  const m = getRetailPriceMultiplier();
  return Math.round(wholesaleGhs * m * 100) / 100;
}
