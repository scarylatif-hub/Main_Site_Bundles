# Admin Dashboard: Order Display Format Guide

## Overview
The admin dashboard (`/myadminportal/orders`) displays all orders from both:
- **Main website** - Direct purchases from customers
- **Store website** - Purchases from reseller stores

Both order types are displayed in a unified table with a clear source indicator.

## Column Structure

| Column | Description | Direct Orders | Store Orders |
|--------|-------------|---|---|
| **Order ID** | Unique identifier (first 24 chars) | Provider order ID from API | Order UUID from database |
| **Source** | Order source indicator | Badge: "Direct" (blue) | Badge: "Store" (orange) |
| **Customer** | Who purchased the data | Email address | Guest Name + Store Name (store) |
| **Date** | When order was placed | Date and time | Date and time |
| **Beneficiary** | Phone number receiving data | Phone number | Phone number |
| **Network** | Telecom provider | Network badge (MTN/Telecel/AT) | Network badge (MTN/Telecel/AT) |
| **Volume** | Data bundle size | Bundle size (1GB, 2GB, etc.) | Bundle size from package lookup |
| **Status** | Order status | Interactive dropdown | Interactive dropdown |
| **Price** | Amount paid | GHS amount in green | GHS amount in green |

## Order Display Examples

### Direct Order (Main Website)
```
┌────────────────┬────────┬──────────────────────────┬──────────┬──────────────┬─────────┬────────┬──────────────┬──────────┐
│ Order ID       │ Source │ Customer                 │ Date     │ Beneficiary  │ Network │ Volume │ Status       │ Price    │
├────────────────┼────────┼──────────────────────────┼──────────┼──────────────┼─────────┼────────┼──────────────┼──────────┤
│ #253a5166-299  │ Direct │ amoakoafrifa741@gmail.com│ May 1    │ 0595919802   │ —       │ —      │ FAILED 🔴    │ GHS10.50 │
│                │        │                          │ 1:17 PM  │              │         │        │              │          │
└────────────────┴────────┴──────────────────────────┴──────────┴──────────────┴─────────┴────────┴──────────────┴──────────┘
```

**Key points:**
- No store branding shown
- Uses customer's email address
- Network/Volume may be empty (marked with "—")
- Price shown in GHS

### Store Order
```
┌─────────────────┬────────┬──────────────────────────────────┬──────────┬──────────────┬─────────┬────────┬──────────────┬──────────┐
│ Order ID        │ Source │ Customer                         │ Date     │ Beneficiary  │ Network │ Volume │ Status       │ Price    │
├─────────────────┼────────┼──────────────────────────────────┼──────────┼──────────────┼─────────┼────────┼──────────────┼──────────┤
│ #82ad9a71-fd8   │ Store  │ Yes is him data                  │ May 5    │ 0595919802   │ MTN     │ 1GB    │ DELIVERED ✅  │ GHS25.00 │
│                 │        │ Yes is him data (store)          │ 9:44 PM  │              │         │        │              │          │
└─────────────────┴────────┴──────────────────────────────────┴──────────┴──────────────┴─────────┴────────┴──────────────┴──────────┘
```

**Key points:**
- Shows "Store" badge in orange
- Guest name on first line: "Yes is him data"
- Store name on second line: "Yes is him data (store)" with orange text
- Complete network and volume information
- Price shown in GHS

## Data Mapping

### Direct Orders (from DataKazina API)
```javascript
{
  id: "provider-order-id",           // Order ID
  reference: "REF-123456",            // Reference
  customerEmail: "email@example.com", // Email address
  customerName: "John Doe",           // Customer name (not displayed for direct)
  recipient_msisdn: "0551234567",     // Beneficiary
  network_id: 1,                      // Network (1=MTN, 2=Telecel, 3=AT)
  bundle_amount: "1GB",               // Volume
  status: "delivered",                // Status
  amount: 10.50,                      // Price in GHS
  isStore: false                      // Not a store order
}
```

### Store Orders (from database)
```javascript
{
  id: "order-uuid",                  // Order ID
  reference: "payment-reference",    // Payment reference
  customerEmail: "Guest Name",       // Guest's name (from form)
  customerName: "Store Name",        // Store name
  recipient_msisdn: "0551234567",    // Beneficiary
  network_id: 1,                     // Network (1=MTN, 2=Telecel, 3=AT)
  bundle_amount: "1GB",              // Volume (from package lookup)
  status: "completed",               // Status
  amount: 25.00,                     // Price in GHS
  isStore: true                      // Is a store order
}
```

## Filtering & Searching

### Filter by Source
- **All Sources** - Show both direct and store orders
- **Direct (Main Site)** - Only main website orders
- **Store Orders** - Only reseller store orders

### Filter by Status
- **placed** - Order received (orange badge)
- **processing** - Being processed (blue badge)
- **delivered** - Successfully completed (green badge)
- **canceled** - Canceled/failed (gray badge)

### Filter by Network
- **MTN** - MTN network
- **Telecel** - Telecel network
- **AirtelTigo** - AirtelTigo network
- Other networks as available

### Search
Searches across:
- Order ID
- Email/Guest name
- Phone number
- Store name
- Any other field

## Status Management

### Status Levels (3-tier resolution)
1. **Admin Override** - If admin manually sets status
2. **Provider API** - If DataKazina provides status
3. **Database** - Fallback to database value

### Updating Status
1. Click status badge or dropdown arrow
2. Select new status from menu
3. Status automatically saves
4. Updates both database and override table

## Complete Table Schema

```typescript
type AdminOrderRow = {
  // Identifiers
  id: string;                    // Unique order ID
  reference: string | null;      // Provider/transaction reference
  provider_order_id: string | null; // Provider's order ID
  transaction_code: string | null;  // Transaction code

  // Customer Information
  user_id: string;              // User/Store ID
  recipient_msisdn: string | null; // Beneficiary phone
  customerEmail: string;         // Email (direct) or Guest name (store)
  customerName: string;          // Customer name (direct) or Store name (store)

  // Network Information
  network_id: number | null;     // Display network ID (1-3)
  network_label: string | null;  // Network name

  // Data Information
  bundle_amount: string | null;  // Volume (1GB, 2GB, etc.)

  // Transaction Information
  created_at: string;            // Order date/time
  status: string;                // Current status
  amount: number;                // Price in GHS

  // Type Indicator
  isStore: boolean;              // true if store order, false if direct
};
```

## Implementation Notes

### For Direct Orders
- Data comes from `fetchExternalAllOrdersRaw()` via DataKazina API
- Normalized using `normalizeExternalOrder()` function
- Enriched with user profile data (email, name)
- May have limited network/volume info if API doesn't provide

### For Store Orders
- Data fetched from `orders` table in database
- Stored with guest name in `customer_email` field
- Store name resolved from `profiles.store_name`
- Bundle amount fetched from package data
- Network ID already in display format

### Status Display Logic
```typescript
// Determine what to show in Customer column
if (row.isStore) {
  // Show: Guest Name
  //       Store Name (store)
  display = `${row.customerEmail}\n${row.customerName} (store)`;
} else {
  // Show: email@address.com
  display = row.customerEmail;
}
```

## Performance Optimization

The admin page:
- Fetches external API orders on each page load (no cache)
- Fetches store orders from database on each page load
- Fetches package data to get volume information
- Total queries: ~4-5 per page load

### Recommended Improvements
- Cache DataKazina results for 30-60 seconds
- Cache package list for 1+ hours
- Implement virtual scrolling for large datasets (1000+ rows)
- Add export to CSV functionality

## Troubleshooting

### "Order ID shows as —"
- Check if provider_order_id, reference, or transaction_code are available
- See debug endpoint: `/api/debug/orders-status`

### "Customer column blank"
- For direct: Check if email is in profiles
- For store: Check if guest name (customer_email field) is populated
- See debug endpoint: `/api/debug/store-orders-status`

### "Volume shows as —"
- For direct: Provider API didn't return volume
- For store: Package not found in database
- See debug endpoint: `/api/debug/orders-status` for API mapping

### "Status not updating"
- Verify user has admin access
- Check if override was saved to `provider_order_overrides` table
- See debug endpoint: `/api/debug/status-resolution`

## Related Files

- Table component: [src/app/myadminportal/orders/admin-orders-table.tsx](src/app/myadminportal/orders/admin-orders-table.tsx)
- Page component: [src/app/myadminportal/orders/page.tsx](src/app/myadminportal/orders/page.tsx)
- Data functions: [src/lib/external-all-orders.ts](src/lib/external-all-orders.ts)
- Status logic: [src/lib/order-status.ts](src/lib/order-status.ts)

