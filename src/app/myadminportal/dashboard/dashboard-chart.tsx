"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "./page";

type Mode   = "daily" | "monthly" | "weekly" | "yearly";
type Metric = "revenue" | "orders" | "profit";

const MODES: { key: Mode; label: string }[] = [
  { key: "daily",   label: "Today" },
  { key: "monthly", label: "Last 30 days" },
  { key: "weekly",  label: "Weekly" },
  { key: "yearly",  label: "Monthly" },
];

type Props = {
  daily:   SeriesPoint[];
  monthly: SeriesPoint[];
  weekly:  SeriesPoint[];
  yearly:  SeriesPoint[];
};

export function DashboardChart({ daily, monthly, weekly, yearly }: Props) {
  const [mode,   setMode]   = useState<Mode>("monthly");
  const [metric, setMetric] = useState<Metric>("revenue");
  const canvasRef           = useRef<HTMLCanvasElement>(null);
  const chartRef            = useRef<{ destroy: () => void } | null>(null);

  const datasets: Record<Mode, SeriesPoint[]> = { daily, monthly, weekly, yearly };
  const pts   = datasets[mode];
  const total = pts.reduce((s, d) => {
    if (metric === "revenue") return s + d.revenue;
    if (metric === "profit") return s + d.profit;
    return s + d.orders;
  }, 0);

  const totalLabel =
    metric === "revenue"
      ? "Revenue GHS"
      : metric === "profit"
        ? mode === "daily"
          ? "Profit"
          : "Profit GHS"
        : "Total orders";

  useEffect(() => {
    let cancelled = false;

    import("chart.js/auto").then((mod) => {
      if (cancelled || !canvasRef.current) return;

      const Chart = mod.default;
      chartRef.current?.destroy();

      const isDark     = document.documentElement.classList.contains("dark");
      const barColor   = isDark ? "rgba(74,222,128,0.45)" : "rgba(74,222,128,0.35)";
      const barBorder  = isDark ? "rgba(34,197,94,0.95)"  : "rgba(22,163,74,0.85)";
      const barHover   = isDark ? "rgba(74,222,128,0.9)"  : "rgba(22,163,74,0.75)";
      const gridColor  = isDark ? "rgba(255,255,255,0.06)": "rgba(0,0,0,0.06)";
      const tickColor  = isDark ? "rgba(255,255,255,0.35)": "rgba(0,0,0,0.35)";
      const tooltipBg  = isDark ? "#1e1e1e" : "#ffffff";
      const tooltipFg  = isDark ? "#f1f5f9" : "#0f172a";
      const tooltipSub = isDark ? "#94a3b8" : "#64748b";

      const values = pts.map((d) => {
        if (metric === "revenue") return d.revenue;
        if (metric === "profit") return d.profit;
        return d.orders;
      });

      chartRef.current = new Chart(canvasRef.current!, {
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
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: tooltipBg,
              titleColor: tooltipFg,
              bodyColor: tooltipSub,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                title: (items) => items[0]?.label ?? "",
                label: (ctx) => {
                  const p = pts[ctx.dataIndex];
                  if (!p) return "";
                  if (metric === "revenue") {
                    return [
                      `Revenue:  GHS ${p.revenue.toFixed(2)}`,
                      `Profit:   GHS ${p.profit.toFixed(2)}`,
                      `Orders:   ${p.orders}`,
                    ] as unknown as string;
                  }
                  if (metric === "profit") {
                    return [
                      `Profit:   GHS ${p.profit.toFixed(2)}`,
                      `Revenue:  GHS ${p.revenue.toFixed(2)}`,
                      `Orders:   ${p.orders}`,
                    ] as unknown as string;
                  }
                  return [
                    `Orders:   ${p.orders}`,
                    `Revenue:  GHS ${p.revenue.toFixed(2)}`,
                    `Profit:   GHS ${p.profit.toFixed(2)}`,
                  ] as unknown as string;
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
                  if (metric === "orders") return Number.isInteger(n) ? String(n) : "";
                  if (metric === "profit" || metric === "revenue") {
                    return n === 0 ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                  }
                  return n === 0 ? "0" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, metric, daily, monthly, weekly, yearly]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">

          {/* Mode filter buttons */}
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

          {/* Metric toggle + running total */}
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
              <button
                type="button"
                onClick={() => setMetric("profit")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  metric === "profit"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Today&apos;s profit
              </button>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">{totalLabel}</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {metric === "orders"
                  ? Math.round(total).toLocaleString("en-GH")
                  : total.toLocaleString("en-GH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </p>
            </div>
          </div>

        </div>
      </CardHeader>

      <CardContent>
        <div className="relative w-full h-[280px]">
          <canvas ref={canvasRef} />
        </div>
      </CardContent>
    </Card>
  );
}