import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPhoneProfileMap,
  enrichAdminOrderRowsWithLedgerBuyers,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import { AdminOrdersTable } from "./admin-orders-table";

export const dynamic = "force-dynamic";

export default async function MyAdminOrdersPage() {
  const admin = createAdminClient();

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,phone_number");

  if (profileError) {
    console.error("myadminportal orders profiles:", {
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      code: profileError.code,
    });
  }

  const phoneMap = buildPhoneProfileMap(profiles || []);

  const rawExternal = await fetchExternalAllOrdersRaw();
  const externalRows: AdminOrderRow[] = [];
  for (const raw of rawExternal) {
    const row = normalizeExternalOrder(raw, phoneMap);
    if (row) externalRows.push(row);
  }

  await enrichAdminOrderRowsWithLedgerBuyers(externalRows, admin);

  const { data: ovRows } = await admin
    .from("provider_order_overrides")
    .select("transaction_id,status");

  const overrides: Record<string, string> = {};
  for (const o of ovRows ?? []) {
    if (o.transaction_id) overrides[o.transaction_id] = o.status;
  }

  externalRows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Orders loaded from the provider &ldquo;all orders&rdquo; API. Order
          ID is the provider&apos;s id. Status can be updated here (saved by
          transaction reference).
        </p>
      </div>
      <AdminOrdersTable rows={externalRows} initialOverrides={overrides} />
    </div>
  );
}
