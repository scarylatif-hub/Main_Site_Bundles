/**
 * DataKazina API network IDs vs our app display format.
 * Display format: MTN=1, Telecel=2, AirtelTigo=3
 * 
 * Actual DataKazina format from API:
 * - MTN: 3
 * - Telecel: 4
 * - AirtelTigo (AT - iSHare): 1
 * - AirtelTigo (AT - BigTime): 2
 */
export function datakazinaNetworkIdToDisplay(datakazinaNetworkId: number): number {
  if (datakazinaNetworkId === 3) return 1;  // DataKazina MTN → Display MTN
  if (datakazinaNetworkId === 4) return 2;  // DataKazina Telecel → Display Telecel
  if (datakazinaNetworkId === 1) return 3;  // DataKazina AT-iSHare → Display AirtelTigo
  if (datakazinaNetworkId === 2) return 3;  // DataKazina AT-BigTime → Display AirtelTigo
  return datakazinaNetworkId;
}

export function displayNetworkIdToDatakazina(displayNetworkId: number): number {
  if (displayNetworkId === 1) return 3;  // Display MTN → DataKazina MTN
  if (displayNetworkId === 2) return 4;  // Display Telecel → DataKazina Telecel
  if (displayNetworkId === 3) return 1;  // Display AirtelTigo → DataKazina AT-iSHare (use iSHare as default)
  return displayNetworkId;
}

export function displayNetworkIdFromProviderLabel(
  name: string | null | undefined
): number | null {
  if (!name) return null;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n.includes("mtn")) return 1;
  if (n.includes("telecel") || n.includes("vodafone")) return 2;
  if (
    n.includes("airtel") ||
    n.includes("tigo") ||
    n.includes("ishare") ||
    n.includes("bigtime") ||
    n === "at" ||
    n.startsWith("at-") ||
    n.startsWith("at ")
  ) {
    return 3;
  }
  return null;
}

export function resolveDisplayNetworkId(input: {
  providerLabel?: string | null;
  providerNetworkId?: number | null;
  displayNetworkId?: number | null;
  displayNetworkName?: string | null;
}): number {
  const fromDisplayName = displayNetworkIdFromProviderLabel(
    input.displayNetworkName
  );
  if (fromDisplayName != null) return fromDisplayName;

  const fromProviderLabel = displayNetworkIdFromProviderLabel(
    input.providerLabel
  );
  if (fromProviderLabel != null) return fromProviderLabel;

  if (
    input.displayNetworkId != null &&
    Number.isFinite(Number(input.displayNetworkId))
  ) {
    return Math.trunc(Number(input.displayNetworkId));
  }

  if (
    input.providerNetworkId != null &&
    Number.isFinite(Number(input.providerNetworkId))
  ) {
    return datakazinaNetworkIdToDisplay(Math.trunc(Number(input.providerNetworkId)));
  }

  return 1;
}
