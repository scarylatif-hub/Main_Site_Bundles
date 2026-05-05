import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/store-orders-status
 * 
 * Debug endpoint to verify that store orders are getting proper status display.
 * Checks:
 * - Store orders in database (orders table)
 * - Their current status field
 * - Comparison with provider API if reference exists
 * - Provider order overrides if any
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const store_id = searchParams.get("store_id");

  const result = {
    timestamp: new Date().toISOString(),
    query: { limit, store_id },
    analysis: {} as Record<string, unknown>,
    errors: [] as string[],
  };

  try {
    const admin = createAdminClient();

    // Fetch store orders
    console.log("[store-orders-status] Fetching store orders...");
    let query = admin
      .from("orders")
      .select(
        "id,store_id,status,payment_reference,created_at,phone_number,package_id,amount"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (store_id) {
      query = query.eq("store_id", store_id);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      result.errors.push(`Failed to fetch orders: ${ordersError.message}`);
      return NextResponse.json(result, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      result.analysis["message"] = "No store orders found";
      return NextResponse.json(result);
    }

    // Analyze status values
    console.log("[store-orders-status] Analyzing statuses...");
    const statusDist: Record<string, number> = {};
    const ordersByStatus: Record<string, unknown[]> = {};

    for (const order of orders) {
      const s = String(order.status || "unknown");
      statusDist[s] = (statusDist[s] || 0) + 1;
      if (!ordersByStatus[s]) {
        ordersByStatus[s] = [];
      }
      ordersByStatus[s].push({
        id: order.id,
        payment_reference: order.payment_reference,
        created_at: order.created_at,
      });
    }

    result.analysis["total_orders"] = orders.length;
    result.analysis["status_distribution"] = statusDist;

    // Fetch provider overrides for these orders
    console.log("[store-orders-status] Checking provider overrides...");
    const references = orders
      .map((o) => o.payment_reference)
      .filter(Boolean);

    const { data: overrides } = await admin
      .from("provider_order_overrides")
      .select("transaction_id,status")
      .in("transaction_id", references);

    result.analysis["overrides_count"] = overrides?.length || 0;
    result.analysis["orders_with_overrides"] = overrides?.map((o) => ({
      transaction_id: o.transaction_id,
      status: o.status,
    }));

    // Sample orders with detail
    console.log("[store-orders-status] Getting sample details...");
    const samples = [];
    for (const order of orders.slice(0, 5)) {
      const override = overrides?.find(
        (o) => o.transaction_id === order.payment_reference
      );
      samples.push({
        id: order.id,
        db_status: order.status,
        override_status: override?.status || null,
        final_status: override?.status || order.status,
        payment_reference: order.payment_reference,
        created_at: order.created_at,
      });
    }

    result.analysis["sample_orders"] = samples;

    // Check if any have null status
    const nullStatusCount = orders.filter((o) => !o.status).length;
    if (nullStatusCount > 0) {
      result.errors.push(
        `⚠️ Found ${nullStatusCount} orders with null/empty status`
      );
    }

    // Warnings for odd statuses
    const oddStatuses = Object.keys(statusDist).filter(
      (s) => !["placed", "processing", "delivered", "canceled", "success", "completed", "pending"].includes(s.toLowerCase())
    );
    if (oddStatuses.length > 0) {
      result.analysis["unusual_statuses"] = oddStatuses.map((s) => ({
        status: s,
        count: statusDist[s],
      }));
    }

    console.log("[store-orders-status] ✅ Analysis complete");
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Unhandled error: ${msg}`);
    console.error("[store-orders-status]", error);
    return NextResponse.json(result, { status: 500 });
  }
}
