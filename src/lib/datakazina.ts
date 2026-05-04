/**
 * src/lib/datakazina.ts
 *
 * DataKazina reseller API client.
 *
 * KEY FACTS from the official Postman collection:
 *  - Purchase endpoint: POST /buy-data-package   (NOT /purchase)
 *  - Bulk endpoint:     POST /buy-bulk-data-packages
 *  - Packages endpoint: GET  /fetch-data-packages
 *  - Auth:              x-api-key header
 *  - Response body:     not documented — we log whatever comes back
 *    and treat any 2xx as success.
 */

const API_KEY  = process.env.DATAKAZINA_API_KEY;
const BASE_URL = process.env.DATAKAZINA_BASE_URL; // https://reseller.dakazinabusinessconsult.com/api/v1
const MAIN_BASE_URL = process.env.DATAKAZINA_MAIN_BASE_URL; // Main DataKazina endpoint

if (!API_KEY || !BASE_URL) {
  console.warn("[datakazina] Missing env vars", {
    hasApiKey:  !!API_KEY,
    hasBaseUrl: !!BASE_URL,
  });
}

// ── Result type ───────────────────────────────────────────────────────────────

export type DKResult<T = Record<string, unknown>> =
  | { ok: true;  data: T;    status: number; rawText: string }
  | { ok: false; data: null; status: number; rawText: string };

// ── Package shape (from /fetch-data-packages) ─────────────────────────────────

export type DataPackage = {
  id:            number;   // THIS is what you pass as shared_bundle
  network_id:    number;
  volumeGB:      string;   // e.g. "1GB"
  volume:        string;   // e.g. "1"
  console_price: string;   // comes back as a string e.g. "3.85"
  status:        string;   // "In Stock"
  network:       string;   // "MTN"
  name:          string | null;
  description:   string | null;
  [key: string]: unknown;
};

// ── Purchase param shape ──────────────────────────────────────────────────────

export type PurchaseParams = {
  recipient_msisdn: string;   // e.g. "0551053716"
  network_id:       number;   // e.g. 3
  shared_bundle:    number;   // DataKazina package id e.g. 12
  incoming_api_ref: string;   // your unique reference
};

// ── Client ────────────────────────────────────────────────────────────────────

class DataKazinaAPI {
  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Accept":        "application/json",
      "x-api-key":     API_KEY ?? "",
    };
  }

  // ── Core fetch wrapper ──────────────────────────────────────────────────────

  private async request<T = Record<string, unknown>>(
    path:    string,
    options: RequestInit = {},
    useMainEndpoint: boolean = false
  ): Promise<DKResult<T>> {
    const baseUrl = useMainEndpoint && MAIN_BASE_URL ? MAIN_BASE_URL : BASE_URL;
    const url = `${baseUrl}${path}`;
    const endpointLabel = useMainEndpoint && MAIN_BASE_URL ? " (main endpoint)" : "";
    // Removed URL logging to prevent exposing API endpoints in console

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...(options.headers as Record<string, string> ?? {}) },
      });

      // Always capture the raw text first — the response might not be JSON
      const rawText = await response.text();
      // Removed raw response logging to prevent exposing API responses in console

      if (!response.ok) {
        return { ok: false, data: null, status: response.status, rawText };
      }

      // Try to parse as JSON — if it fails, treat the raw text as the "data"
      let parsed: unknown;
      try {
        parsed = rawText.trim() ? JSON.parse(rawText) : {};
      } catch {
        // 2xx but non-JSON body — still a success
        console.warn("[datakazina] 2xx response was not JSON");
        parsed = { raw: rawText };
      }

      // DataKazina sometimes wraps in { data: ... } and sometimes doesn't
      const unwrapped =
        parsed != null &&
        typeof parsed === "object" &&
        "data" in (parsed as object) &&
        (parsed as Record<string, unknown>).data != null
          ? (parsed as Record<string, unknown>).data
          : parsed;

      return {
        ok:      true,
        data:    unwrapped as T,
        status:  response.status,
        rawText,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error(`[datakazina] fetch threw:`, msg);
      return { ok: false, data: null, status: 0, rawText: msg };
    }
  }

  // ── Public methods ──────────────────────────────────────────────────────────

  /** GET /fetch-data-packages */
  fetchDataPackages(): Promise<DKResult<DataPackage[]>> {
    return this.request<DataPackage[]>("/fetch-data-packages");
  }

  /** GET /fetch-transactions */
  fetchTransactions(): Promise<DKResult<unknown[]>> {
    return this.request<unknown[]>("/fetch-transactions", {}, true); // Use main endpoint for main site orders
  }

  /** GET /check-console-balance */
  checkConsoleBalance(): Promise<DKResult<{ "Wallet Balance": string }>> {
    return this.request<{ "Wallet Balance": string }>("/check-console-balance");
  }

  /**
   * POST /buy-data-package
   *
   * Official endpoint per Postman docs.
   * The trailing `?` is intentional — the real cURL in the docs is
   * `/buy-data-package?=null` which means the server may require a
   * query string to be present (even empty). We send `?` to satisfy that.
   *
   * @param useMainEndpoint - If true, uses DATAKAZINA_MAIN_BASE_URL instead of DATAKAZINA_BASE_URL
   */
  purchaseDataPackage(params: PurchaseParams, useMainEndpoint: boolean = false): Promise<DKResult> {
    // Removed param logging to prevent exposing sensitive data in console
    return this.request("/buy-data-package?", {
      method: "POST",
      body:   JSON.stringify(params),
    }, useMainEndpoint);
  }

  /**
   * POST /buy-bulk-data-packages
   */
  purchaseBulkDataPackages(params: { orders: PurchaseParams[] }): Promise<DKResult> {
    // Removed count logging to prevent exposing sensitive data in console
    return this.request("/buy-bulk-data-packages", {
      method: "POST",
      body:   JSON.stringify(params),
    });
  }
}

export const datakazinaAPI = new DataKazinaAPI();