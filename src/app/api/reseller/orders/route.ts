import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMyPurchaseTransactionsForUser } from "@/lib/data/user-transactions";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";
import {
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  resolveOrderStatusFromSources,
  type AdminOrderRow,
} from "@/lib/external-all-orders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_reseller, id")
    .eq("id", user.id)
    .single();

  if (!profile?.is_reseller) {
    return NextResponse.json({ error: "Not a reseller" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "personal";

  try {
    if (type === "personal") {
      const transactions = await fetchMyPurchaseTransactionsForUser(user.id);
      return NextResponse.json({ orders: transactions, type: "personal" });
    }

    if (type !== "store") {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }

    const { data: storeOrders, error } = await admin
      .from("orders")
      .select(`
        *,
        customer:customer_id (
          full_name,
          email,
          phone_number
        )
      `)
      .eq("store_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching store orders:", error);
      return NextResponse.json({ error: "Failed to fetch store orders" }, { status: 500 });
    }

    const orderReferences = (storeOrders || [])
      .flatMap((order: any) => [
        order.paystack_transaction_id,
        order.payment_reference,
        order.id,
      ])
      .filter(Boolean);

    const [{ data: overrides }, rawExternal] = await Promise.all([
      admin
        .from("provider_order_overrides")
        .select("transaction_id,status")
        .in("transaction_id", orderReferences.length > 0 ? orderReferences : ["__none__"]),
      fetchExternalAllOrdersRaw(),
    ]);

    const externalRows: AdminOrderRow[] = [];
    const noProfiles = new Map<string, { email: string; name: string; id: string }>();
    for (const raw of rawExternal) {
      const row = normalizeExternalOrder(raw, noProfiles);
      if (row) externalRows.push(row);
    }

    const overridesRecord = Object.fromEntries(
      (overrides || []).map((row: any) => [row.transaction_id, row.status])
    );

    const convertedOrders = (storeOrders || []).map((order: any) => {
      const resolved = resolveOrderStatusFromSources({
        candidateKeys: [
          order.paystack_transaction_id,
          order.payment_reference,
          order.id,
        ].filter(Boolean),
        createdAt: order.created_at,
        recipientMsisdn:
          order.customer?.phone_number || order.customer_phone || order.phone_number,
        amount: Math.abs(Number(order.amount || 0)),
        networkId: order.network_id,
        fallbackStatus: order.status,
        externalRows,
        overrides: overridesRecord,
      });

      return {
        ...order,
        network_id: order.network_id
          ? datakazinaNetworkIdToDisplay(order.network_id)
          : null,
        status: resolved.status,
      };
    });

    return NextResponse.json({ orders: convertedOrders, type: "store" });
  } catch (error) {
    console.error("Error in reseller orders API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
