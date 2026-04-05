/**
 * Env should be the site origin only, e.g. https://cheap-bundles-ghana.azurewebsites.net
 * If the full packages base URL was pasted, it is normalized to origin.
 */
const PACKAGES_PATH = "/api/external/packages";

export function getCheapBundlesApiKey(): string | undefined {
  return process.env.CHEAP_BUNDLES_API_KEY || process.env.EXTERNAL_API_KEY;
}

/** Origin/base URL with no trailing slash (no /api/... suffix). */
export function getCheapBundlesOrigin(): string | undefined {
  const raw = process.env.CHEAP_BUNDLES_API_URL || process.env.EXTERNAL_API_URL;
  if (!raw) return undefined;
  let u = raw.trim().replace(/\/+$/, "");
  const suffix = PACKAGES_PATH.toLowerCase();
  if (u.toLowerCase().endsWith(suffix)) {
    u = u.slice(0, -PACKAGES_PATH.length).replace(/\/+$/, "");
  }
  return u || undefined;
}

export function cheapBundlesPackagesUrl(
  segment: "buy-other" | "all-orders" | "all-packages" | "all-orders-by-transaction"
): string | null {
  const origin = getCheapBundlesOrigin();
  if (!origin) return null;
  return `${origin}${PACKAGES_PATH}/${segment}`;
}

/**
 * Provider `all-orders` URL. Optional env `CHEAP_BUNDLES_ALL_ORDERS_QUERY` appends
 * query params (e.g. `limit=5000` or `pageSize=1000`) if your API paginates by default.
 */
export function cheapBundlesAllOrdersRequestUrl(): string | null {
  const base = cheapBundlesPackagesUrl("all-orders");
  if (!base) return null;
  const extra = process.env.CHEAP_BUNDLES_ALL_ORDERS_QUERY?.trim();
  if (!extra) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${extra}`;
}

export function getCheapBundlesConfig(): {
  apiKey: string | undefined;
  apiUrl: string | undefined;
} {
  return {
    apiKey: getCheapBundlesApiKey(),
    apiUrl: getCheapBundlesOrigin(),
  };
}
