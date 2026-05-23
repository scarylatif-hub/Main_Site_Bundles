import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";
import {
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  resolveOrderStatusFromSources,
  type AdminOrderRow,
} from "@/lib/external-all-orders";

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

    const orderReferences = (orders || [])
      .flatMap((order: any) => [
        order.dakazina_order_id,
        order.paystack_transaction_id,
        order.payment_reference,
        order.id,
      ])
      .filter(Boolean);

    const [{ data: overrides }, rawExternal, pkgResult] = await Promise.all([
      admin
        .from("provider_order_overrides")
        .select("transaction_id,status")
        .in("transaction_id", orderReferences.length > 0 ? orderReferences : ["__none__"]),
      fetchExternalAllOrdersRaw(),
      datakazinaAPI.fetchDataPackages(),
    ]);

    if (!pkgResult.ok || !pkgResult.data) {
      console.error("[store/orders] Failed to fetch packages from provider");
      return NextResponse.json({ error: "Failed to fetch packages" }, { status: 502 });
    }

    const externalRows: AdminOrderRow[] = [];
    const noProfiles = new Map<string, { email: string; name: string; id: string }>();
    for (const raw of rawExternal) {
      const row = normalizeExternalOrder(raw, noProfiles);
      if (row) externalRows.push(row);
    }

    const overridesRecord = Object.fromEntries(
      (overrides || []).map((row: any) => [row.transaction_id, row.status])
    );

    const packageMap = new Map(
      pkgResult.data.map((pkg: any) => [
        pkg.id,
        pkg.name || pkg.description || `Package ${pkg.id}`,
      ])
    );

    const enrichedOrders =
      orders?.map((order: any) => {
        const resolved = resolveOrderStatusFromSources({
          candidateKeys: [
            order.dakazina_order_id,
            order.paystack_transaction_id,
            order.payment_reference,
            order.id,
          ].filter(Boolean),
          createdAt: order.created_at,
          recipientMsisdn: order.customer_phone || order.phone_number,
          amount: Math.abs(Number(order.amount || 0)),
          networkId: order.network_id,
          fallbackStatus: order.status,
          externalRows,
          overrides: overridesRecord,
        });

        return {
          ...order,
          package_name:
            packageMap.get(order.package_id) || `Package ${order.package_id}`,
          network_id: order.network_id
            ? datakazinaNetworkIdToDisplay(order.network_id)
            : null,
          status: resolved.status,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (error) {
    console.error("Error fetching store orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
