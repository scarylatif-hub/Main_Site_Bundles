"use client";

import { useState, useMemo, useEffect } from "react";
import type { AdminOrderRow } from "@/lib/external-all-orders";
import { NETWORKS } from "@/lib/networks";
import { ORDER_STATUSES } from "@/lib/order-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ShoppingCart, RefreshCw, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TablePaginationBar,
  PAGE_SIZE,
} from "@/components/ui/table-pagination-bar";

const networkMap = new Map(NETWORKS.map((n) => [n.id, n.name]));

function overrideKey(row: AdminOrderRow): string {
  return (
    row.reference ||
    row.transaction_code ||
    row.provider_order_id ||
    row.id
  ).trim();
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "success" || s === "placed" || s === "completed")
    return (
      <Badge className="gap-1 bg-orange-500 hover:bg-orange-500/90 text-white border-0">
        <ShoppingCart className="h-3 w-3" />
        PLACED
      </Badge>
    );
  if (s === "pending" || s === "processing")
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90"
      >
        <RefreshCw className="h-3 w-3" />
        PROCESSING
      </Badge>
    );
  if (s === "delivered")
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3" />
        DELIVERED
      </Badge>
    );
  if (s === "canceled" || s === "cancelled")
    return (
      <Badge variant="secondary" className="gap-1 bg-zinc-200 text-zinc-900">
        <XCircle className="h-3 w-3" />
        CANCELED
      </Badge>
    );
  return <Badge variant="destructive">{status.toUpperCase()}</Badge>;
}

export function AdminOrdersTable({
  rows,
  initialOverrides,
}: {
  rows: AdminOrderRow[];
  initialOverrides: Record<string, string>;
}) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, string>>(
    () => ({ ...initialOverrides })
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, pageIndex]);

  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, pageCount - 1)));
  }, [pageCount, rows.length]);

  async function updateStatus(row: AdminOrderRow, status: string) {
    const transaction_id = overrideKey(row);
    if (!transaction_id) {
      toast({
        title: "Missing reference",
        description: "This row has no transaction code to attach status to.",
        variant: "destructive",
      });
      return;
    }
    setSaving(transaction_id);
    try {
      const res = await fetch("/api/admin/provider-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transaction_id, status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "Update failed");
      }
      setOverrides((prev) => ({ ...prev, [transaction_id]: status }));
      toast({ title: "Status updated", description: status });
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-12">No orders yet.</p>
    );
  }

  return (
    <div className="space-y-4">
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/80 hover:bg-muted/80">
            <TableHead className="font-semibold uppercase text-xs">
              Order ID (API)
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Customer
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Date
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Beneficiary
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Network
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Volume
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs">
              Status
            </TableHead>
            <TableHead className="font-semibold uppercase text-xs text-right">
              Price
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedRows.map((row) => {
            const dt = new Date(row.created_at);
            const price = Math.abs(Number(row.amount));
            const net =
              row.network_label ||
              (row.network_id != null
                ? networkMap.get(row.network_id) ?? "—"
                : "—");
            const apiOrderId =
              row.provider_order_id ||
              row.reference ||
              row.transaction_code ||
              String(row.id).slice(0, 12);
            const k = overrideKey(row);
            const current = overrides[k] ?? row.status;
            const busy = !k || saving === k;

            return (
              <TableRow key={`${row.id}-${k}`}>
                <TableCell className="font-medium text-primary font-mono text-sm">
                  #{String(apiOrderId).replace(/^#/, "").slice(0, 24)}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">{row.customerEmail}</div>
                  {row.customerName ? (
                    <div className="text-xs text-muted-foreground">
                      {row.customerName}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  <div>{format(dt, "MMM d")}</div>
                  <div className="text-muted-foreground text-xs">
                    {format(dt, "h:mm a")}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {row.recipient_msisdn ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="bg-orange-50 text-orange-800 border-orange-200"
                  >
                    {net}
                  </Badge>
                </TableCell>
                <TableCell>{row.bundle_amount ?? "—"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={busy}>
                      <button
                        type="button"
                        title="Change order status"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md text-left transition-opacity",
                          busy && "opacity-50 cursor-not-allowed",
                          !busy && "cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                      >
                        {statusBadge(current)}
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      {ORDER_STATUSES.map((s) => (
                        <DropdownMenuItem
                          key={s}
                          disabled={busy}
                          onClick={() => updateStatus(row, s)}
                          className={cn(
                            String(current || "").toLowerCase() === s &&
                              "bg-muted font-medium"
                          )}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className="text-right font-bold text-green-600 tabular-nums">
                  GHS{price.toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    <TablePaginationBar
      pageIndex={pageIndex}
      pageCount={pageCount}
      totalRows={rows.length}
      onPageChange={setPageIndex}
    />
    </div>
  );
}
