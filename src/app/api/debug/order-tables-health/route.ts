import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  buildPhoneProfileMap,
  storeOrderToAdminRow,
} from "@/lib/external-all-orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/order-tables-health
 * 
 * Comprehensive health check for all order tables:
 * - Main site user orders (transactions table)
 * - Store orders (orders table)
 * - Provider API integration
 * - Status overrides
 * 
 * Shows:
 * - Order counts in each table
 * - Status distribution
 * - API connection status
 * - Sample orders with final resolved status
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

  const result = {
    timestamp: new Date().toISOString(),
    health: {} as Record<string, any>,
    tables: {} as Record<string, any>,
    errors: [] as string[],
  };

  try {
    const admin = createAdminClient();

    // Health check: Database connection
    console.log("[orders-health] Checking database connection...");
    const { data: profilesTest } = await admin
      .from("profiles")
      .select("id")
      .limit(1);
    result.health["database"] =
      profilesTest !== null ? "✅ Connected" : "❌ Connection failed";

    // 1. Main Site User Orders (transactions table)
    console.log("[orders-health] Fetching transactions...");
    const { data: transactions, error: txnErr } = await admin
      .from("transactions")
      .select("id,status,created_at,transaction_type,amount")
      .eq("transaction_type", "purchase")
      .order("created_at", { ascending: false })
      .limit(limit);

    result.tables["transactions"] = {
      tableName: "transactions",
      source: "Main site user purchases",
      totalCount: null,
      sampleCount: transactions?.length || 0,
      error: txnErr?.message,
      statusDist: {} as Record<string, number>,
      samples: [],
    };

    if (transactions) {
      const statusDist: Record<string, number> = {};
      for (const t of transactions) {
        const s = String(t.status || "unknown");
        statusDist[s] = (statusDist[s] || 0) + 1;
      }
      result.tables["transactions"].statusDist = statusDist;
      result.tables["transactions"].samples = transactions.slice(0, 3).map((t) => ({
        id: t.id.substring(0, 8),
        status: t.status,
        created_at: t.created_at,
      }));
    }

    // 2. Store Orders (orders table)
    console.log("[orders-health] Fetching store orders...");
    const { data: storeOrders, error: storeErr } = await admin
      .from("orders")
      .select("id,status,created_at,amount")
      .order("created_at", { ascending: false })
      .limit(limit);

    result.tables["store_orders"] = {
      tableName: "orders",
      source: "Store customer purchases",
      totalCount: null,
      sampleCount: storeOrders?.length || 0,
      error: storeErr?.message,
      statusDist: {} as Record<string, number>,
      samples: [],
    };

    if (storeOrders) {
      const statusDist: Record<string, number> = {};
      for (const o of storeOrders) {
        const s = String(o.status || "unknown");
        statusDist[s] = (statusDist[s] || 0) + 1;
      }
      result.tables["store_orders"].statusDist = statusDist;
      result.tables["store_orders"].samples = storeOrders.slice(0, 3).map((o) => ({
        id: o.id.substring(0, 8),
        status: o.status,
        created_at: o.created_at,
      }));
    }

    // 3. Provider Order Overrides
    console.log("[orders-health] Fetching provider overrides...");
    const { data: overrides } = await admin
      .from("provider_order_overrides")
      .select("id,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    result.tables["provider_overrides"] = {
      tableName: "provider_order_overrides",
      source: "Admin status overrides",
      totalCount: overrides?.length || 0,
      sampleCount: overrides?.length || 0,
      statusDist: {} as Record<string, number>,
      samples: [],
    };

    if (overrides) {
      const statusDist: Record<string, number> = {};
      for (const o of overrides) {
        const s = String(o.status || "unknown");
        statusDist[s] = (statusDist[s] || 0) + 1;
      }
      result.tables["provider_overrides"].statusDist = statusDist;
      result.tables["provider_overrides"].samples = overrides.slice(0, 3).map((o) => ({
        id: o.id.substring(0, 8),
        status: o.status,
        created_at: o.created_at,
      }));
    }

    // 4. Provider API Status
    console.log("[orders-health] Testing provider API...");
    result.health["provider_api"] = "Testing...";
    try {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id,email,full_name,phone_number");
      const phoneMap = buildPhoneProfileMap(profiles || []);

      const rawExternal = await fetchExternalAllOrdersRaw();
      const externalRows = [];
      for (const raw of rawExternal.slice(0, 3)) {
        const row = normalizeExternalOrder(raw, phoneMap);
        if (row) externalRows.push(row);
      }

      result.tables["provider_api"] = {
        source: "DataKazina fetchTransactions()",
        totalOrders: rawExternal.length,
        sampleCount: externalRows.length,
        sampleStatuses: Array.from(
          new Set(externalRows.map((r) => r.status))
        ),
        samples: externalRows.slice(0, 3).map((r) => ({
          id: r.id.substring(0, 8),
          status: r.status,
          created_at: r.created_at,
        })),
      };

      result.health["provider_api"] = `✅ OK (${rawExternal.length} orders)`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.health["provider_api"] = `❌ Error: ${msg}`;
      result.errors.push(`Provider API error: ${msg}`);
    }

    // 5. 3-Tier Resolution Test
    console.log("[orders-health] Testing 3-tier resolution...");
    if (transactions && transactions.length > 0) {
      const sample = transactions[0];
      const keys = [sample.id];

      const { data: txOverrides } = await admin
        .from("provider_order_overrides")
        .select("transaction_id,status")
        .in("transaction_id", keys);

      const tier1 = txOverrides?.[0]?.status;
      const tier2 = null; // Would need full API call
      const tier3 = sample.status;
      const final = tier1 || tier2 || tier3;

      result.health["3tier_resolution"] = {
        sampleId: sample.id.substring(0, 8),
        tier1_override: tier1 || "—",
        tier2_provider_api: tier2 || "—",
        tier3_database: tier3 || "—",
        final_status: final,
      };
    }

    console.log("[orders-health] ✅ Health check complete");
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Unhandled error: ${msg}`);
    console.error("[orders-health]", error);
    return NextResponse.json(result, { status: 500 });
  }
}
