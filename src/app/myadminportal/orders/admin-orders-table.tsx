"use client";

import { useState, useMemo, useEffect } from "react";
import type { AdminOrderRow } from "@/lib/external-all-orders";
import { supabase } from "@/lib/supabase/client";
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
    row.dakazina_order_id ||
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
    row.dakazina_order_id ||
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
    (row.dakazina_order_id ?? "").toLowerCase().includes(t) ||
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
        <ShoppingCart className="h-3 w-3" /> Placed
      </Badge>
    );
  if (s === "pending" || s === "processing")
    return (
      <Badge className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90 whitespace-nowrap">
        <RefreshCw className="h-3 w-3" /> Processing
      </Badge>
    );
  if (s === "delivered")
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" /> Delivered
      </Badge>
    );
  if (s === "canceled" || s === "cancelled")
    return (
      <Badge className="gap-1 bg-zinc-200 text-zinc-900 whitespace-nowrap">
        <XCircle className="h-3 w-3" /> Canceled
      </Badge>
    );
  const displayLabel = String(status)
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return <Badge className="whitespace-nowrap bg-red-600 text-white">{displayLabel}</Badge>;
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
  const [liveRows, setLiveRows] = useState(rows);

  useEffect(() => {
    setLiveRows(rows);
  }, [rows]);

  useEffect(() => {
    const updateRowFromRecord = (record: Record<string, unknown>, table: "orders" | "transactions") => {
      setLiveRows((current) =>
        current.map((row) => {
          const matchesOrder =
            table === "orders" &&
            (
              row.id === record.id ||
              row.paystack_transaction_id === record.paystack_transaction_id ||
              row.payment_reference === record.payment_reference ||
              row.provider_order_id === record.dakazina_order_id ||
              row.dakazina_order_id === record.dakazina_order_id
            );

          const matchesTransaction =
            table === "transactions" &&
            (
              row.id === record.id ||
              row.reference === record.reference ||
              row.transaction_code === record.transaction_code ||
              row.provider_order_id === record.dakazina_order_id ||
              row.dakazina_order_id === record.dakazina_order_id
            );

          if (!matchesOrder && !matchesTransaction) {
            return row;
          }

          return {
            ...row,
            status: (record.status as string) ?? row.status,
            provider_order_id: (record.dakazina_order_id as string) ?? row.provider_order_id,
            dakazina_order_id: (record.dakazina_order_id as string) ?? row.dakazina_order_id,
            paystack_transaction_id:
              (record.paystack_transaction_id as string) ?? row.paystack_transaction_id,
            payment_reference:
              (record.payment_reference as string) ?? row.payment_reference,
            transaction_code:
              (record.transaction_code as string) ?? row.transaction_code,
            reference: (record.reference as string) ?? row.reference,
          };
        })
      );
    };

    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          if (payload.new) updateRowFromRecord(payload.new as Record<string, unknown>, "orders");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          if (payload.new) updateRowFromRecord(payload.new as Record<string, unknown>, "transactions");
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // "all" | "direct" | "store"
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // ── Date/time helper functions ────────────────────────────────────────────────────
  const setTodayRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    setRangeStart(start.toISOString().slice(0, 16));
    setRangeEnd(end.toISOString().slice(0, 16));
  };

  const setYesterdayRange = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    setRangeStart(start.toISOString().slice(0, 16));
    setRangeEnd(end.toISOString().slice(0, 16));
  };

  const setLast7DaysRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    setRangeStart(start.toISOString().slice(0, 16));
    setRangeEnd(end.toISOString().slice(0, 16));
  };

  const setLast30DaysRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    setRangeStart(start.toISOString().slice(0, 16));
    setRangeEnd(end.toISOString().slice(0, 16));
  };

  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'Not set';
    try {
      const date = new Date(dateTimeStr);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const calculateDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 'Not set';
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours % 24} hour${(diffHours % 24) > 1 ? 's' : ''}`;
      } else {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      }
    } catch {
      return 'Invalid range';
    }
  };

  // Unique networks from current data for filter dropdown
  const rowsToRender = liveRows;

  const availableNetworks = useMemo(() => {
    const nets = new Set<string>();
    rowsToRender.forEach((r) => {
      const n = getNetworkLabel(r);
      if (n && n !== "—") nets.add(n);
    });
    return Array.from(nets).sort();
  }, [rowsToRender]);

  // Unique statuses (resolved with overrides) for the filter dropdown
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    rowsToRender.forEach((r) => {
      const k = overrideKey(r);
      const current = overrides[k] ?? r.status;
      if (current) statuses.add(current);
    });
    return Array.from(statuses).sort();
  }, [rowsToRender, overrides]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return rowsToRender.filter((row) => {
      const k = overrideKey(row);
      const current = (overrides[k] ?? row.status ?? "").toLowerCase();
      const net = getNetworkLabel(row);

      const passesStatus =
        statusFilter === "all" ||
        current === statusFilter.toLowerCase();

      const passesNetwork =
        networkFilter === "all" ||
        net.toLowerCase() === networkFilter.toLowerCase();

      const passesSource =
        sourceFilter === "all" ||
        (sourceFilter === "store" && row.isStore) ||
        (sourceFilter === "direct" && !row.isStore);

      const passesSearch = rowMatchesSearch(row, search);

      return passesStatus && passesNetwork && passesSource && passesSearch;
    });
  }, [rowsToRender, overrides, search, statusFilter, networkFilter, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageIndex]);

  // Reset page when filters change
  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, networkFilter, sourceFilter]);

  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + 
    (networkFilter !== "all" ? 1 : 0) + 
    (sourceFilter !== "all" ? 1 : 0);

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setNetworkFilter("all");
    setSourceFilter("all");
    setPageIndex(0);
  }

  function parseLocalDateTime(value: string): number | null {
    if (!value) return null;
    const dt = new Date(value);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  const selectedRangeRows = useMemo(() => {
    const start = parseLocalDateTime(rangeStart);
    const end = parseLocalDateTime(rangeEnd);
    if (start == null || end == null || end < start) return [];
    return filteredRows.filter((row) => {
      const ts = new Date(row.created_at).getTime();
      return ts >= start && ts <= end;
    });
  }, [filteredRows, rangeStart, rangeEnd]);

  const selectedRangeIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedRangeRows
            .map((row) => overrideKey(row))
            .filter((id) => id && id.trim())
        )
      ),
    [selectedRangeRows]
  );

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

  async function bulkSetDeliveredByRange() {
    if (!rangeStart || !rangeEnd) {
      toast({
        title: "Pick date range",
        description: "Please choose both start and end date/time.",
        variant: "destructive",
      });
      return;
    }

    const start = parseLocalDateTime(rangeStart);
    const end = parseLocalDateTime(rangeEnd);
    if (start == null || end == null || end < start) {
      toast({
        title: "Invalid range",
        description: "End date/time must be after start date/time.",
        variant: "destructive",
      });
      return;
    }

    if (selectedRangeIds.length === 0) {
      toast({
        title: "No matching orders",
        description: "No orders found in the selected range.",
        variant: "destructive",
      });
      return;
    }

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/admin/provider-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transaction_ids: selectedRangeIds,
          status: "delivered",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Bulk update failed");

      setOverrides((prev) => {
        const next = { ...prev };
        for (const id of selectedRangeIds) {
          next[id] = "delivered";
        }
        return next;
      });

      toast({
        title: "Bulk update complete",
        description: `${selectedRangeIds.length} order(s) marked as delivered.`,
      });
    } catch (e) {
      toast({
        title: "Bulk update failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBulkUpdating(false);
    }
  }

  if (rowsToRender.length === 0) {
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

        {/* Filter dropdown: Status + Network + Source */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 shrink-0 gap-2 border border-input bg-transparent px-3 text-sm hover:bg-accent hover:text-accent-foreground">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <Badge className="rounded-full px-1.5 text-xs bg-muted text-foreground">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sourceFilter}
              onValueChange={setSourceFilter}
            >
              <DropdownMenuRadioItem value="all">All Sources</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="direct">Direct (Main Site)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="store">Store Orders</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
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
            {filteredRows.length} of {rowsToRender.length} orders
          </span>
        )}
      </div>

      {/* ── Bulk status by time range ── */}
      <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">

  {/* Header */}
  <div className="flex items-center gap-2 mb-4">
    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </div>

    <div>
      <p className="text-sm font-medium leading-none">
        Bulk mark as delivered
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        By date & time range
      </p>
    </div>
  </div>

  {/* Date & time range */}
  {/* Date & time range - Mobile optimized */}
  <div className="space-y-4 mb-3">
    {/* Mobile: Icon only */}
    <div className="sm:hidden flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {rangeStart && rangeEnd ? 'Range selected' : 'Select range'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setRangeStart('');
          setRangeEnd('');
        }}
        className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
      >
        Clear
      </Button>
    </div>

    {/* Mobile: Compact date/time inputs */}
    <div className="sm:hidden grid grid-cols-2 gap-2">
      <Input
        type="datetime-local"
        value={rangeStart}
        onChange={(e) => setRangeStart(e.target.value)}
        className="text-sm h-9 cursor-pointer"
        inputMode="numeric"
        placeholder="Start"
      />
      <Input
        type="datetime-local"
        value={rangeEnd}
        onChange={(e) => setRangeEnd(e.target.value)}
        className="text-sm h-9 cursor-pointer"
        inputMode="numeric"
        placeholder="End"
      />
    </div>

    {/* Desktop: Full interface */}
    <div className="hidden sm:block space-y-4">
      {/* Quick preset buttons */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Quick select
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Today", action: () => setTodayRange() },
            { label: "Yesterday", action: () => setYesterdayRange() },
            { label: "Last 7 days", action: () => setLast7DaysRange() },
            { label: "Last 30 days", action: () => setLast30DaysRange() },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={preset.action}
              className="text-xs h-8 hover:bg-primary/5 hover:border-primary/20 transition-colors"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Start date/time */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          <label className="text-sm font-medium cursor-pointer">
            Start date & time
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={rangeStart ? rangeStart.split('T')[0] : ''}
            onChange={(e) => {
              const time = rangeStart ? rangeStart.split('T')[1] || '00:00' : '00:00';
              setRangeStart(e.target.value ? `${e.target.value}T${time}` : '');
            }}
            className="text-sm h-10 cursor-pointer"
          />
          <Input
            type="time"
            value={rangeStart ? rangeStart.split('T')[1] || '00:00' : '00:00'}
            onChange={(e) => {
              const date = rangeStart ? rangeStart.split('T')[0] : new Date().toISOString().split('T')[0];
              setRangeStart(`${date}T${e.target.value}`);
            }}
            className="text-sm h-10 cursor-pointer"
          />
        </div>
      </div>

      {/* End date/time */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
          </div>
          <label className="text-sm font-medium cursor-pointer">
            End date & time
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={rangeEnd ? rangeEnd.split('T')[0] : ''}
            onChange={(e) => {
              const time = rangeEnd ? rangeEnd.split('T')[1] || '23:59' : '23:59';
              setRangeEnd(e.target.value ? `${e.target.value}T${time}` : '');
            }}
            className="text-sm h-10 cursor-pointer"
          />
          <Input
            type="time"
            value={rangeEnd ? rangeEnd.split('T')[1] || '23:59' : '23:59'}
            onChange={(e) => {
              const date = rangeEnd ? rangeEnd.split('T')[0] : new Date().toISOString().split('T')[0];
              setRangeEnd(`${date}T${e.target.value}`);
            }}
            className="text-sm h-10 cursor-pointer"
          />
        </div>
      </div>

      {/* Visual range indicator */}
      {(rangeStart || rangeEnd) && (
        <div className="bg-background/50 rounded-lg p-3 border border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Selected range:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRangeStart('');
                setRangeEnd('');
              }}
              className="h-6 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
            >
              Clear
            </Button>
          </div>
          <div className="mt-1 font-mono text-xs text-primary">
            {rangeStart ? formatDateTime(rangeStart) : 'Not set'} → {rangeEnd ? formatDateTime(rangeEnd) : 'Not set'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Duration: {calculateDuration(rangeStart, rangeEnd)}
          </div>
        </div>
      )}
    </div>
  </div>

  {/* Footer */}
  <div className="flex items-center justify-between gap-2 pt-1">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
          selectedRangeRows.length > 0
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {selectedRangeRows.length}
      </span>
      <span>
        {selectedRangeRows.length === 1 ? "order" : "orders"} match
      </span>
    </div>

    <Button
      onClick={bulkSetDeliveredByRange}
      disabled={bulkUpdating || selectedRangeIds.length === 0}
      size="sm"
      className="w-auto"
    >
      {bulkUpdating ? (
        <>
          <svg
            className="animate-spin mr-1.5 h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          Updating…
        </>
      ) : (
        "Mark as delivered"
      )}
    </Button>
  </div>
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
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Order ID</TableHead>
                <TableHead className="font-semibold uppercase text-xs whitespace-nowrap">Source</TableHead>
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
                        {row.isStore ? (
                          <Badge className="bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">
                            Store
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                            Direct
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {row.isStore ? (
                          <>
                            <div className="font-medium text-sm">{row.customerEmail}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.customerName}
                              <span className="ml-1 text-orange-600 font-medium">(store)</span>
                            </div>
                          </>
                        ) : (
                          <div className="font-medium">{row.customerEmail}</div>
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
                        <Badge className="bg-orange-50 text-orange-800 border-orange-200 whitespace-nowrap">
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