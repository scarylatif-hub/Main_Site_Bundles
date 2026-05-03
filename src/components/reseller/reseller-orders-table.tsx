'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, ShoppingCart, CheckCircle2, XCircle, RefreshCw as Processing } from 'lucide-react';

interface StoreOrder {
  id: string;
  customer_phone: string;
  amount: number;
  status: string;
  created_at: string;
  package_id: number;
  network_id: number;
  data_amount?: string;
  customer?: {
    full_name: string;
    email: string;
    phone_number: string;
  };
}

interface PersonalOrder {
  id: string;
  transaction_code?: string;
  reference?: string;
  recipient_msisdn?: string;
  amount: number;
  status: string;
  created_at: string;
  network_id?: number;
  bundle_amount?: string;
}

interface ResellerOrdersTableProps {
  orders: StoreOrder[] | PersonalOrder[];
  type: 'personal' | 'store';
  onRefresh?: () => void;
  loading?: boolean;
}

const NETWORK_MAP: Record<number, string> = {
  1: 'MTN',
  2: 'Telecel',
  3: 'AirtelTigo',
};

function getNetworkName(networkId: number): string {
  return NETWORK_MAP[networkId] || `Network ${networkId}`;
}

function orderStatusBadge(status: string) {
  const normalized = status?.toLowerCase() || 'unknown';
  
  if (['completed', 'delivered', 'success'].includes(normalized)) {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
  if (['processing', 'pending', 'placed'].includes(normalized)) {
    return (
      <Badge variant="secondary" className="gap-1 bg-sky-100 text-sky-900 hover:bg-sky-100/90">
        <Processing className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
  if (['failed', 'canceled', 'cancelled', 'error'].includes(normalized)) {
    return (
      <Badge variant="secondary" className="gap-1 bg-zinc-200 text-zinc-900">
        <XCircle className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-orange-500 hover:bg-orange-500/90 text-white border-0">
      <ShoppingCart className="h-3 w-3" />
      {status?.toUpperCase() || 'PENDING'}
    </Badge>
  );
}

export function ResellerOrdersTable({ orders, type, onRefresh, loading }: ResellerOrdersTableProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No orders found</p>
        {type === 'personal' && <p className="text-sm mt-1">You haven&apos;t made any purchases yet</p>}
        {type === 'store' && <p className="text-sm mt-1">No customers have purchased from your store yet</p>}
      </div>
    );
  }

  const isStoreOrder = (order: StoreOrder | PersonalOrder): order is StoreOrder => {
    return type === 'store' && 'customer_phone' in order;
  };

  return (
    <div className="space-y-4">
      {onRefresh && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const orderId = order.id.slice(0, 8);
          const orderDate = new Date(order.created_at);
          const isExpanded = expandedOrder === order.id;

          return (
            <div
              key={order.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">#{orderId}</span>
                    {orderStatusBadge(order.status)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {format(orderDate, 'MMM d, yyyy')} • {format(orderDate, 'h:mm a')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-lg">
                    GHS {Math.abs(order.amount).toFixed(2)}
                  </div>
                  {isStoreOrder(order) && (
                    <div className="text-sm text-muted-foreground">
                      Profit: GHS {(order.amount * 0.1).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                  {isStoreOrder(order) ? order.customer_phone : (order as PersonalOrder).recipient_msisdn || 'N/A'}
                </div>
                {(order as any).network_id && (
                  <div className="mt-1 text-muted-foreground">
                    Network: {getNetworkName((order as any).network_id)}
                    {(order as any).data_amount && ` • ${(order as any).data_amount}`}
                  </div>
                )}
              </div>

              {isExpanded && isStoreOrder(order) && order.customer && (
                <div className="mt-3 pt-3 border-t bg-muted/50 rounded p-3">
                  <p className="text-sm font-medium mb-2">Customer Details</p>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Name: {order.customer.full_name || 'N/A'}</p>
                    <p>Email: {order.customer.email || 'N/A'}</p>
                    <p>Phone: {order.customer.phone_number || order.customer_phone}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
