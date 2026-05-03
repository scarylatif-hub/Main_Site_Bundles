import type { NetworkName } from "@/lib/definitions";
import { NETWORKS } from "@/lib/networks";

/** Display network id: 1 MTN, 2 Telecel, 3 AirtelTigo (AT-iShare) */
export const MTN_RETAIL_GHS: Record<number, number> = {
  1: 4.29,
  2: 8.59,
  3: 12.89,
  4: 17.91,
  5: 21.89,
  6: 25.79,
  7: 29.93,
  8: 34.89,
  9: 38.69,
  10: 41.99,
  12: 50.89,
  15: 63.99,
  18: 83.59,
  20: 81.69,
  22: 94.99,
  25: 100.99,
  30: 120.99,
  40: 159.99,
  50: 199.99,
  92: 335.99,
  100: 375.99,
  200: 599.99,
};

export const TELECEL_RETAIL_GHS: Record<number, number> = {
  5: 20.59,
  10: 41.19,
  15: 59.99,
  20: 79.39,
  30: 118.39,
  40: 159.39,
  50: 198.39,
};

export const AIRTELTIGO_RETAIL_GHS: Record<number, number> = {
  // AT - iSHare bundles (1-10GB)
  1: 4.29,
  2: 8.49,
  3: 12.69,
  4: 16.99,
  5: 21.19,
  6: 25.49,
  7: 29.69,
  8: 33.89,
  9: 36.89,
  10: 39.19,
  // AT - BigTime bundles (15-200GB)
  15: 58.99,
  20: 64.99,
  30: 75.99,
  40: 86.99,
  50: 97.99,
  60: 118.99,
  80: 139.99,
  100: 178.99,
  200: 319.99,
};

export function getRetailPriceGhs(
  displayNetworkId: number,
  gb: number
): number | null {
  const g = Number(gb);
  if (!Number.isFinite(g) || g <= 0) return null;
  const key = Number.isInteger(g) ? g : g;
  const map =
    displayNetworkId === 1
      ? MTN_RETAIL_GHS
      : displayNetworkId === 2
        ? TELECEL_RETAIL_GHS
        : displayNetworkId === 3
          ? AIRTELTIGO_RETAIL_GHS
          : null;
  if (!map) return null;
  return map[key] ?? null;
}

export function buildFallbackPackagesList(): Array<{
  id: string;
  network: { id: number; name: NetworkName };
  dataAmount: string;
  validity: string;
  price: number;
  sharedBundle: number;
}> {
  const out: Array<{
    id: string;
    network: { id: number; name: NetworkName };
    dataAmount: string;
    validity: string;
    price: number;
    sharedBundle: number;
  }> = [];

  for (const net of NETWORKS) {
    const map =
      net.id === 1
        ? MTN_RETAIL_GHS
        : net.id === 2
          ? TELECEL_RETAIL_GHS
          : AIRTELTIGO_RETAIL_GHS;
    for (const [gbStr, price] of Object.entries(map)) {
      const gb = Number(gbStr);
      out.push({
        id: `${net.name.toLowerCase()}-${gb}gb`,
        network: { id: net.id, name: net.name },
        dataAmount: `${gb} GB`,
        validity: "30 days",
        price,
        sharedBundle: gb,
      });
    }
  }
  return out;
}
