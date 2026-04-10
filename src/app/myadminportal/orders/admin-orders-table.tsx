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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  ShoppingCart, RefreshCw, CheckCircle2, XCircle,
  ChevronDown, Search, Filter, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TablePaginationBar,
  PAGE_SIZE,
} from "@/components/ui/table-pagination-bar";

const networkMap = new Map(NETWORKS.map((n) => [n.id, n.name]));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function overrideKey(row: AdminOrderRow): string {
  return (
    row.reference ||
    row.transaction_code ||
    row.provider_order_id ||
    row.id
  ).trim();
}

function getNetworkLabel(row: AdminOrderRow): string {
  return (
    row.network_label ||
    (row.network_id != null ? networkMap.get(row.network_id) ?? "—" : "—")
  );
}

function getApiOrderId(row: AdminOrderRow): string {
  return (
    row.provider_order_id ||
    row.reference ||
    row.transaction_code ||
    String(row.id).slice(0, 12)
  );
}

// Universal search: checks every meaningful field on a row
function rowMatchesSearch(row: AdminOrderRow, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  const net = getNetworkLabel(row).toLowerCase();
  const apiId = getApiOrderId(row).toLowerCase();
  return (
    apiId.includes(t) ||
    String(row.id).toLowerCase().includes(t) ||
    (row.reference ?? "").toLowerCase().includes(t) ||
    (row.transaction_code ?? "").toLowerCase().includes(t) ||
    (row.provider_order_id ?? "").toLowerCase().includes(t) ||
    (row.customerEmail ?? "").toLowerCase().includes(t) ||
    (row.customerName ?? "").toLowerCase().includes(t) ||
    (row.recipient_msisdn ?? "").toLowerCase().includes(t) ||
    net.includes(t) ||
    (row.bundle_amount != null ? String(row.bundle_amount).toLowerCase().includes(t) : false) ||
    (row.status ?? "").toLowerCase().includes(t)
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "success" || s === "placed" || s === "completed")
    return (
      <Badge className="gap-1 bg-orange-500 hover:bg-orange-500/90 text-white border-0 whitespace-nowrap">
        <ShoppingCart className="h-3 w-3" /> PLACED
      </Badge>
    );
  if (s === "pending" || s === "processing")
    return (
      <Badge variant="secondary" className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90 whitespace-nowrap">
        <RefreshCw className="h-3 w-3" /> PROCESSING
      </Badge>
    );
  if (s === "delivered")
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" /> DELIVERED
      </Badge>
    );
  if (s === "canceled" || s === "cancelled")
    return (
      <Badge variant="secondary" className="gap-1 bg-zinc-200 text-zinc-900 whitespace-nowrap">
        <XCircle className="h-3 w-3" /> CANCELED
      </Badge>
    );
  return <Badge variant="destructive" className="whitespace-nowrap">{status.toUpperCase()}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");

  // Unique networks from current data for the filter dropdown
  const availableNetworks = useMemo(() => {
    const nets = new Set<string>();
    rows.forEach((r) => {
      const n = getNetworkLabel(r);
      if (n && n !== "—") nets.add(n);
    });
    return Array.from(nets).sort();
  }, [rows]);

  // Unique statuses (resolved with overrides) for the filter dropdown
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((r) => {
      const k = overrideKey(r);
      const current = overrides[k] ?? r.status;
      if (current) statuses.add(current);
    });
    return Array.from(statuses).sort();
  }, [rows, overrides]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const k = overrideKey(row);
      const current = (overrides[k] ?? row.status ?? "").toLowerCase();
      const net = getNetworkLabel(row);

      const passesStatus =
        statusFilter === "all" ||
        current === statusFilter.toLowerCase();

      const passesNetwork =
        networkFilter === "all" ||
        net.toLowerCase() === networkFilter.toLowerCase();

      const passesSearch = rowMatchesSearch(row, search);

      return passesStatus && passesNetwork && passesSearch;
    });
  }, [rows, overrides, search, statusFilter, networkFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageIndex]);

  // Reset page when filters change
  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, networkFilter]);

  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (networkFilter !== "all" ? 1 : 0);

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setNetworkFilter("all");
    setPageIndex(0);
  }

  // ── Status update ─────────────────────────────────────────────────────────
  async function updateStatus(row: AdminOrderRow, status: string) {
    const transaction_id = overrideKey(row);
    if (!transaction_id) {
      toast({ title: "Missing reference", description: "No transaction code to attach status to.", variant: "destructive" });
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
      if (!res.ok) throw new Error(j.error || "Update failed");
      setOverrides((prev) => ({ ...prev, [transaction_id]: status }));
      toast({ title: "Status updated", description: status });
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-center py-12">No orders yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full min-w-0">

        {/* Universal search */}
        <div className="relative flex-1 w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by order ID, email, phone, name, network…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 w-full"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdown: Status + Network */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="rounded-full px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
              {availableStatuses.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filter by Network</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={networkFilter}
              onValueChange={setNetworkFilter}
            >
              <DropdownMenuRadioItem value="all">All Networks</DropdownMenuRadioItem>
              {availableNetworks.map((n) => (
                <DropdownMenuRadioItem key={n} value={n}>{n}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={clearAllFilters}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <X className="h-4 w-4" /> Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Active filter summary */}
        {(activeFilterCount > 0 || search) && (
          <span className="text-xs text-muted-foreground shrink-0">
            {filteredRows.length} of {rows.length} orders
          </span>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="w-full min-w-0 rounded-md border bg-card overflow-hidden">
        <div
          className={cn(
            "w-full overflow-x-auto",
            "[&::-webkit-scrollbar]:h-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:bg-gray-200",
            "[&::-webkit-scrollbar-thumb]:rounded-full"
          )}
        >
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Order ID (API)</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Customer</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Date</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Beneficiary</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Network</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Volume</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Status</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const dt = new Date(row.created_at);
                  const price = Math.abs(Number(row.amount));
                  const net = getNetworkLabel(row);
                  const apiOrderId = getApiOrderId(row);
                  const k = overrideKey(row);
                  const current = overrides[k] ?? row.status;
                  const busy = !k || saving === k;

                  return (
                    <TableRow key={`${row.id}-${k}`} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-primary font-mono text-sm whitespace-nowrap">
                        #{String(apiOrderId).replace(/^#/, "").slice(0, 24)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="font-medium">{row.customerEmail}</div>
                        {row.customerName && (
                          <div className="text-xs text-muted-foreground">{row.customerName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div>{format(dt, "MMM d")}</div>
                        <div className="text-muted-foreground text-xs">{format(dt, "h:mm a")}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap">
                        {row.recipient_msisdn ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 whitespace-nowrap">
                          {net}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.bundle_amount ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
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
                              <StatusBadge status={current} />
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
                                  String(current || "").toLowerCase() === s && "bg-muted font-medium"
                                )}
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 tabular-nums whitespace-nowrap">
                        GHS{price.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {search || activeFilterCount > 0
                      ? "No orders match your search or filters."
                      : "No orders yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <TablePaginationBar
        pageIndex={pageIndex}
        pageCount={pageCount}
        totalRows={filteredRows.length}
        onPageChange={setPageIndex}
      />
    </div>
  );
}