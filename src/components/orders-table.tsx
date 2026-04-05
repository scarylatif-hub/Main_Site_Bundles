'use client';

import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { format } from 'date-fns';

import { Badge } from './ui/badge';
import type { Transaction } from '@/lib/definitions';
import { NETWORKS } from '@/lib/networks';
import { DataTable } from './ui/data-table';
import { ShoppingCart, RefreshCw, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { statusForCustomer } from '@/lib/order-status';

const networkMap = new Map(NETWORKS.map((n) => [n.id, n.name]));

function orderStatusBadge(rawStatus: string) {
  const s = statusForCustomer(rawStatus).toLowerCase();
  if (s === 'placed')
    return (
      <Badge className="gap-1 bg-orange-500 hover:bg-orange-500/90 text-white border-0">
        <ShoppingCart className="h-3 w-3" />
        PLACED
      </Badge>
    );
  if (s === 'processing')
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90"
      >
        <RefreshCw className="h-3 w-3" />
        PROCESSING
      </Badge>
    );
  if (s === 'delivered')
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3" />
        DELIVERED
      </Badge>
    );
  if (s === 'canceled' || s === 'cancelled')
    return (
      <Badge variant="secondary" className="gap-1 bg-zinc-200 text-zinc-900">
        <XCircle className="h-3 w-3" />
        CANCELED
      </Badge>
    );
  return <Badge variant="destructive">{s.toUpperCase()}</Badge>;
}

const columns: ColumnDef<Transaction>[] = [
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
    cell: ({ row }) => orderStatusBadge(String(row.getValue('status'))),
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">PRICE</div>,
    cell: ({ row }) => {
      const amount = Math.abs(parseFloat(row.getValue('amount')));
      return (
        <div className="text-right font-bold text-green-600 tabular-nums">
          GHS{amount.toFixed(2)}
        </div>
      );
    },
  },
];

export function OrdersTable({ data, onRefresh }: { data: Transaction[]; onRefresh?: () => void }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      onRefresh={onRefresh}
      filterColumn="recipient_msisdn"
    />
  );
}
