import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch store owner profile by slug
    const { data: storeOwner } = await admin
      .from("profiles")
      .select("*")
      .eq("reseller_slug", params.slug)
      .single();

    if (!storeOwner) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Fetch orders from database for this store and phone
    const { data: orders } = await admin
      .from("orders")
      .select("*")
      .eq("store_id", storeOwner.id)
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false });

    // Fetch admin overrides for these orders (3-tier resolution - tier 1)
    const orderReferences = (orders || [])
      .map((o: any) => o.paystack_transaction_id || o.id)
      .filter(Boolean);

    const { data: overrides } = await admin
      .from("provider_order_overrides")
      .select("transaction_id,status")
      .in("transaction_id", orderReferences);

    const overrideMap = new Map(
      (overrides || []).map((o: any) => [o.transaction_id, o.status])
    );

    // Fetch packages to get names
    const pkgResult = await datakazinaAPI.fetchDataPackages();
    if (!pkgResult.ok || !pkgResult.data) {
      console.error("[store/orders] Failed to fetch packages from provider");
      return NextResponse.json({ error: "Failed to fetch packages" }, { status: 502 });
    }
    const packageMap = new Map(
      pkgResult.data.map((pkg: any) => [pkg.id, pkg.name || pkg.description || `Package ${pkg.id}`])
    );

    const enrichedOrders = orders?.map((order: any) => ({
      ...order,
      package_name: packageMap.get(order.package_id) || `Package ${order.package_id}`,
      // Convert DataKazina network IDs to display format
      network_id: order.network_id ? datakazinaNetworkIdToDisplay(order.network_id) : null,
      // Apply 3-tier resolution: override (tier 1) > db status (tier 3)
      status: overrideMap.get(order.paystack_transaction_id || order.id) || order.status,
    })) || [];

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (error) {
    console.error("Error fetching store orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
