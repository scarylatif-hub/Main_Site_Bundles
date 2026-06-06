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

    const { data: storeOwner } = await admin
      .from("profiles")
      .select("*")
      .eq("reseller_slug", params.slug)
      .single();

    if (!storeOwner) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { data: orders } = await admin
      .from("orders")
      .select("*")
      .eq("store_id", storeOwner.id)
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false });

    const pkgResult = await datakazinaAPI.fetchDataPackages();

    if (!pkgResult.ok || !pkgResult.data) {
      console.error("[store/orders] Failed to fetch packages from provider");
      return NextResponse.json({ error: "Failed to fetch packages" }, { status: 502 });
    }

    const packageMap = new Map(
      pkgResult.data.map((pkg: any) => [
        pkg.id,
        pkg.name || pkg.description || `Package ${pkg.id}`,
      ])
    );

    const enrichedOrders =
      orders?.map((order: any) => ({
        ...order,
        package_name:
          packageMap.get(order.package_id) || `Package ${order.package_id}`,
        network_id: order.network_id
          ? datakazinaNetworkIdToDisplay(order.network_id)
          : null,
        status: order.status,
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
