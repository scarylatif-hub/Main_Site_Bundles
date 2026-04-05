// src/components/orders-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState } from 'react';

import { Badge } from './ui/badge';
import type { Transaction } from '@/lib/definitions';
import { NETWORKS } from '@/lib/networks';
import { DataTable } from './ui/data-table';
import {
  ShoppingCart,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  classifyOrderStatusForDisplay,
  normalizeOrderStatus,
  ORDER_STATUSES,
} from '@/lib/order-status';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const networkMap = new Map(NETWORKS.map((n) => [n.id, n.name]));

export function orderStatusBadge(rawStatus: string) {
  const bucket = classifyOrderStatusForDisplay(rawStatus);
  // Show the exact raw label in the badge, not a bucketed label
  const displayLabel = normalizeOrderStatus(rawStatus).toUpperCase() || 'UNKNOWN';

  if (bucket === 'placed')
    return (
      <Badge className="gap-1 bg-orange-500 hover:bg-orange-500/90 text-white border-0">
        <ShoppingCart className="h-3 w-3" />
        {displayLabel}
      </Badge>
    );
  if (bucket === 'processing')
    return (
      <Badge variant="secondary" className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90">
        <RefreshCw className="h-3 w-3" />
        {displayLabel}
      </Badge>
    );
  if (bucket === 'delivered')
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3" />
        {displayLabel}
      </Badge>
    );
  if (bucket === 'canceled')
    return (
      <Badge variant="secondary" className="gap-1 bg-zinc-200 text-zinc-900">
        <XCircle className="h-3 w-3" />
        {displayLabel}
      </Badge>
    );
  return <Badge variant="outline">{displayLabel}</Badge>;
}

// ── Inline status editor (admin only) ────────────────────────────────────────

function StatusCell({
  row,
  overrides,
  onOverrideChange,
  isAdmin,
}: {
  row: Transaction;
  overrides: Record<string, string>;
  onOverrideChange: (key: string, status: string) => void;
  isAdmin?: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Best key for override lookup (reference > transaction_code > id)
  const overrideKey =
    row.reference?.trim() || row.transaction_code?.trim() || row.id;

  const currentOverride = overrides[overrideKey];
  const displayStatus = currentOverride ?? row.status;

  async function save(newStatus: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/orders/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: overrideKey, status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save');
      }
      onOverrideChange(overrideKey, newStatus);
      toast({ title: 'Status updated' });
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Could not save status',
      });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (!isAdmin) return orderStatusBadge(displayStatus);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        {orderStatusBadge(displayStatus)}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
          title="Edit status"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        defaultValue={currentOverride ?? normalizeOrderStatus(row.status)}
        onValueChange={save}
        disabled={saving}
      >
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={() => setEditing(false)}
        disabled={saving}
        title="Cancel"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── Column factory ────────────────────────────────────────────────────────────

function buildColumns(
  overrides: Record<string, string>,
  onOverrideChange: (key: string, status: string) => void,
  isAdmin?: boolean
): ColumnDef<Transaction>[] {
  return [
    {
      accessorKey: 'transaction_code',
      header: 'ORDER ID',
      cell: ({ row }) => {
        const code = row.getValue('transaction_code') as string | null;
        const ref = row.original.reference;
        const id = row.original.id;
        const label = ref || code || id.slice(0, 8);
        return (
          <Link
            href={`/orders#${id}`}
            className="font-medium text-primary hover:underline"
          >
            #{String(label).replace(/^#/, '').slice(0, 12)}
          </Link>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: 'DATE',
      cell: ({ row }) => {
        const dt = new Date(row.getValue('created_at') as string);
        return (
          <div className="text-sm whitespace-nowrap">
            <div>{format(dt, 'MMM d')}</div>
            <div className="text-muted-foreground text-xs">{format(dt, 'h:mm a')}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'recipient_msisdn',
      header: 'BENEFICIARY',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-mono text-sm">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {row.getValue('recipient_msisdn') || '—'}
        </div>
      ),
    },
    {
      accessorKey: 'network_id',
      header: 'NETWORK',
      cell: ({ row }) => {
        const networkId = row.getValue('network_id') as number;
        const name = networkMap.get(networkId) || '—';
        return (
          <Badge
            variant="outline"
            className="gap-1 bg-orange-50 text-orange-800 border-orange-200"
          >
            {name}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'bundle_amount',
      header: 'VOLUME',
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('bundle_amount') || '—'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      cell: ({ row }) => (
        <StatusCell
          row={row.original}
          overrides={overrides}
          onOverrideChange={onOverrideChange}
          isAdmin={isAdmin}
        />
      ),
    },
    {
      accessorKey: 'amount',
      header: () => <div className="text-right">PRICE</div>,
      cell: ({ row }) => {
        const amount = Math.abs(parseFloat(row.getValue('amount')));
        return (
          <div className="text-right font-bold text-green-600 tabular-nums">
            GHS {amount.toFixed(2)}
          </div>
        );
      },
    },
  ];
}

// ── Public component ──────────────────────────────────────────────────────────

export function OrdersTable({
  data,
  onRefresh,
  isAdmin,
  initialOverrides = {},
}: {
  data: Transaction[];
  onRefresh?: () => void;
  isAdmin?: boolean;
  initialOverrides?: Record<string, string>;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>(initialOverrides);

  function handleOverrideChange(key: string, status: string) {
    setOverrides((prev) => ({ ...prev, [key]: status }));
  }

  const columns = buildColumns(overrides, handleOverrideChange, isAdmin);

  return (
    <DataTable
      columns={columns}
      data={data}
      onRefresh={onRefresh}
      filterColumn="recipient_msisdn"
    />
  );
}