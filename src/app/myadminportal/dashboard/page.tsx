import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailPriceMultiplier } from "@/lib/pricing";
import {
  buildPhoneProfileMap,
  fetchExternalAllOrdersRaw,
  normalizeExternalOrder,
  type AdminOrderRow,
} from "@/lib/external-all-orders";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DashboardChart } from "./dashboard-chart";

export const dynamic = "force-dynamic";

export type SeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
};

// ── helpers ────────────────────────────────────────────────────────────────

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

// ── page ───────────────────────────────────────────────────────────────────

export default async function MyAdminDashboardPage() {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id,email,full_name,phone_number");

  const totalUsers = profiles?.length ?? 0;
  const phoneMap = buildPhoneProfileMap(profiles || []);

  const rawExternal = await fetchExternalAllOrdersRaw();
  const rows: AdminOrderRow[] = [];
  for (const raw of rawExternal) {
    const row = normalizeExternalOrder(raw, phoneMap);
    if (row) rows.push(row);
  }

  // ── summary stats ──────────────────────────────────────────────────────

  const totalSales = rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
  const m = getRetailPriceMultiplier();
  const totalProfit = rows.reduce((s, r) => {
    const retail = Math.abs(Number(r.amount));
    return s + retail * (1 - 1 / m);
  }, 0);

  // ── chart bucketing ────────────────────────────────────────────────────

  const now = new Date();

  const dailyMap = new Map<string, SeriesPoint>();
  for (let h = 0; h < 24; h++) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    const label = fmtHour(d);
    dailyMap.set(label, { label, revenue: 0, orders: 0 });
  }

  const monthlyMap = new Map<string, SeriesPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const label = fmtDay(d);
    monthlyMap.set(label, { label, revenue: 0, orders: 0 });
  }

  const weeklyMap = new Map<string, SeriesPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = weekLabel(d);
    if (!weeklyMap.has(label)) {
      weeklyMap.set(label, { label, revenue: 0, orders: 0 });
    }
  }

  const yearlyMap = new Map<string, SeriesPoint>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = fmtMonth(d);
    yearlyMap.set(label, { label, revenue: 0, orders: 0 });
  }

  for (const row of rows) {
    if (!row.created_at) continue;
    const d = new Date(row.created_at);
    const amt = Math.abs(Number(row.amount));

    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (isToday) {
      const slot = dailyMap.get(fmtHour(d));
      if (slot) { slot.revenue += amt; slot.orders += 1; }
    }

    const dSlot = monthlyMap.get(fmtDay(d));
    if (dSlot) { dSlot.revenue += amt; dSlot.orders += 1; }

    const wSlot = weeklyMap.get(weekLabel(d));
    if (wSlot) { wSlot.revenue += amt; wSlot.orders += 1; }

    const ySlot = yearlyMap.get(fmtMonth(d));
    if (ySlot) { ySlot.revenue += amt; ySlot.orders += 1; }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of users, sales, and estimated profit (after wholesale cost).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
            <CardDescription>Total sales</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-green-600">
              GHS {totalSales.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All orders from provider (customer prices)
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
            Based on your retail multiplier ({m.toFixed(4)}×) vs wholesale
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