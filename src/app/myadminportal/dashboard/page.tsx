import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardChart } from "./dashboard-chart";
import { getRetailPriceMultiplier } from "@/lib/pricing";
import { checkDatakazinaBalance } from "@/lib/datakazina";
import {
  buildPhoneProfileMap,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  storeOrderToAdminRow,
  transactionToAdminRow,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MaintenanceToggle } from "@/components/maintenance-toggle";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Store, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export type SeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
  profit: number;
};

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

type DbStoreOrderRow = {
  id: string;
  store_id: string;
  package_id: number;
  network_id: number;
  phone_number: string;
  amount: number;
  status: string;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  paystack_transaction_id: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtHour(date: Date) {
  const h = date.getHours();
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)} ${ampm}`;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function isoWeek(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weekLabel(d: Date) {
  return `W${isoWeek(d)} '${String(d.getFullYear()).slice(2)}`;
}

function toSeries(map: Map<string, SeriesPoint>): SeriesPoint[] {
  return Array.from(map.values());
}

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

export default async function MyAdminDashboardPage() {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id,email,full_name,phone_number,store_name");

  const totalUsers = profiles?.length ?? 0;
  const phoneMap = buildPhoneProfileMap(profiles || []);
  const profileByUserId = new Map<string, { email: string; name: string }>();
  const storeNameMap = new Map<string, string>();

  for (const profile of profiles || []) {
    if (!profile.id) {
      continue;
    }

    profileByUserId.set(profile.id, {
      email: profile.email || "-",
      name: profile.full_name || "",
    });

    if (profile.store_name) {
      storeNameMap.set(profile.id, profile.store_name);
    }
  }

  const rawExternal = await fetchExternalAllOrdersRaw();
  const externalRows: AdminOrderRow[] = [];
  for (const raw of rawExternal) {
    const row = normalizeExternalOrder(raw, phoneMap);
    if (row) {
      externalRows.push(row);
    }
  }

  const { data: purchases } = await admin
    .from("transactions")
    .select(
      "id,user_id,reference,transaction_code,created_at,recipient_msisdn,network_id,bundle_amount,status,amount,transaction_type"
    )
    .eq("transaction_type", "purchase")
    .order("created_at", { ascending: false })
    .limit(500);

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

  const { data: storeOrders } = await admin
    .from("orders")
    .select(
      "id,store_id,package_id,network_id,phone_number,amount,status,customer_email,customer_phone,created_at,paystack_transaction_id"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const storeRows: AdminOrderRow[] = [];
  for (const order of (storeOrders || []) as DbStoreOrderRow[]) {
    const storeName = storeNameMap.get(order.store_id) || "Unknown Store";
    storeRows.push(storeOrderToAdminRow(order, storeName, null));
  }

  const unmatchedExternalRows = externalRows.filter(
    (row) => !rowKeys(row).some((key) => matchedExternalKeys.has(key))
  );

  const rows: AdminOrderRow[] = [
    ...directRows,
    ...storeRows,
    ...unmatchedExternalRows,
  ];

  const totalSales = rows.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  const totalOrders = rows.length;
  const m = getRetailPriceMultiplier();
  const totalProfit = rows.reduce((sum, row) => {
    const retail = Math.abs(Number(row.amount));
    return sum + retail * (1 - 1 / m);
  }, 0);

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/dakazina`
    : null;
  const datakazinaApiKeyStatus = process.env.DATAKAZINA_API_KEY ? "Configured" : "Missing";
  const datakazinaBalance = await checkDatakazinaBalance();

  const now = new Date();

  const dailyMap = new Map<string, SeriesPoint>();
  for (let h = 0; h < 24; h++) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    const label = fmtHour(d);
    dailyMap.set(label, { label, revenue: 0, orders: 0, profit: 0 });
  }

  const monthlyMap = new Map<string, SeriesPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const label = fmtDay(d);
    monthlyMap.set(label, { label, revenue: 0, orders: 0, profit: 0 });
  }

  const weeklyMap = new Map<string, SeriesPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = weekLabel(d);
    if (!weeklyMap.has(label)) {
      weeklyMap.set(label, { label, revenue: 0, orders: 0, profit: 0 });
    }
  }

  const yearlyMap = new Map<string, SeriesPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = fmtMonth(d);
    yearlyMap.set(label, { label, revenue: 0, orders: 0, profit: 0 });
  }

  for (const row of rows) {
    if (!row.created_at) {
      continue;
    }

    const d = new Date(row.created_at);
    const amt = Math.abs(Number(row.amount));
    const orderProfit = amt * (1 - 1 / m);

    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (isToday) {
      const slot = dailyMap.get(fmtHour(d));
      if (slot) {
        slot.revenue += amt;
        slot.orders += 1;
        slot.profit += orderProfit;
      }
    }

    const dSlot = monthlyMap.get(fmtDay(d));
    if (dSlot) {
      dSlot.revenue += amt;
      dSlot.orders += 1;
      dSlot.profit += orderProfit;
    }

    const wSlot = weeklyMap.get(weekLabel(d));
    if (wSlot) {
      wSlot.revenue += amt;
      wSlot.orders += 1;
      wSlot.profit += orderProfit;
    }

    const ySlot = yearlyMap.get(fmtMonth(d));
    if (ySlot) {
      ySlot.revenue += amt;
      ySlot.orders += 1;
      ySlot.profit += orderProfit;
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of users, sales, and estimated profit across main site and store orders.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-right text-xs text-muted-foreground sm:text-left">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">DataKazina balance</p>
            <p className="text-base font-semibold tracking-tight text-foreground">
              {datakazinaBalance != null ? `GHS ${datakazinaBalance.toFixed(2)}` : "Unavailable"}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href="/myadminportal/withdrawals">
              <Wallet className="h-4 w-4" />
              Withdrawal Approval
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href="/myadminportal/stores-balances">
              <Store className="h-4 w-4" />
              Stores & Balances
            </Link>
          </Button>
        </div>
      </div>

      <MaintenanceToggle />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalUsers}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All registered profiles
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total orders</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalOrders}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Direct, store, and provider-only fallback rows
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total sales</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-green-600">
              GHS {totalSales.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Main site and store orders combined
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Est. total profit</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              GHS {totalProfit.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Estimated from all orders using retail multiplier ({m.toFixed(4)}x)
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>DataKazina webhook</CardDescription>
            <CardTitle className="text-base break-words">
              {webhookUrl ?? "NEXT_PUBLIC_APP_URL is not set"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Use this endpoint in Dakazina dashboard: <br />
            <span className="font-mono break-words">/api/webhooks/dakazina</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>DataKazina API Key</CardDescription>
            <CardTitle className="text-base">
              {datakazinaApiKeyStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Do not display the raw secret in the browser. If this says "Missing", set DATAKAZINA_API_KEY in your environment.
          </CardContent>
        </Card>
      </div>

      <DashboardChart
        daily={toSeries(dailyMap)}
        monthly={toSeries(monthlyMap)}
        weekly={toSeries(weeklyMap)}
        yearly={toSeries(yearlyMap)}
      />
    </div>
  );
}
