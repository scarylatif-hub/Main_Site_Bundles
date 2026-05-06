import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPhoneProfileMap,
  enrichAdminOrderRowsWithLedgerBuyers,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  storeOrderToAdminRow,
  transactionToAdminRow,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import { datakazinaAPI } from "@/lib/datakazina";
import { AdminOrdersTable } from "./admin-orders-table";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching

type DbPurchaseRow = {
  id: string;
  user_id: string;
  reference: string | null;
  transaction_code: string | null;
  created_at: string;
  recipient_msisdn: string | null;
  network_id: number | null;
  bundle_amount: string | null;
  status: string;
  amount: number;
  transaction_type: string | null;
};

function rowKeys(row: AdminOrderRow): string[] {
  return [
    row.reference,
    row.transaction_code,
    row.provider_order_id,
    row.id,
  ]
    .map((key) => (key != null ? String(key).trim() : ""))
    .filter(Boolean);
}

function purchaseKeys(row: DbPurchaseRow): string[] {
  return [row.reference, row.transaction_code, row.id]
    .map((key) => (key != null ? String(key).trim() : ""))
    .filter(Boolean);
}

function findMatchingExternalRow(
  purchase: DbPurchaseRow,
  externalRows: AdminOrderRow[]
): AdminOrderRow | undefined {
  const purchaseKeySet = new Set(purchaseKeys(purchase));
  const exact = externalRows.find((row) =>
    rowKeys(row).some((key) => purchaseKeySet.has(key))
  );

  if (exact) {
    return exact;
  }

  const purchaseTime = new Date(purchase.created_at).getTime();
  const purchasePhone = String(purchase.recipient_msisdn || "").trim();
  const purchaseAmount = Math.abs(Number(purchase.amount || 0));

  const candidates = externalRows.filter((row) => {
    if (purchasePhone && row.recipient_msisdn && row.recipient_msisdn !== purchasePhone) {
      return false;
    }

    if (
      purchase.network_id != null &&
      row.network_id != null &&
      purchase.network_id !== row.network_id
    ) {
      return false;
    }

    return Math.abs(Math.abs(Number(row.amount || 0)) - purchaseAmount) <= 0.06;
  });

  if (candidates.length === 0) {
    return undefined;
  }

  candidates.sort((a, b) => {
    const aDelta = Math.abs(new Date(a.created_at).getTime() - purchaseTime);
    const bDelta = Math.abs(new Date(b.created_at).getTime() - purchaseTime);
    return aDelta - bDelta;
  });

  return candidates[0];
}

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
  const profileByUserId = new Map<string, { email: string; name: string }>();
  for (const profile of profiles || []) {
    if (!profile.id) continue;
    profileByUserId.set(profile.id, {
      email: profile.email || "—",
      name: profile.full_name || "",
    });
  }

  // Fetch external API orders (main site)
  console.log("Fetching external orders from DataKazina...");
  const rawExternal = await fetchExternalAllOrdersRaw();
  const externalRows: AdminOrderRow[] = [];
  for (const raw of rawExternal) {
    const row = normalizeExternalOrder(raw, phoneMap);
    if (row) externalRows.push(row);
  }

  await enrichAdminOrderRowsWithLedgerBuyers(externalRows, admin);
  console.log(`Processed ${externalRows.length} external orders`);

  // Fetch main site purchases from local database
  console.log("Fetching main site purchases from database...");
  const { data: purchases, error: purchasesError } = await admin
    .from("transactions")
    .select(
      "id,user_id,reference,transaction_code,created_at,recipient_msisdn,network_id,bundle_amount,status,amount,transaction_type"
    )
    .eq("transaction_type", "purchase")
    .order("created_at", { ascending: false })
    .limit(500);

  if (purchasesError) {
    console.error("myadminportal orders purchases:", purchasesError);
  }

  // Fetch store orders from local database
  console.log("Fetching store orders from database...");
  const { data: storeOrders, error: storeOrdersError } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (storeOrdersError) {
    console.error("myadminportal orders store orders:", storeOrdersError);
  }

  // Fetch package data for bundle amounts
  console.log("Fetching packages for bundle amounts...");
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  const packageMap = new Map<number, string>();
  if (pkgResult.ok && pkgResult.data) {
    for (const pkg of pkgResult.data) {
      const label = pkg.volumeGB || `${pkg.volume}GB` || `Package ${pkg.id}`;
      packageMap.set(pkg.id, label);
    }
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
    const bundleAmount = packageMap.get(order.package_id) || null;
    const row = storeOrderToAdminRow(order, storeName, bundleAmount);
    storeRows.push(row);
  }
  console.log(`Processed ${storeRows.length} store orders`);

  // Convert main-site purchases to AdminOrderRow format and enrich with provider data
  const directRows: AdminOrderRow[] = [];
  const matchedExternalKeys = new Set<string>();
  for (const purchase of (purchases || []) as DbPurchaseRow[]) {
    const directRow = transactionToAdminRow(purchase, profileByUserId);
    const externalMatch = findMatchingExternalRow(purchase, externalRows);

    if (externalMatch) {
      directRow.reference = externalMatch.reference || directRow.reference;
      directRow.provider_order_id = externalMatch.provider_order_id;
      directRow.transaction_code =
        externalMatch.transaction_code || directRow.transaction_code;
      directRow.created_at = externalMatch.created_at || directRow.created_at;
      directRow.recipient_msisdn =
        externalMatch.recipient_msisdn || directRow.recipient_msisdn;
      directRow.network_id = externalMatch.network_id ?? directRow.network_id;
      directRow.network_label =
        externalMatch.network_label ?? directRow.network_label;
      directRow.bundle_amount =
        externalMatch.bundle_amount || directRow.bundle_amount;
      directRow.status = externalMatch.status || directRow.status;
      directRow.amount = Math.abs(Number(externalMatch.amount || directRow.amount));

      for (const key of rowKeys(externalMatch)) {
        matchedExternalKeys.add(key);
      }
    }

    directRows.push(directRow);
  }
  console.log(`Processed ${directRows.length} main site purchase rows`);

  const unmatchedExternalRows = externalRows.filter(
    (row) => !rowKeys(row).some((key) => matchedExternalKeys.has(key))
  );
  console.log(
    `Keeping ${unmatchedExternalRows.length} provider-only rows not found in local purchases`
  );

  // Merge both order sources
  const allRows = [...directRows, ...storeRows, ...unmatchedExternalRows];
  console.log(
    `Total orders: ${allRows.length} (${directRows.length} direct + ${storeRows.length} store + ${unmatchedExternalRows.length} provider-only)`
  );

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
