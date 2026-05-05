# Order Status Display - Testing & Verification Guide

## Quick Start: Verify Order Status is Working

### 1. **Check API Connection First**
```bash
# Simple health check - should show all green ✅
curl http://localhost:3000/api/debug/order-tables-health | jq .health
```

Expected output:
```json
{
  "database": "✅ Connected",
  "provider_api": "✅ OK (450 orders)",
  "3tier_resolution": { ... }
}
```

### 2. **Verify Admin Orders Table**
1. Go to: `https://yourapp.com/myadminportal/orders`
2. Look at order status badges
3. Click the edit button (pencil icon) next to any order
4. Change status and save
5. Refresh page - status should persist (from `provider_order_overrides` table)

Expected behavior:
- Orders show with correct status badges
- Can edit and save status
- Status persists across refreshes

### 3. **Verify User Orders**
1. Go to: `https://yourapp.com/orders` (logged in as user)
2. Should see your purchase orders with status
3. Status should match what's in admin table for same order

```bash
# Debug user order status resolution
curl "http://localhost:3000/api/debug/status-resolution?user_id=YOUR_USER_ID" | jq .resolution
```

### 4. **Verify Store Orders**
1. Go to: `https://yourapp.com/store/your-store-slug/orders?phone=0551234567`
2. Should see store orders with proper status
3. If status is overridden in admin, should show override

```bash
# Debug store orders status
curl "http://localhost:3000/api/debug/store-orders-status?store_id=STORE_ID&limit=10" | jq .
```

### 5. **Verify Reseller Orders**
1. If logged in as reseller, go to: `/reseller/your-slug/orders`
2. Should see both personal and store orders
3. Personal orders via: `/api/reseller/orders?type=personal`
4. Store orders via: `/api/reseller/orders?type=store`

```bash
# Debug reseller personal orders
curl "http://localhost:3000/api/orders/me" | jq '.[0:3]'

# Debug reseller store orders
curl "http://localhost:3000/api/reseller/orders?type=store" | jq '.orders[0:3]'
```

## Deep Debugging: Understanding Status Resolution

### Trace Why an Order Has a Specific Status

```bash
# For an order with reference REF-123456
curl "http://localhost:3000/api/debug/status-resolution?reference=REF-123456" | jq '{
  query: .query,
  final: .resolution.final,
  hierarchy: .resolution.hierarchy
}'
```

Expected output shows:
```json
{
  "query": { "reference": "REF-123456" },
  "final": {
    "status": "delivered",
    "resolvedFrom": "admin_override"
  },
  "hierarchy": [
    { "tier": 1, "name": "admin_override", "available": true, "value": "delivered" },
    { "tier": 2, "name": "provider_api", "available": true, "value": "completed" },
    { "tier": 3, "name": "database", "available": true, "value": "processing" }
  ]
}
```

This shows:
- **Tier 1** (admin override): "delivered" ← **USED** 🎯
- **Tier 2** (provider API): "completed" ← NOT used (tier 1 wins)
- **Tier 3** (database): "processing" ← NOT used (tier 1 wins)

### Check Raw Provider API Response

```bash
# See what DataKazina is actually returning
curl http://localhost:3000/api/debug/orders-status | jq '.stages."2_sample_items"'
```

Look for:
- **dataType**: Should be "object" (array is wrapped)
- **isArray**: Should be true (array of orders)
- **samples**: First 3 items from API response

### Verify Network ID Mapping

```bash
# See how network IDs are converted
curl http://localhost:3000/api/debug/orders-status | jq '.stages."5_network_mapping"'
```

Look for mappings like:
```json
{
  "dakazina": "MTN",
  "displayId": 1
}
```

## Status Values Reference

### What Status Should I See?

| API Returns | Normalized To | Display Badge | Color |
|---|---|---|---|
| "PLACED", "PENDING" | "placed" | PLACED | Orange 🟠 |
| "PROCESSING", "IN_PROGRESS" | "processing" | PROCESSING | Blue 🔵 |
| "DELIVERED", "SUCCESS", "COMPLETED" | "delivered" | DELIVERED | Green 🟢 |
| "CANCELED", "FAILED", "CANCELLED" | "canceled" | CANCELED | Gray ⚪ |
| Anything else | "other" | (status as-is) | Default ⬜ |

## Database Queries for Manual Verification

### Check Admin Overrides
```sql
SELECT transaction_id, status, updated_at 
FROM provider_order_overrides 
ORDER BY updated_at DESC 
LIMIT 10;
```

### Check User Transactions with Status
```sql
SELECT id, user_id, status, reference, transaction_code, created_at 
FROM transactions 
WHERE transaction_type = 'purchase' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Store Orders with Status
```sql
SELECT id, store_id, status, payment_reference, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;
```

### Find Orders by Phone Number
```sql
-- User transactions
SELECT status, created_at FROM transactions 
WHERE recipient_msisdn = '0551234567' AND transaction_type = 'purchase'
LIMIT 5;

-- Store orders
SELECT status, created_at FROM orders 
WHERE phone_number = '0551234567'
LIMIT 5;
```

## Webhook Verification

### Verify Webhook is Being Received

Check server logs for:
```
Dakazina webhook received: {
  reference: "REF-123456",
  status: "DELIVERED",
  ...
}
Dakazina webhook processed successfully: {
  ok: true,
  reference: "REF-123456",
  status: "delivered",
  transactions_updated: 1,
  overrides_updated: 1,
  ...
}
```

### Manually Test Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/dakazina \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "id": 7988,
    "type": "test_event",
    "status": "DELIVERED",
    "reference": "REF-TEST-123",
    "amount": 10,
    "occurred_at": "2026-05-05T12:00:00+00:00",
    "test": true
  }'
```

Response should be:
```json
{
  "ok": true,
  "reference": "REF-TEST-123",
  "status": "delivered",
  "transactions_updated": 1,
  "overrides_updated": 1
}
```

## Troubleshooting

### Problem: Orders Show "other" Status
1. Check database: `SELECT DISTINCT status FROM transactions;`
2. Check API response: `/api/debug/orders-status`
3. Add status mapping to `src/lib/order-status.ts` if needed

### Problem: Status Not Updating After Webhook
1. Verify webhook endpoint is configured: Check `DAKAZINA_WEBHOOK_SECRET` env var
2. Check logs for webhook receipt
3. Verify order reference matches: `SELECT * FROM provider_order_overrides WHERE transaction_id = '...'`
4. Manual test webhook response

### Problem: Network ID Shows as null
1. Check database: `SELECT network_id, network_label FROM orders LIMIT 5;`
2. Verify mapping: `src/lib/network-id-map.ts`
3. Check debug endpoint: `/api/debug/orders-status` → `stages.5_network_mapping`

### Problem: Store Orders Not Showing Correct Status
1. Verify order exists: `SELECT * FROM orders WHERE id = '...'`
2. Check for override: `SELECT * FROM provider_order_overrides WHERE transaction_id = '...'`
3. Test endpoint: `/api/debug/store-orders-status?store_id=...`

## Performance Notes

- Admin all-orders page fetches from provider API each time (no cache)
- User orders page uses same API fetch (no cache)
- Store orders fetch includes override lookup
- All debug endpoints are real-time (no cache)

### Optimization Opportunities
- Cache provider API results for 30-60 seconds
- Cache override lookups for 1 minute
- Implement real-time updates via WebSocket (for live status)
- Batch override lookups (SELECT IN instead of 1-by-1)

## Success Criteria

✅ All orders display with valid status value  
✅ Admin overrides persist when set  
✅ Status matches across all views (admin/user/reseller/store)  
✅ Network IDs convert correctly  
✅ Debug endpoints show expected data structure  
✅ Webhook updates reflected in database  
✅ 3-tier resolution working (override > API > DB)  
✅ Status badges show correct colors  

## Next Steps

1. **Deploy to staging** and test with real data
2. **Run through full order lifecycle**: place → processing → delivered
3. **Test admin override** on a real order
4. **Verify webhook** integration with Dakazina
5. **Monitor logs** for any status-related errors
6. **Check performance** with large order datasets
7. **Test on mobile** to ensure badge rendering

