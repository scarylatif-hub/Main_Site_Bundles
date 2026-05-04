import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPhoneProfileMap,
  enrichAdminOrderRowsWithLedgerBuyers,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  storeOrderToAdminRow,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import { AdminOrdersTable } from "./admin-orders-table";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching

export default async function MyAdminOrdersPage() {
  const admin = createAdminClient();

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,phone_number,store_name");

  if (profileError) {
    console.error("myadminportal orders profiles:", {
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      code: profileError.code,
    });
  }

  const phoneMap = buildPhoneProfileMap(profiles || []);

  // Fetch external API orders (main site)
  const rawExternal = await fetchExternalAllOrdersRaw();
  const externalRows: AdminOrderRow[] = [];
  for (const raw of rawExternal) {
    const row = normalizeExternalOrder(raw, phoneMap);
    if (row) externalRows.push(row);
  }

  await enrichAdminOrderRowsWithLedgerBuyers(externalRows, admin);

  // Fetch store orders from local database
  const { data: storeOrders, error: storeOrdersError } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (storeOrdersError) {
    console.error("myadminportal orders store orders:", storeOrdersError);
  }

  // Build store name map
  const storeNameMap = new Map<string, string>();
  for (const p of profiles || []) {
    if (p.store_name && p.id) {
      storeNameMap.set(p.id, p.store_name);
    }
  }

  // Convert store orders to AdminOrderRow format
  const storeRows: AdminOrderRow[] = [];
  for (const order of storeOrders || []) {
    const storeName = storeNameMap.get(order.store_id) || "Unknown Store";
    const row = storeOrderToAdminRow(order, storeName);
    storeRows.push(row);
  }

  // Merge both order sources
  const allRows = [...externalRows, ...storeRows];

  const { data: ovRows } = await admin
    .from("provider_order_overrides")
    .select("transaction_id,status");

  const overrides: Record<string, string> = {};
  for (const o of ovRows ?? []) {
    if (o.transaction_id) overrides[o.transaction_id] = o.status;
  }

  allRows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Orders from main site and all stores. Store orders show the store name
          with (store) label. Order ID is the provider&apos;s id. Status can be
          updated here (saved by transaction reference).
        </p>
      </div>
      <AdminOrdersTable rows={allRows} initialOverrides={overrides} />
    </div>
  );
}
