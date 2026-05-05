import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMyPurchaseTransactionsForUser } from "@/lib/data/user-transactions";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";

export const dynamic = "force-dynamic";

/**
 * GET /api/reseller/orders?type=personal|store
 * Returns orders for the reseller:
 * - type=personal: their own purchases (from transactions table, with 3-tier status resolution)
 * - type=store: all orders from their store (from orders table, with admin override check)
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is a reseller
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
      // Fetch reseller's own purchases from transactions table
      // Already uses 3-tier status resolution internally
      const transactions = await fetchMyPurchaseTransactionsForUser(user.id);
      return NextResponse.json({ orders: transactions, type: "personal" });
    } else if (type === "store") {
      // Fetch all orders from their store (from orders table)
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

      // Fetch admin overrides for these orders
      const orderReferences = (storeOrders || [])
        .map((o: any) => o.paystack_transaction_id || o.id)
        .filter(Boolean);

      const { data: overrides } = await admin
        .from("provider_order_overrides")
        .select("transaction_id,status")
        .in("transaction_id", orderReferences);

      const overrideMap = new Map(
        (overrides || []).map((o: any) => [o.transaction_id, o.status])
      );

      // Convert DataKazina network IDs to display format and apply status overrides
      const convertedOrders = (storeOrders || []).map((order: any) => ({
        ...order,
        network_id: order.network_id ? datakazinaNetworkIdToDisplay(order.network_id) : null,
        // Apply 3-tier resolution: override > db status
        status: overrideMap.get(order.paystack_transaction_id || order.id) || order.status,
      }));

      return NextResponse.json({ orders: convertedOrders, type: "store" });
    } else {
      return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in reseller orders API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
