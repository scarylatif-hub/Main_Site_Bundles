/**
 * Wholesale → retail: e.g. API 3.85 GHS → sell at 4.38 GHS (14% markup).
 * Override with BUNDLE_RETAIL_MULTIPLIER (e.g. 1.14 for 14% markup).
 */
export function getRetailPriceMultiplier(): number {
  const raw = process.env.BUNDLE_RETAIL_MULTIPLIER;
  if (raw) {
    const n = parseFloat(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 1.13; // 14% markup for main website
}

export function applyRetailPrice(wholesaleGhs: number): number {
  const m = getRetailPriceMultiplier();
  return Math.round(wholesaleGhs * m * 100) / 100;
}
