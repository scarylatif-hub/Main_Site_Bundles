import { createAdminClient } from "@/lib/supabase/admin";
import { computeResellerEarningsSummary } from "@/lib/reseller-earnings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjustStoreBalanceDialog } from "@/components/admin/adjust-store-balance-dialog";

export const dynamic = "force-dynamic";

type StoreRow = {
  id: string;
  store_name: string | null;
  reseller_slug: string | null;
  full_name: string | null;
  email: string | null;
  wallet_balance: number | null;
  reseller_approved: boolean | null;
  store_active: boolean | null;
};

type StoreRowWithBalances = StoreRow & {
  store_balance: number;
};

export default async function AdminStoresBalancesPage() {
  const admin = createAdminClient();

  const { data: stores, error } = await admin
    .from("profiles")
    .select(
      "id,store_name,reseller_slug,full_name,email,wallet_balance,reseller_approved,store_active"
    )
    .eq("is_reseller", true)
    .order("store_name", { ascending: true });

  if (error) {
    console.error("stores-balances fetch error:", error);
  }

  const baseRows = (stores || []) as StoreRow[];
  const rows: StoreRowWithBalances[] = await Promise.all(
    baseRows.map(async (store) => {
      const earnings = await computeResellerEarningsSummary(admin, store.id);
      return {
        ...store,
        store_balance: Number(earnings.availableEarnings || 0),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stores & Balances</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All reseller stores with owner details, wallet balance, and store earnings balance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store Owners</CardTitle>
          <CardDescription>{rows.length} store(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stores found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Store Balance</TableHead>
                    <TableHead className="text-right">Wallet Balance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((store) => {
                    const isActive = Boolean(store.reseller_approved && store.store_active);
                    return (
                      <TableRow key={store.id}>
                        <TableCell>
                          <div className="font-medium">{store.store_name || "Unnamed Store"}</div>
                          <div className="text-xs text-muted-foreground">
                            /store/{store.reseller_slug || "-"}
                          </div>
                        </TableCell>
                        <TableCell>{store.full_name || "—"}</TableCell>
                        <TableCell>{store.email || "—"}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium ${
                              isActive ? "text-green-600" : "text-yellow-600"
                            }`}
                          >
                            {isActive ? "Active" : "Pending/Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-600">
                          GHS {Number(store.store_balance || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          GHS {Number(store.wallet_balance || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <AdjustStoreBalanceDialog
                            storeId={store.id}
                            storeName={store.store_name || "Unnamed Store"}
                            availableBalance={Number(store.store_balance || 0)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
