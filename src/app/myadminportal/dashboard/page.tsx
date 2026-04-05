import { createAdminClient } from "@/lib/supabase/admin";
import { getRetailPriceMultiplier } from "@/lib/pricing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RevenueChart,
  type SeriesPoint,
} from "@/components/admin/revenue-chart";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtHour(d: Date) {
  const h = d.getHours();
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
  const tmp = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  );
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
}

function statusCountsAsSale(status: unknown): boolean {
  const s = String(status ?? "").toLowerCase();
  if (s === "failed" || s === "canceled" || s === "cancelled") return false;
  return (
    s === "success" ||
    s === "placed" ||
    s === "delivered" ||
    s === "processing"
  );
}

type PurchaseRow = {
  amount: string | number | null;
  transaction_type: string | null;
  status: string | null;
  created_at: string | null;
};

/** Today: 12 bars × 2 hours (matches common analytics UI). */
function buildToday2hSeries(purchases: PurchaseRow[], now: Date): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const slotEnd = new Date(now.getTime() - (11 - i) * 2 * 60 * 60 * 1000);
    const slotStart = new Date(slotEnd.getTime() - 2 * 60 * 60 * 1000);
    let revenue = 0;
    let orders = 0;
    for (const t of purchases) {
      if (!t.created_at) continue;
      const d = new Date(t.created_at);
      if (d >= slotStart && d < slotEnd) {
        revenue += Math.abs(Number(t.amount));
        orders += 1;
      }
    }
    out.push({
      label: fmtHour(slotEnd),
      revenue,
      orders,
    });
  }
  return out;
}

function buildLast30DaysSeries(
  now: Date,
  purchases: PurchaseRow[]
): SeriesPoint[] {
  const map: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    map[fmtDay(d)] = { revenue: 0, orders: 0 };
  }
  for (const t of purchases) {
    if (!t.created_at) continue;
    const d = new Date(t.created_at);
    const key = fmtDay(d);
    if (key in map) {
      map[key].revenue += Math.abs(Number(t.amount));
      map[key].orders += 1;
    }
  }
  return Object.entries(map).map(([label, v]) => ({
    label,
    revenue: v.revenue,
    orders: v.orders,
  }));
}

function buildWeeklySeries(
  now: Date,
  purchases: PurchaseRow[]
): SeriesPoint[] {
  const map: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = `W${isoWeek(d)} ${d.getFullYear()}`;
    map[key] = { revenue: 0, orders: 0 };
  }
  for (const t of purchases) {
    if (!t.created_at) continue;
    const d = new Date(t.created_at);
    const key = `W${isoWeek(d)} ${d.getFullYear()}`;
    if (key in map) {
      map[key].revenue += Math.abs(Number(t.amount));
      map[key].orders += 1;
    }
  }
  return Object.entries(map).map(([label, v]) => ({
    label,
    revenue: v.revenue,
    orders: v.orders,
  }));
}

function buildMonthlySeries(
  now: Date,
  purchases: PurchaseRow[]
): SeriesPoint[] {
  const map: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    map[fmtMonth(d)] = { revenue: 0, orders: 0 };
  }
  for (const t of purchases) {
    if (!t.created_at) continue;
    const d = new Date(t.created_at);
    const key = fmtMonth(d);
    if (key in map) {
      map[key].revenue += Math.abs(Number(t.amount));
      map[key].orders += 1;
    }
  }
  return Object.entries(map).map(([label, v]) => ({
    label,
    revenue: v.revenue,
    orders: v.orders,
  }));
}

export default async function MyAdminDashboardPage() {
  const admin = createAdminClient();

  const [{ data: txs }, { data: profiles }] = await Promise.all([
    admin
      .from("transactions")
      .select("amount,transaction_type,status,created_at"),
    admin.from("profiles").select("id"),
  ]);

  const purchases = (txs || []).filter(
    (t): t is PurchaseRow =>
      t.transaction_type === "purchase" && statusCountsAsSale(t.status)
  );

  const totalSales = purchases.reduce(
    (s, t) => s + Math.abs(Number(t.amount)),
    0
  );

  const m = getRetailPriceMultiplier();
  const totalProfit = purchases.reduce((s, t) => {
    const retail = Math.abs(Number(t.amount));
    return s + retail * (1 - 1 / m);
  }, 0);

  const totalUsers = profiles?.length ?? 0;

  const now = new Date();

  const dailySeries = buildToday2hSeries(purchases, now);
  const monthlySeries = buildLast30DaysSeries(now, purchases);
  const weeklySeries = buildWeeklySeries(now, purchases);
  const yearlySeries = buildMonthlySeries(now, purchases);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of users, sales, and estimated profit. Chart: revenue (GHS) or
          order counts by day / week / month.
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
            Successful bundle purchases (customer prices)
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

      <RevenueChart
        daily={dailySeries}
        monthly={monthlySeries}
        weekly={weeklySeries}
        yearly={yearlySeries}
      />
    </div>
  );
}
