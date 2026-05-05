# Order Status Display Implementation Guide

## Overview
All order tables across the application should display order status using a consistent 3-tier resolution system that combines admin overrides, live provider API data, and database fallback values.

## Status Resolution Hierarchy

### Tier 1: Admin Override (Highest Priority)
- **Source**: `provider_order_overrides` table
- **Lookup Key**: transaction reference, transaction_code, provider_order_id, or order id
- **When Used**: Admin has manually set a status override for this order
- **Example**: Admin marks order as "delivered" if DataKazina API is delayed

### Tier 2: Live Provider API Status (Medium Priority)
- **Source**: `datakazinaAPI.fetchTransactions()` → normalized to AdminOrderRow format
- **Process**: Fetches all transactions from provider, extracts status field
- **When Used**: Order found in provider API with valid status
- **Example**: Provider shows "DELIVERED" status for completed order

### Tier 3: Database Fallback (Lowest Priority)
- **Source**: `transactions.status` or `orders.status` column
- **When Used**: Order not found in override or API, use what's in DB
- **Example**: Order created but not yet confirmed by provider

## Status Normalization

All status values are normalized using `normalizeOrderStatus()` which converts to lowercase and trims whitespace.

### Supported Status Values
- **placed**: Order received, waiting to be processed (orange badge)
- **processing**: Currently being delivered (blue badge)
- **delivered**: Successfully completed (green badge)
- **canceled**: Cancelled or failed (gray badge)
- **other**: Unknown/unmapped status (default badge)

### Common Mappings
- API returns: "SUCCESS", "COMPLETED" → normalized to: "delivered"
- API returns: "PENDING", "IN_PROGRESS" → normalized to: "processing"
- API returns: "FAILED", "CANCELLED" → normalized to: "canceled"

## Implementation in Each Order Table

### 1. Admin All Orders Table (`/myadminportal/orders`)
**File**: `src/app/myadminportal/orders/admin-orders-table.tsx`
**Status Display**: Uses AdminOrdersTable component
**Key Features**:
- Shows merged orders from both main site (via API) and stores (from DB)
- Admin can edit status inline using dropdown
- Updates are saved to `provider_order_overrides` table
- All three tiers applied before display

**Implementation**:
```typescript
// In admin-orders-table.tsx
const displayStatus = overrides[overrideKey] ?? row.status;
// This automatically uses Tier 1 (override) if available, else Tier 2/3 (from row)
```

### 2. User Orders Table (`/orders`)
**File**: `src/app/orders/page.tsx` + `src/components/orders-table.tsx`
**Status Display**: Uses OrdersTable component with orderStatusBadge()
**Data Source**: `/api/orders/me` endpoint

**Implementation**:
- Fetches transactions via `fetchMyPurchaseTransactionsForUser()`
- Three-tier resolution happens in that function
- Uses `classifyOrderStatusForDisplay()` for badge styling

### 3. Reseller Store Orders (`/reseller/[slug]/orders`)
**File**: `src/app/api/reseller/orders/route.ts`
**Status Display**: Returns orders with current `status` field
**Key Issue**: May not be applying 3-tier resolution

**Fix Required**:
- Apply same 3-tier resolution as user orders
- Check for admin overrides using payment_reference/transaction_code
- Fetch latest from provider API if available

### 4. Store Orders Management (`/store/[slug]/orders`)
**File**: `src/app/api/store/[slug]/orders/route.ts`
**Status Display**: Direct from orders table
**Key Issue**: Only returns database status, no override/API check

**Fix Required**:
- Apply tier 1 check: look for override using order.paystack_transaction_id or order.id
- Add tier 2: try to find in external API using phone/amount/time matching
- Return final_status field for display

## Testing & Debugging

### Debug Endpoints Available

#### 1. Orders Status Debug (`/api/debug/orders-status`)
Shows raw API response, parsing, and sample normalized orders.
```bash
curl "http://localhost:3000/api/debug/orders-status"
```

#### 2. Status Resolution Debug (`/api/debug/status-resolution`)
Shows complete 3-tier resolution for a specific order.
```bash
curl "http://localhost:3000/api/debug/status-resolution?reference=REF-123&user_id=user-456"
```

#### 3. Store Orders Status Debug (`/api/debug/store-orders-status`)
Shows store order statuses and their resolution.
```bash
curl "http://localhost:3000/api/debug/store-orders-status?store_id=store-123&limit=10"
```

## Common Issues & Solutions

### Issue: Status Not Updating
**Cause**: Order status only updates when:
1. Admin manually sets override (tier 1), or
2. DataKazina webhook is received (updates both transaction and override), or
3. Page is refreshed (re-fetches from API)

**Solution**:
- Check if override exists: `SELECT * FROM provider_order_overrides WHERE transaction_id = '...'`
- Check if order exists in latest API response: Use `/api/debug/orders-status`
- Verify webhook is being received: Check logs for "Dakazina webhook processed"

### Issue: Wrong Network ID
**Cause**: Network ID needs to be converted from DataKazina format to display format

**Location**: `src/lib/network-id-map.ts`
- `datakazinaNetworkIdToDisplay()`: Converts API ID (often 1-4) to display ID (1-3)
- `displayNetworkIdToDatakazina()`: Converts back for API calls

### Issue: Status Shows "Other"
**Cause**: Status value not in known list, check `order-status.ts` for mapping

**Solution**: Add to `classifyOrderStatusForDisplay()` or use `normalizeOrderStatus()` to see what it becomes

## Best Practices

1. **Always use the 3-tier resolution** - Never display DB status directly if override/API is available
2. **Use consistent normalization** - Always call `normalizeOrderStatus()` before display
3. **Show appropriate badges** - Use `classifyOrderStatusForDisplay()` to get bucket, then `orderStatusBadge()` for styling
4. **Log status changes** - Add console.log when applying overrides or API data for debugging
5. **Test with debug endpoints** - Use debug endpoints to verify resolution is working
6. **Sync all tables** - Ensure all order tables use same resolution logic

## References

**Key Files**:
- Status normalization: `src/lib/order-status.ts`
- 3-tier resolution: `src/lib/data/user-transactions.ts`
- API parsing: `src/lib/external-all-orders.ts`
- Badge display: `src/components/orders-table.tsx`, `src/app/myadminportal/orders/admin-orders-table.tsx`
- Network mapping: `src/lib/network-id-map.ts`

**Database Tables**:
- `transactions` - User purchases with status
- `orders` - Store order purchases
- `provider_order_overrides` - Admin status overrides
- `provider_order_overrides.updated_at` - When override was set
