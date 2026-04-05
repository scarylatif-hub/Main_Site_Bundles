"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One bar: revenue (GHS) and order count for the same time bucket */
export type SeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
};

type RevenueChartProps = {
  daily: SeriesPoint[];
  monthly: SeriesPoint[];
  weekly: SeriesPoint[];
  yearly: SeriesPoint[];
};

type Mode = "daily" | "monthly" | "weekly" | "yearly";

type Metric = "revenue" | "orders";

const MODES: { key: Mode; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "monthly", label: "Last 30 days" },
  { key: "weekly", label: "Weekly" },
  { key: "yearly", label: "Monthly" },
];

export function RevenueChart({
  daily,
  monthly,
  weekly,
  yearly,
}: RevenueChartProps) {
  const [mode, setMode] = useState<Mode>("monthly");
  const [metric, setMetric] = useState<Metric>("revenue");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);

  const datasets: Record<Mode, SeriesPoint[]> = {
    daily,
    monthly,
    weekly,
    yearly,
  };

  const pts = datasets[mode];
  const total = pts.reduce(
    (s, d) => s + (metric === "revenue" ? d.revenue : d.orders),
    0
  );

  useEffect(() => {
    let cancelled = false;

    import("chart.js/auto").then((mod) => {
      if (cancelled) return;
      const Chart = mod.default;
      const canvas = canvasRef.current;
      if (!canvas) return;

      chartRef.current?.destroy();

      const isDark = document.documentElement.classList.contains("dark");
      const barColor = isDark
        ? "rgba(74,222,128,0.45)"
        : "rgba(74,222,128,0.35)";
      const barBorder = isDark
        ? "rgba(34,197,94,0.95)"
        : "rgba(22,163,74,0.85)";
      const barHover = isDark
        ? "rgba(74,222,128,0.9)"
        : "rgba(22,163,74,0.75)";
      const gridColor = isDark
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.06)";
      const tickColor = isDark
        ? "rgba(255,255,255,0.35)"
        : "rgba(0,0,0,0.35)";

      const values = pts.map((d) =>
        metric === "revenue" ? d.revenue : d.orders
      );

      chartRef.current = new Chart(canvas, {
        type: "bar",
        data: {
          labels: pts.map((d) => d.label),
          datasets: [
            {
              data: values,
              backgroundColor: barColor,
              borderColor: barBorder,
              borderWidth: 1.5,
              hoverBackgroundColor: barHover,
              borderRadius: 4,
              borderSkipped: false,
              barPercentage: 0.55,
              categoryPercentage: 0.85,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.parsed.y);
                  if (metric === "revenue")
                    return ` GHS ${v.toFixed(2)}`;
                  return ` ${v} orders`;
                },
                afterLabel: (ctx) => {
                  const i = ctx.dataIndex;
                  const p = pts[i];
                  if (!p) return "";
                  if (metric === "revenue")
                    return `${p.orders} order(s)`;
                  return `GHS ${p.revenue.toFixed(2)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: tickColor,
                font: { size: 11 },
                maxRotation: 45,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: mode === "daily" ? 12 : 14,
              },
            },
            y: {
              grid: { color: gridColor },
              border: { display: false },
              ticks: {
                color: tickColor,
                font: { size: 11 },
                callback: (v) => {
                  const n = Number(v);
                  if (metric === "orders")
                    return Number.isInteger(n) ? String(n) : String(n);
                  return n === 0 ? "0" : String(n);
                },
              },
              beginAtZero: true,
            },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [mode, metric, daily, monthly, weekly, yearly]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === key
                    ? "border-border bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 sm:justify-end">
            <div className="flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMetric("revenue")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  metric === "revenue"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Revenue GHS
              </button>
              <button
                type="button"
                onClick={() => setMetric("orders")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  metric === "orders"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Orders
              </button>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {metric === "revenue" ? "Revenue GHS" : "Orders"}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {metric === "revenue"
                  ? total.toLocaleString("en-GH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : Math.round(total).toLocaleString("en-GH")}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[280px]">
          <canvas ref={canvasRef} className="max-h-[280px]" />
        </div>
      </CardContent>
    </Card>
  );
}
