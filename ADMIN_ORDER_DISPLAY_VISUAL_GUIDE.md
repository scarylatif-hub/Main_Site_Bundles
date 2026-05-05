# Admin Dashboard Order Display - Visual Reference

## Live Examples

### Example 1: Direct Order from Main Website
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD - ALL ORDERS                                                  │
├──────────────────┬────────────┬──────────────────────────┬────────────┬──────────────┬────────┬──────────┤
│ Order ID         │ Source     │ Customer                 │ Date       │ Beneficiary  │Network │Volume    │
├──────────────────┼────────────┼──────────────────────────┼────────────┼──────────────┼────────┼──────────┤
│ #253a5166-299    │ Direct 🔵   │ amoakoafrifa741@gmail    │ May 1      │ 0595919802   │ —      │ —        │
│                  │            │                          │ 1:17 PM    │              │        │          │
├──────────────────┼────────────┼──────────────────────────┼────────────┼──────────────┼────────┼──────────┤
│                  │ Status     │ Price                    │                                              │
│                  │ FAILED ❌   │ GHS 10.50                │                                              │
└──────────────────┴────────────┴──────────────────────────┴────────────┴──────────────┴────────┴──────────┘
```

**Breakdown:**
- **Order ID**: #253a5166-299 (first 24 characters of UUID)
- **Source**: Direct (blue badge) - indicates main website
- **Customer**: amoakoafrifa741@gmail.com (email address, no secondary info)
- **Date**: May 1, 1:17 PM (formatted date and time)
- **Beneficiary**: 0595919802 (phone number receiving data)
- **Network**: — (not available from API)
- **Volume**: — (not available from API)
- **Status**: FAILED (interactive, can be changed)
- **Price**: GHS 10.50 (in green text)

---

### Example 2: Store Order from Reseller Store
```
┌──────────────────┬──────────┬──────────────────────────────┬──────────────┬──────────────┬────────┬──────────┐
│ Order ID         │ Source   │ Customer                     │ Date         │ Beneficiary  │Network │Volume    │
├──────────────────┼──────────┼──────────────────────────────┼──────────────┼──────────────┼────────┼──────────┤
│ #82ad9a71-fd8    │ Store 🟠  │ Yes is him data              │ May 5        │ 0595919802   │ MTN    │ 1GB      │
│                  │          │ Yes is him data (store) 🟠   │ 9:44 PM      │              │        │          │
├──────────────────┼──────────┼──────────────────────────────┼──────────────┼──────────────┼────────┼──────────┤
│                  │ Status   │ Price                        │                                              │
│                  │ DELIVERED │ GHS 25.00                   │                                              │
└──────────────────┴──────────┴──────────────────────────────┴──────────────┴──────────────┴────────┴──────────┘
```

**Breakdown:**
- **Order ID**: #82ad9a71-fd8 (first 24 characters of UUID)
- **Source**: Store (orange badge) - indicates store website
- **Customer**: 
  - Line 1: "Yes is him data" (guest's name from name input field)
  - Line 2: "Yes is him data (store)" (store name in orange text)
- **Date**: May 5, 9:44 PM (formatted date and time)
- **Beneficiary**: 0595919802 (phone number receiving data)
- **Network**: MTN (network badge from package info)
- **Volume**: 1GB (data size from package info)
- **Status**: DELIVERED (interactive, can be changed)
- **Price**: GHS 25.00 (in green text)

---

## Key Differences

| Aspect | Direct Order | Store Order |
|--------|---|---|
| **Source Badge** | "Direct" (blue 🔵) | "Store" (orange 🟠) |
| **Customer Line 1** | Email address | Guest's name |
| **Customer Line 2** | None | Store name (orange) + "(store)" tag |
| **Data Source** | DataKazina API | Database + Package lookup |
| **Network** | Often empty "—" | From package data |
| **Volume** | Often empty "—" | From package data |

---

## How Customer Column Works

### For Direct Orders
**Just the email:**
```
amoakoafrifa741@gmail.com
```

### For Store Orders
**Guest name + Store name:**
```
Yes is him data
Yes is him data (store)
```

The store name line appears in:
- **Text color**: Dark orange/amber
- **Label**: "(store)" in orange

---

## Status Badges Reference

### Status Colors & Icons
```
PLACED      🟠 Orange badge  - Order received, waiting to be processed
PROCESSING  🔵 Blue badge    - Currently being delivered  
DELIVERED   ✅ Green badge   - Successfully completed
CANCELED    ⚪ Gray badge    - Cancelled or failed
FAILED      ❌ Red badge     - Failed to deliver
```

---

## Filtering Examples

### Filter: Show Only Store Orders
```
Showing: 23 Store Orders
Filtering: Source = Store

Results show only orders where:
- Source = "Store" (orange badge)
- Customer format: "Guest Name\nStore Name (store)"
```

### Filter: Show Only MTN Network
```
Showing: 45 MTN Orders (Direct & Store)
Filtering: Network = MTN

Results show orders for MTN only:
- Direct orders: Network badge shows "MTN"
- Store orders: Network badge shows "MTN"
```

### Filter: Show Failed Orders
```
Showing: 5 Failed Orders
Filtering: Status = failed

Results show:
- Status badge displays "CANCELED" (gray)
- Both direct and store orders included
```

---

## Table Columns Explained

### Order ID
- **For Direct**: Provider's order ID (from DataKazina API)
- **For Store**: Order UUID from database
- **Display**: First 24 characters preceded by "#"
- **Purpose**: Unique identifier for the order

### Source
- **For Direct**: Badge "Direct" in blue 🔵
- **For Store**: Badge "Store" in orange 🟠
- **Purpose**: Quick visual identification of order type

### Customer
- **For Direct**: Customer's email address
- **For Store**: Guest name (line 1) + Store name (line 2) in orange
- **Purpose**: Who made the purchase and from where

### Date
- **Format**: "MMM d" on first line (e.g., "May 1")
- **Format**: "h:mm a" on second line (e.g., "1:17 PM")
- **Source**: Order creation timestamp
- **Purpose**: When the order was placed

### Beneficiary
- **Format**: Phone number in monospace font
- **Example**: "0595919802"
- **Source**: customer_phone or phone_number from database
- **Purpose**: Who receives the data bundle

### Network
- **Display**: Network name badge (MTN, Telecel, AirtelTigo)
- **For Direct**: May show "—" if not available
- **For Store**: Shows network from package data
- **Color**: Orange background with darker text
- **Purpose**: Which telecom network

### Volume
- **Format**: Data size (1GB, 2GB, 5GB, 10GB, etc.)
- **For Direct**: May show "—" if not available
- **For Store**: From package lookup in database
- **Purpose**: How much data purchased

### Status
- **Interactive**: Click to change status
- **Display**: Color-coded badge with icon
- **Options**: placed, processing, delivered, canceled
- **Saves to**: provider_order_overrides table
- **Purpose**: Current order status with quick edit

### Price
- **Format**: "GHS" prefix + amount with 2 decimals
- **Color**: Green text for visibility
- **Font**: Monospace for alignment
- **Example**: "GHS 25.00"
- **Purpose**: Amount paid for the order

---

## Keyboard & Mouse Interactions

### Clicking on Rows
- Rows highlight on hover
- Background changes to lighter shade

### Clicking Status Badge/Dropdown
- Opens status menu
- Shows all available statuses
- Click to select new status
- Auto-saves to database

### Filtering
- Click "Filter" button
- Select filter options
- Results update in real-time
- Multiple filters can be combined

### Searching
- Type in search box
- Searches: Order ID, Email, Phone, Names
- Results update as you type
- Clear button removes search

---

## Mobile Responsive

### Desktop (Full Width)
- All columns visible
- Horizontal scroll for overflow

### Tablet (Medium Width)
- May require horizontal scroll
- Customer column shows both lines
- Status badge visible

### Mobile (Small Width)
- All columns visible with smaller font
- May require horizontal scroll
- Columns stay responsive

---

## Common Scenarios

### Scenario 1: Update Failed Order Status
1. Find order with "FAILED" badge (gray ❌)
2. Click on status badge
3. Select "delivered" from menu
4. Badge changes to "DELIVERED" (green ✅)
5. Persists even after page refresh

### Scenario 2: Find All Store Orders for MTN
1. Click "Filter" button
2. Select "Store Orders" under "Filter by Source"
3. Select "MTN" under "Filter by Network"
4. Table updates to show matching orders
5. Shows count: "X of Y orders"

### Scenario 3: Search for Specific Customer
1. Type email or phone in search box
2. Table filters to matching orders
3. Works for: emails, phone numbers, names, store names
4. Case-insensitive search

---

## Data Sync Notes

- ✅ Direct orders update in real-time via webhook
- ✅ Store orders update from database on page refresh
- ✅ Status changes save immediately to database
- ✅ Admin overrides persist in provider_order_overrides table
- ✅ Package volumes sync with DataKazina on page load

