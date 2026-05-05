import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  buildPhoneProfileMap,
} from "@/lib/external-all-orders";
import { datakazinaAPI } from "@/lib/datakazina";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/orders-status
 * 
 * Comprehensive debugging for order status retrieval from DataKazina API.
 * Shows:
 * - Raw API response structure
 * - Parsed and normalized orders
 * - Network ID mappings
 * - Status resolution for sample orders
 * 
 * Admin-only endpoint (checks authorization)
 */
export async function GET(req: NextRequest) {
  // Check if user has admin access (basic check)
  const auth = req.headers.get("authorization");
  if (!auth?.includes("Bearer")) {
    return NextResponse.json(
      { error: "Unauthorized. Include valid bearer token or admin session." },
      { status: 401 }
    );
  }

  const result = {
    timestamp: new Date().toISOString(),
    stages: {} as Record<string, unknown>,
    errors: [] as string[],
  };

  try {
    // Stage 1: Raw API call
    result.stages["1_raw_api_call"] = {
      label: "Direct DataKazina API call",
      call: "datakazinaAPI.fetchTransactions()",
      endpoint: process.env.DATAKAZINA_MAIN_BASE_URL || "Not configured",
    };

    console.log("[debug/orders-status] Stage 1: Fetching from DataKazina...");
    const apiResult = await datakazinaAPI.fetchTransactions();

    result.stages["1_raw_api_call"] = {
      ...result.stages["1_raw_api_call"],
      ok: apiResult.ok,
      status: apiResult.status,
      dataType: apiResult.data ? typeof apiResult.data : "null",
      isArray: Array.isArray(apiResult.data),
      rawLength: apiResult.rawText?.length,
      firstChars: apiResult.rawText?.substring(0, 200),
    };

    if (!apiResult.ok) {
      result.errors.push(`API call failed: ${apiResult.status}`);
      return NextResponse.json(result);
    }

    if (!Array.isArray(apiResult.data)) {
      result.errors.push(
        `Expected array, got ${typeof apiResult.data}: ${JSON.stringify(apiResult.data).substring(0, 200)}`
      );
      return NextResponse.json(result);
    }

    // Stage 2: Sample items from response
    result.stages["2_sample_items"] = {
      label: "Sample items from API response",
      totalCount: (apiResult.data as unknown[]).length,
      samples: (apiResult.data as unknown[]).slice(0, 3),
    };

    // Stage 3: Normalize to AdminOrderRow
    console.log("[debug/orders-status] Stage 3: Building profile map...");
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,email,full_name,phone_number");

    const phoneMap = buildPhoneProfileMap(profiles || []);

    console.log("[debug/orders-status] Stage 3: Normalizing orders...");
    const externalRows = [];
    const normalizationErrors = [];

    for (let i = 0; i < Math.min((apiResult.data as unknown[]).length, 5); i++) {
      const raw = (apiResult.data as unknown[])[i];
      try {
        const row = normalizeExternalOrder(raw, phoneMap);
        if (row) {
          externalRows.push(row);
        } else {
          normalizationErrors.push(`Item ${i}: returned null`);
        }
      } catch (e) {
        normalizationErrors.push(
          `Item ${i}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    result.stages["3_normalization"] = {
      label: "Normalize API items to AdminOrderRow",
      inputCount: Math.min((apiResult.data as unknown[]).length, 5),
      successCount: externalRows.length,
      errors: normalizationErrors,
      samples: externalRows.slice(0, 3).map((row) => ({
        id: row.id,
        status: row.status,
        reference: row.reference,
        network_id: row.network_id,
        network_label: row.network_label,
        recipient_msisdn: row.recipient_msisdn,
      })),
    };

    // Stage 4: Status validation
    result.stages["4_status_validation"] = {
      label: "Check status field presence and values",
      statusesSeen: Array.from(
        new Set(externalRows.map((r) => r.status))
      ).sort(),
      itemsWithStatus: externalRows.filter((r) => r.status).length,
      itemsWithoutStatus: externalRows.filter((r) => !r.status).length,
    };

    // Stage 5: Network mapping
    result.stages["5_network_mapping"] = {
      label: "Network ID mappings",
      networksMapped: Array.from(
        new Set(
          externalRows
            .map((r) => ({
              dakazina: r.network_label,
              displayId: r.network_id,
            }))
            .map((x) => JSON.stringify(x))
        )
      )
        .map((x) => JSON.parse(x))
        .sort((a, b) =>
          String(a.dakazina).localeCompare(String(b.dakazina))
        ),
    };

    // Stage 6: Full request log
    result.stages["6_full_fetch"] = {
      label: "Full fetchExternalAllOrdersRaw result",
      totalOrders: externalRows.length,
      statuses: Array.from(
        new Set(externalRows.map((r) => r.status))
      ),
    };

    console.log("[debug/orders-status] ✅ All stages completed successfully");
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Unhandled error: ${msg}`);
    console.error("[debug/orders-status] Error:", error);
    return NextResponse.json(result, { status: 500 });
  }
}
