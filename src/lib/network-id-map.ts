/**
 * DataKazina provider network IDs:
 * AT-iSHare = 1, Telecel = 2, MTN = 3, AT-BigTime = 4, MTN AFA = 5
 *
 * Display network IDs (internal app):
 * MTN = 1, Telecel = 2, AirtelTigo = 3
 */

export function datakazinaNetworkIdToDisplay(datakazinaNetworkId: number): number {
  if (datakazinaNetworkId === 3 || datakazinaNetworkId === 5) return 1; // MTN
  if (datakazinaNetworkId === 2) return 2;                              // Telecel
  if (datakazinaNetworkId === 1 || datakazinaNetworkId === 4) return 3; // AT
  if (datakazinaNetworkId === 6) return 6;                              // MTN EXPRESS
  console.warn(`[network-id-map] Unknown DataKazina network_id: ${datakazinaNetworkId}`);
  return datakazinaNetworkId;
}

/**
 * Convert display network ID → DataKazina provider network ID.
 * Always prefer providerNetworkId if available (preserves AT-iSHare vs AT-BigTime).
 */
export function displayNetworkIdToDatakazina(
  displayNetworkId: number,
  providerNetworkId?: number | null
): number {
  // ✅ Always trust providerNetworkId — it's the exact ID from the packages API
  if (providerNetworkId != null && Number.isFinite(Number(providerNetworkId))) {
    return Math.trunc(Number(providerNetworkId));
  }
  if (displayNetworkId === 1) return 3; // MTN
  if (displayNetworkId === 6) return 6; // MTN EXPRESS
  if (displayNetworkId === 2) return 2; // Telecel
  if (displayNetworkId === 3) return 1; // AT (default to iSHare if no providerNetworkId)
  return displayNetworkId;
}

export function resolveDisplayNetworkId(input: {
  providerLabel?: string | null;
  providerNetworkId?: number | null;
  displayNetworkId?: number | null;
  displayNetworkName?: string | null;
}): number {
  // Use explicit displayNetworkId first (most reliable)
  if (input.displayNetworkId != null && Number.isFinite(Number(input.displayNetworkId))) {
    return Math.trunc(Number(input.displayNetworkId));
  }
  // Fall back to deriving from provider network ID
  if (input.providerNetworkId != null && Number.isFinite(Number(input.providerNetworkId))) {
    return datakazinaNetworkIdToDisplay(Math.trunc(Number(input.providerNetworkId)));
  }
  // Last resort: name-based lookup
  const fromDisplayName = displayNetworkIdFromProviderLabel(input.displayNetworkName);
  if (fromDisplayName != null) return fromDisplayName;
  const fromProviderLabel = displayNetworkIdFromProviderLabel(input.providerLabel);
  if (fromProviderLabel != null) return fromProviderLabel;
  return 1;
}

export function displayNetworkIdFromProviderLabel(
  name: string | null | undefined
): number | null {
  if (!name) return null;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n.includes("express") || n.includes("mtn express")) return 6; // MTN EXPRESS
  if (n.includes("mtn")) return 1;
  if (n.includes("telecel") || n.includes("vodafone")) return 2;
  if (
    n.includes("airtel") || n.includes("tigo") ||
    n.includes("ishare") || n.includes("bigtime") ||
    n === "at" || n.startsWith("at-") || n.startsWith("at ")
  ) return 3;
  return null;
}