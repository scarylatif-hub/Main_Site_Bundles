import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  buildPhoneProfileMap,
  buildApiOrderStatusLookup,
} from "@/lib/external-all-orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/status-resolution?reference=REF-123&transaction_code=TXN-456&user_id=user123
 * 
 * Debug the 3-tier status resolution for a specific order:
 * 1. Admin override (from provider_order_overrides table)
 * 2. Provider API status (from fetchExternalAllOrdersRaw)
 * 3. Database fallback (from transactions table)
 * 
 * Accepts any of: reference, transaction_code, user_id as query params
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const reference = searchParams.get("reference");
  const transaction_code = searchParams.get("transaction_code");
  const user_id = searchParams.get("user_id");

  if (!reference && !transaction_code && !user_id) {
    return NextResponse.json(
      {
        error: "Provide at least one of: reference, transaction_code, user_id",
      },
      { status: 400 }
    );
  }

  const result = {
    query: { reference, transaction_code, user_id },
    timestamp: new Date().toISOString(),
    resolution: {} as Record<string, unknown>,
    errors: [] as string[],
  };

  try {
    const admin = createAdminClient();

    // Tier 1: Check admin overrides
    console.log("[status-resolution] Tier 1: Checking admin overrides...");
    const keys = [reference, transaction_code].filter(Boolean);
    result.resolution["tier_1_override"] = {
      label: "Admin overrides from provider_order_overrides table",
      lookupKeys: keys,
      found: null,
    };

    if (keys.length > 0) {
      const { data: overrides } = await admin
        .from("provider_order_overrides")
        .select("transaction_id,status,updated_at")
        .in("transaction_id", keys);

      if (overrides && overrides.length > 0) {
        (result.resolution["tier_1_override"] as Record<string, unknown>).found =
          overrides[0];
      }
    }

    // Tier 2: Check provider API
    console.log("[status-resolution] Tier 2: Fetching from provider API...");
    result.resolution["tier_2_provider_api"] = {
      label: "Live status from DataKazina API (fetchExternalAllOrdersRaw)",
      found: null,
    };

    const { data: profiles } = await admin
      .from("profiles")
      .select("id,email,full_name,phone_number");
    const phoneMap = buildPhoneProfileMap(profiles || []);

    const rawExternal = await fetchExternalAllOrdersRaw();
    const statusLookup = buildApiOrderStatusLookup(rawExternal);

    for (const k of keys.filter((key): key is string => typeof key === "string" && key.trim() !== "")) {
      if (statusLookup.has(k)) {
        (result.resolution["tier_2_provider_api"] as Record<string, unknown>).found = {
          key: k,
          status: statusLookup.get(k),
          allSeen: Array.from(statusLookup.entries())
            .filter(([, v]) => v === statusLookup.get(k)!)
            .map(([k]) => k),
        };
        break;
      }
    }

    // Add sample from API for reference
    const normExternal = [];
    for (const raw of rawExternal.slice(0, 5)) {
      const row = normalizeExternalOrder(raw, phoneMap);
      if (row) normExternal.push(row);
    }
    (result.resolution["tier_2_provider_api"] as Record<string, unknown>).sample = normExternal.map(
      (r) => ({
        id: r.id,
        status: r.status,
        reference: r.reference,
        transaction_code: r.transaction_code,
      })
    );

    // Tier 3: Check database
    console.log("[status-resolution] Tier 3: Checking database...");
    result.resolution["tier_3_database"] = {
      label: "Fallback status from transactions/orders table",
      found: null,
    };

    if (user_id) {
      const { data: txs } = await admin
        .from("transactions")
        .select("id,status,reference,transaction_code,amount,created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (txs && txs.length > 0) {
        (result.resolution["tier_3_database"] as Record<string, unknown>).found = txs;
      }
    }

    if (reference || transaction_code) {
      const filters = [];
      if (reference) filters.push({ reference });
      if (transaction_code) filters.push({ transaction_code });

      const { data: orders } = await admin
        .from("orders")
        .select("id,status,reference,transaction_code,created_at")
        .or(filters.map((f) => `reference.eq.${f.reference || transaction_code},transaction_code.eq.${f.transaction_code || reference}`).join(","))
        .limit(5);

      if (orders && orders.length > 0) {
        if (
          !(result.resolution["tier_3_database"] as Record<string, unknown>).found
        ) {
          (result.resolution["tier_3_database"] as Record<string, unknown>).found = orders;
        } else {
          (result.resolution["tier_3_database"] as Record<string, unknown>).orders = orders;
        }
      }
    }

    // Final resolution
    console.log("[status-resolution] Computing final status...");
    let finalStatus = "unknown";
    let resolvedFrom = "none";

    const tier1 = (result.resolution["tier_1_override"] as any)?.found;
    const tier2 = (result.resolution["tier_2_provider_api"] as any)?.found;
    const tier3 = (result.resolution["tier_3_database"] as any)?.found;

    if (tier1) {
      finalStatus = tier1.status;
      resolvedFrom = "admin_override";
    } else if (tier2) {
      finalStatus = tier2.status;
      resolvedFrom = "provider_api";
    } else if (tier3) {
      finalStatus = Array.isArray(tier3) ? tier3[0].status : tier3.status;
      resolvedFrom = "database";
    }

    result.resolution["final"] = {
      status: finalStatus,
      resolvedFrom,
      hierarchy: [
        {
          tier: 1,
          name: "admin_override",
          available: !!tier1,
          value: tier1?.status,
        },
        {
          tier: 2,
          name: "provider_api",
          available: !!tier2,
          value: tier2?.status,
        },
        {
          tier: 3,
          name: "database",
          available: !!tier3,
          value: Array.isArray(tier3) ? tier3[0]?.status : tier3?.status,
        },
      ],
    };

    console.log("[status-resolution] ✅ Resolution complete", {
      query: { reference, transaction_code, user_id },
      finalStatus,
      resolvedFrom,
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Error: ${msg}`);
    console.error("[status-resolution] Error:", error);
    return NextResponse.json(result, { status: 500 });
  }
}
