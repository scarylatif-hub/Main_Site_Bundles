import type { NetworkName } from "@/lib/definitions";
import { NETWORKS } from "@/lib/networks";

/** Display network id: 1 MTN, 2 Telecel, 3 AirtelTigo (AT-iShare) */
export const MTN_RETAIL_GHS: Record<number, number> = {
  1: 4.58,
  2: 9.16,
  3: 13.73,
  4: 18.2,
  5: 22.67,
  6: 26.92,
  8: 35.97,
  10: 43.06,
  15: 64.31,
  20: 85.02,
  25: 106.28,
  30: 129.71,
  40: 172.77,
  50: 213.64,
  100: 403.3,
};

export const TELECEL_RETAIL_GHS: Record<number, number> = {
  5: 22.89,
  10: 43.06,
  15: 65.4,
  20: 86.11,
  25: 109.0,
  30: 125.35,
  40: 166.77,
  50: 204.92,
  100: 403.3,
};

export const AIRTELTIGO_RETAIL_GHS: Record<number, number> = {
  1: 4.58,
  2: 9.27,
  3: 14.72,
  4: 19.62,
  5: 24.53,
  6: 28.78,
  7: 33.03,
  8: 37.28,
  10: 45.24,
  15: 68.4,
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
