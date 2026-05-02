/**
 * src/app/api/debug/datakazina/route.ts
 *
 * Dev-only. DELETE before production.
 *
 * GET  /api/debug/datakazina          — full health check
 * GET  /api/debug/datakazina?probe=1  — also sends a real purchase request
 *                                       with a dummy number (will fail at
 *                                       provider level but tells us the exact
 *                                       error + response shape)
 */

import { NextRequest, NextResponse } from "next/server";
import { datakazinaAPI }              from "@/lib/datakazina";

export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.has("probe");
  const report: Record<string, unknown> = {};

  // 1. Env vars
  report.env = {
    DATAKAZINA_API_KEY_SET:     !!process.env.DATAKAZINA_API_KEY,
    DATAKAZINA_BASE_URL:        process.env.DATAKAZINA_BASE_URL ?? "(not set)",
    DATAKAZINA_KEY_PREVIEW:     process.env.DATAKAZINA_API_KEY?.slice(0, 6) + "…",
    PAYSTACK_SECRET_KEY_SET:    !!process.env.PAYSTACK_SECRET_KEY,
  };

  // 2. Console balance
  try {
    const r = await datakazinaAPI.checkConsoleBalance();
    report.consoleBalance = r.ok
      ? { ok: true,  data: r.data }
      : { ok: false, status: r.status, rawText: r.rawText };
  } catch (e) {
    report.consoleBalance = { ok: false, error: String(e) };
  }

  // 3. Package list
  try {
    const r = await datakazinaAPI.fetchDataPackages();
    if (!r.ok) {
      report.packages = { ok: false, status: r.status, rawText: r.rawText };
    } else {
      const pkgs = r.data;
      report.packages = {
        ok:    true,
        count: pkgs.length,
        // First 3 packages with all fields visible
        sample: pkgs.slice(0, 3),
        networkIds: [...new Set(pkgs.map((p) => p.network_id))],
        // These are the values that get passed as shared_bundle
        bundleIds:  pkgs.slice(0, 20).map((p) => ({ id: p.id, label: p.volumeGB, network: p.network })),
      };
    }
  } catch (e) {
    report.packages = { ok: false, error: String(e) };
  }

  // 4. Correct purchase endpoint info
  report.purchaseEndpoint = {
    correct_url:   `${process.env.DATAKAZINA_BASE_URL}/buy-data-package?`,
    wrong_url:     `${process.env.DATAKAZINA_BASE_URL}/purchase  ← old code used this, now fixed`,
    note:          "Postman docs show trailing ? in the URL — we send it",
    example_body:  {
      recipient_msisdn: "0551053716",
      network_id:       3,
      shared_bundle:    12,
      incoming_api_ref: "unique_reference_003",
    },
  };

  // 5. Optional: actually probe the endpoint with a dummy request
  //    Visit /api/debug/datakazina?probe=1 to run this.
  //    The dummy number will likely cause a provider-level error,
  //    but we'll see the EXACT response shape DataKazina returns.
  if (probe) {
    try {
      const r = await datakazinaAPI.purchaseDataPackage({
        recipient_msisdn: "0200000000", // obviously fake
        network_id:       3,
        shared_bundle:    1,
        incoming_api_ref: `debug-probe-${Date.now()}`,
      });
      report.purchaseProbe = {
        http_status: r.status,
        ok:          r.ok,
        rawText:     r.rawText,   // ← this is the KEY field — shows the real response
        data:        r.ok ? r.data : null,
        verdict:     r.ok
          ? "2xx — endpoint reachable, purchase accepted (or silently ignored)"
          : "non-2xx — endpoint reachable, provider returned an error (expected for dummy number)",
      };
    } catch (e) {
      report.purchaseProbe = {
        error:   String(e),
        verdict: "fetch threw — network issue or completely wrong URL",
      };
    }
  } else {
    report.purchaseProbe = "Not run. Add ?probe=1 to the URL to test the actual endpoint.";
  }

  return NextResponse.json(report, { status: 200 });
}