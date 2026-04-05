"use client";

import { useState, useMemo, useEffect } from "react";
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
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { useToast } from "@/hooks/use-toast";

export function AdminUsersClient({ users }: { users: Profile[] }) {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedUsers.map((u) => {
            const isPrimaryAdmin =
              u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell className="text-sm">{u.phone_number}</TableCell>
                <TableCell className="text-right tabular-nums">
                  GHS {Number(u.wallet_balance).toFixed(2)}
                </TableCell>
                <TableCell className="text-right space-x-2">
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
      totalRows={users.length}
      onPageChange={setPageIndex}
    />
    </div>
  );
}

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
      toast({
        variant: "destructive",
        title: "Invalid balance",
        description: "Enter a non-negative number.",
      });
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
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setLoading(false);
    }
  }

  async function applyAdjustment() {
    const adj = parseFloat(adjustment);
    if (adjustment.trim() === "" || Number.isNaN(adj)) {
      toast({
        variant: "destructive",
        title: "Invalid adjustment",
        description: "Enter a number (negative subtracts from wallet).",
      });
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
        description:
          adj >= 0
            ? `Added GHS ${adj.toFixed(2)}`
            : `Deducted GHS ${Math.abs(adj).toFixed(2)}`,
      });
      setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetFields();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Balance
        </Button>
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
              Positive adds to wallet; negative deducts (e.g. wrong credit).
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={applyAdjustment}
              disabled={loading}
            >
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
            <Button
              type="button"
              className="w-full"
              onClick={saveExact}
              disabled={loading}
            >
              Set exact balance
            </Button>
          </div>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
