"use client";

import { useState, useMemo } from "react";
import type { Profile } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, X, Check, XCircle, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

// ─── Pagination ───────────────────────────────────────────────────────────────

function TablePaginationBar({
  pageIndex,
  pageCount,
  totalRows,
  filteredRows,
  onPageChange,
}: {
  pageIndex: number;
  pageCount: number;
  totalRows: number;
  filteredRows: number;
  onPageChange: (p: number) => void;
}) {
  if (pageCount <= 1 && filteredRows === totalRows) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {filteredRows < totalRows
          ? `Showing ${filteredRows} of ${totalRows} users`
          : `Page ${pageIndex + 1} of ${pageCount} — ${totalRows} users`}
      </span>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => onPageChange(pageIndex - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => onPageChange(pageIndex + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── CSV Export helper ────────────────────────────────────────────────────────

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const content =
    headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.visibility = "hidden";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminUsersClient({ users }: { users: Profile[] }) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Filter state — one search term, applied across name + email + phone
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState<"all" | "name" | "email" | "phone">("all");

  // Derived filtered list
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const name = u.full_name?.toLowerCase() ?? "";
      const email = u.email?.toLowerCase() ?? "";
      const phone = (u as any).phone_number?.toLowerCase() ?? "";
      switch (filterField) {
        case "name":  return name.includes(term);
        case "email": return email.includes(term);
        case "phone": return phone.includes(term);
        default:      return name.includes(term) || email.includes(term) || phone.includes(term);
      }
    });
  }, [users, search, filterField]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedUsers = useMemo(
    () => filtered.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [filtered, pageIndex]
  );

  function handleSearch(val: string) {
    setSearch(val);
    setPageIndex(0);
  }

  function clearSearch() {
    setSearch("");
    setFilterField("all");
    setPageIndex(0);
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  function exportPhoneOnly() {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const rows = filtered.map((u) => [escapeCsv((u as any).phone_number || "N/A")]);
    downloadCsv(`users-phones-${today()}.csv`, ["Phone Number"], rows);
    toast({ title: "Exported phone numbers" });
  }

  function exportPhoneAndEmail() {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const rows = filtered.map((u) => [
      escapeCsv((u as any).phone_number || "N/A"),
      escapeCsv(u.email || "N/A"),
    ]);
    downloadCsv(`users-phone-email-${today()}.csv`, ["Phone Number", "Email"], rows);
    toast({ title: "Exported phone + email" });
  }

  function exportAll() {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const rows = filtered.map((u) => [
      escapeCsv(u.id),
      escapeCsv(u.full_name),
      escapeCsv(u.email),
      escapeCsv((u as any).phone_number || "N/A"),
      escapeCsv(Number(u.wallet_balance).toFixed(2)),
    ]);
    downloadCsv(`users-all-${today()}.csv`, ["ID", "Name", "Email", "Phone", "Balance (GHS)"], rows);
    toast({ title: "Exported all user data" });
  }

  // ── Store Approval ──────────────────────────────────────────────────────────────

  async function handleStoreApproval(userId: string, approved: boolean) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/stores/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Approval action failed");
      toast({ 
        title: approved ? "Store approved" : "Store declined",
        description: approved ? "The store is now active" : "The store request was rejected"
      });
      window.location.reload();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Approval action failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Delete failed");
      toast({ title: "User deleted" });
      window.location.reload();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Delete failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  const FILTER_LABELS: Record<typeof filterField, string> = {
    all: "All fields",
    name: "Name",
    email: "Email",
    phone: "Phone",
  };

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full min-w-0">

        {/* Search input + field selector */}
        <div className="flex flex-1 w-full min-w-0 items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={`Search by ${FILTER_LABELS[filterField].toLowerCase()}...`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-8 w-full"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter field pill selector */}
          <div className="flex items-center gap-1 shrink-0">
            {(["all", "name", "email", "phone"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilterField(f); setPageIndex(0); }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  filterField === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-2">
              <Download className="h-4 w-4" />
              Export
              {filtered.length < users.length && (
                <Badge variant="secondary" className="rounded-full px-1.5 text-xs">
                  {filtered.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Exports {filtered.length} {filtered.length < users.length ? "filtered" : ""} user{filtered.length !== 1 ? "s" : ""}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportPhoneOnly} className="gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              Phone numbers only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPhoneAndEmail} className="gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              Phone + Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportAll} className="gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              All user data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap font-semibold">Name</TableHead>
                <TableHead className="whitespace-nowrap font-semibold">Email</TableHead>
                <TableHead className="whitespace-nowrap font-semibold">Phone</TableHead>
                <TableHead className="whitespace-nowrap font-semibold">Store Status</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-right">Balance</TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.length > 0 ? (
                pagedUsers.map((u) => {
                  const isPrimaryAdmin =
                    u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                  return (
                    <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap">{u.full_name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{u.email}</TableCell>
                      <TableCell className="text-sm font-mono whitespace-nowrap">
                        {(u as any).phone_number || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {u.is_reseller ? (
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-blue-600" />
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{u.store_name || 'No Store Name'}</span>
                              {u.reseller_approved ? (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800">Approved</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Pending Approval</Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Regular User</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap font-semibold text-emerald-600">
                        GHS {Number(u.wallet_balance).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {u.is_reseller && !u.reseller_approved && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                disabled={busyId === u.id}
                                onClick={() => handleStoreApproval(u.id, true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busyId === u.id}
                                onClick={() => handleStoreApproval(u.id, false)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                            </>
                          )}
                          <BalanceDialog
                            userId={u.id}
                            current={Number(u.wallet_balance)}
                            disabled={busyId === u.id}
                            onSaved={() => window.location.reload()}
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isPrimaryAdmin || busyId === u.id}
                            onClick={() => deleteUser(u.id, u.email)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {search
                      ? `No users match "${search}" in ${FILTER_LABELS[filterField].toLowerCase()}`
                      : "No users found."}
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
        totalRows={users.length}
        filteredRows={filtered.length}
        onPageChange={setPageIndex}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── BalanceDialog (unchanged logic, cleaned up) ──────────────────────────────

function BalanceDialog({
  userId,
  current,
  disabled,
  onSaved,
}: {
  userId: string;
  current: number;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [exact, setExact] = useState(String(current));
  const [adjustment, setAdjustment] = useState("");
  const [loading, setLoading] = useState(false);

  function resetFields() {
    setExact(String(current));
    setAdjustment("");
  }

  async function saveExact() {
    const n = parseFloat(exact);
    if (Number.isNaN(n) || n < 0) {
      toast({ variant: "destructive", title: "Invalid balance", description: "Enter a non-negative number." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_balance: n }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      toast({ title: "Balance set" });
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setLoading(false);
    }
  }

  async function applyAdjustment() {
    const adj = parseFloat(adjustment);
    if (adjustment.trim() === "" || Number.isNaN(adj)) {
      toast({ variant: "destructive", title: "Invalid adjustment", description: "Enter a number (negative subtracts)." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment: adj }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      toast({
        title: "Balance updated",
        description: adj >= 0 ? `Added GHS ${adj.toFixed(2)}` : `Deducted GHS ${Math.abs(adj).toFixed(2)}`,
      });
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetFields(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>Balance</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet balance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-semibold text-foreground">GHS {current.toFixed(2)}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="adj">Adjustment (GHS)</Label>
            <Input
              id="adj"
              type="number"
              step="0.01"
              placeholder="e.g. -25 to deduct 25"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Positive adds to wallet; negative deducts.
            </p>
            <Button type="button" variant="secondary" className="w-full" onClick={applyAdjustment} disabled={loading}>
              Apply adjustment
            </Button>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="exact">Or set exact balance (GHS)</Label>
            <Input
              id="exact"
              type="number"
              min={0}
              step="0.01"
              value={exact}
              onChange={(e) => setExact(e.target.value)}
            />
            <Button type="button" className="w-full" onClick={saveExact} disabled={loading}>
              Set exact balance
            </Button>
          </div>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}