/**
 * Minimum allowed prices for reseller stores
 * These are the exact prices from the main site - no store owner can set prices below these
 */

export const MINIMUM_PRICES: Record<string, Record<number, number>> = {
  MTN: {
    1: 4.29,
    2: 8.58,
    3: 12.87,
    4: 17.16,
    5: 21.44,
    6: 25.73,
    7: 30.02,
    8: 34.31,
    9: 38.60,
    10: 41.80,
    12: 50.16,
    15: 62.70,
    18: 82.50,
    20: 83.60,
    22: 97.90,
    25: 104.50,
    30: 125.40,
    40: 166.10,
    50: 209.00,
    92: 352.00,
    100: 396.00,
    200: 638.00,
  },
  TELECEL: {
    5: 20.61,
    10: 40.70,
    15: 60.50,
    20: 80.30,
    30: 118.80,
    40: 157.30,
    50: 195.80,
  },
  AIRTELTIGO: {
    1: 4.23,
    2: 8.47,
    3: 12.70,
    4: 16.93,
    5: 21.17,
    6: 25.40,
    7: 29.63,
    8: 33.87,
    9: 37.88,
    10: 40.70,
    15: 60.50,
    20: 60.50,
    30: 71.50,
    40: 82.50,
    50: 93.50,
    60: 115.50,
    80: 137.50,
    100: 176.00,
    200: 319.00,
  },
};

/**
 * Get minimum price for a network and bundle size
 * @param networkName - Network name (MTN, TELECEL, AIRTELTIGO)
 * @param bundleSize - Bundle size in GB
 * @returns Minimum price or null if not found
 */
export function getMinimumPrice(networkName: string, bundleSize: number): number | null {
  const upperNetwork = networkName.toUpperCase();
  const networkPrices = MINIMUM_PRICES[upperNetwork];
  
  if (!networkPrices) return null;
  
  // Exact match first
  if (networkPrices[bundleSize] !== undefined) {
    return networkPrices[bundleSize];
  }
  
  // Find closest lower price if exact match not found
  const sizes = Object.keys(networkPrices).map(Number).sort((a, b) => a - b);
  for (const size of sizes) {
    if (size >= bundleSize) {
      return networkPrices[size];
    }
  }
  
  // Return highest price if bundle is larger than all defined sizes
  return networkPrices[sizes[sizes.length - 1]] || null;
}
