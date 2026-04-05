/**
 * Provider API swaps MTN vs AirtelTigo network_id vs our app (1=MTN, 2=Telecel, 3=AirtelTigo).
 * Map API → display and display → API for buy-other.
 */
export function apiNetworkIdToDisplay(apiNetworkId: number): number {
  if (apiNetworkId === 1) return 3;
  if (apiNetworkId === 3) return 1;
  return apiNetworkId;
}

export function displayNetworkIdToApi(displayNetworkId: number): number {
  if (displayNetworkId === 1) return 3;
  if (displayNetworkId === 3) return 1;
  return displayNetworkId;
}
