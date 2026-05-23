# Dakazina Webhook Debugging - Status Report

## Summary of Audit Results

After auditing all files in the Dakazina webhook implementation, **NO BUGS WERE FOUND**. The code is already correctly implemented according to the requirements.

## Files Audited

### 1. src/lib/dakazina-order-code.ts ✅ CORRECT
- **Status**: No changes needed
- **Findings**:
  - `extractDakazinaOrderCode()` already checks for "transaction_code" key first (line 10)
  - Already checks for "transactionCode" camelCase variant (line 11)
  - Already accepts "926XXXXX" format via regex `/^926[A-Z0-9-]+$/i` (line 22)
  - Function will correctly extract "926TEST-0020595919802" from Dakazina response
  - Does NOT require "ORDER-XXXXX" format to consider a value valid

### 2. src/app/api/buy-bundle/route.ts ✅ CORRECT
- **Status**: No changes needed
- **Findings**:
  - Line 210: Calls `datakazinaAPI.purchaseDataPackage(purchaseParams, true)`
  - Line 246-249: Extracts provider code using `extractDakazinaOrderCode()`
  - Line 251-258: Saves transaction_code to ALL THREE database fields:
    - `transactions.reference = providerCode`
    - `transactions.transaction_code = providerCode`
    - `transactions.dakazina_order_id = providerCode`

### 3. src/app/api/guest/orders/route.ts ✅ CORRECT
- **Status**: No changes needed
- **Findings**:
  - Line 191: Calls `datakazinaAPI.purchaseDataPackage(purchaseParams)`
  - Line 230-235: Extracts provider code from response
  - Line 238-241: Saves transaction_code to `orders.dakazina_order_id`

### 4. src/app/api/webhooks/dakazina/route.ts ✅ CORRECT (with logging enhancements)
- **Status**: Enhanced with additional Vercel logging
- **Findings**:
  - 4a. Function `collectWebhookReferences()` exists with correct name (line 48)
  - 4b. Signature check reads from `process.env.DAKAZINA_WEBHOOK_SECRET` (line 81) - NOT the _DISABLED version
  - 4c. Transactions lookup searches in correct order:
    1. dakazina_order_id = incoming transaction_code (line 154)
    2. Fallback: reference = incoming transaction_code (line 161)
    3. Fallback: transaction_code = incoming transaction_code (line 161)
  - 4d. Orders lookup searches in correct order:
    1. dakazina_order_id = incoming transaction_code (line 209)
    2. Fallback: paystack_transaction_id = incoming transaction_code (line 216)
    3. Fallback: payment_reference = incoming transaction_code (line 216)
  - 4e. Status values correctly mapped via `normalizeStatusForEarnings()`:
    - "PROCESSING" → "processing"
    - "DELIVERED" → "delivered"
  - 4f. Webhook returns HTTP 200 on all errors except 401 Unauthorized (lines 75, 90, 97, 107, 115, 174, 191, 228, 245)

**Changes Made**: Added enhanced Vercel logging statements for debugging:
- Line 178: Log transaction patch being applied
- Line 181: Log transaction IDs to update
- Line 196: Log number of transactions updated
- Line 235: Log order patch being applied
- Line 238: Log order IDs to update
- Line 253: Log number of orders updated
- Line 268: Enhanced success log with "SUCCESS" prefix
- Line 269: Final status summary log

### 5. src/lib/reseller-earnings.ts ✅ CORRECT
- **Status**: No changes needed
- **Findings**:
  - `normalizeStatusForEarnings()` correctly maps:
    - "PROCESSING" → "processing" (line 8-9)
    - "DELIVERED" → "delivered" (line 4-5)
    - Also handles lowercase variants
  - Returns valid status strings, not null/undefined

## Files Changed

Only 1 file was modified:

### src/app/api/webhooks/dakazina/route.ts
- **Purpose**: Added enhanced Vercel logging for debugging webhook processing
- **Changes**: Added 7 new console.log statements to track:
  - Transaction patch being applied
  - Transaction IDs to update
  - Number of transactions updated
  - Order patch being applied
  - Order IDs to update
  - Number of orders updated
  - Final success status with counts

## Postman Test Instructions

### Test 1: Webhook Endpoint Health Check
**Method**: GET
**URL**: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
**Expected Response**:
```json
{
  "message": "Webhook endpoint is active"
}
```
**Status Code**: 200

### Test 2: Simulate Dakazina Webhook (DELIVERED status)
**Method**: POST
**URL**: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
**Headers**:
```
Content-Type: application/json
dakazina-signature: sha256=<YOUR_SIGNATURE>
dakazina-timestamp: <UNIX_TIMESTAMP>
```
**Body**:
```json
{
  "id": 7988,
  "type": "order_status_update",
  "status": "DELIVERED",
  "previous_status": "PROCESSING",
  "order_code": "926TEST-0020595919802",
  "reference": "926TEST-0020595919802",
  "transaction_code": "926TEST-0020595919802",
  "amount": 10,
  "user_id": 4,
  "occurred_at": "2026-05-23T10:00:00+00:00",
  "test": false,
  "metadata": {}
}
```
**Expected Response**:
```json
{
  "ok": true,
  "dakazina_order_code": "926TEST-0020595919802",
  "references": ["926TEST-0020595919802"],
  "status": "delivered",
  "previous_status": "processing",
  "transactions_updated": 1,
  "orders_updated": 0,
  "webhook_id": 7988,
  "test": false
}
```
**Status Code**: 200

### Test 3: Simulate Dakazina Webhook (PROCESSING status)
**Method**: POST
**URL**: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
**Headers**: Same as Test 2
**Body**:
```json
{
  "id": 7989,
  "type": "order_status_update",
  "status": "PROCESSING",
  "previous_status": "PENDING",
  "order_code": "926TEST-0020595919803",
  "reference": "926TEST-0020595919803",
  "transaction_code": "926TEST-0020595919803",
  "amount": 5,
  "user_id": 4,
  "occurred_at": "2026-05-23T10:05:00+00:00",
  "test": false,
  "metadata": {}
}
```
**Expected Response**:
```json
{
  "ok": true,
  "dakazina_order_code": "926TEST-0020595919803",
  "references": ["926TEST-0020595919803"],
  "status": "processing",
  "previous_status": "pending",
  "transactions_updated": 1,
  "orders_updated": 0,
  "webhook_id": 7989,
  "test": false
}
```
**Status Code**: 200

### Test 4: Test Event (should be skipped)
**Method**: POST
**URL**: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
**Headers**: Same as Test 2
**Body**:
```json
{
  "id": 7990,
  "type": "test_event",
  "status": "DELIVERED",
  "test": true
}
```
**Expected Response**:
```json
{
  "ok": true,
  "skipped": "test_event"
}
```
**Status Code**: 200

### Test 5: Invalid Signature (should return 401)
**Method**: POST
**URL**: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
**Headers**:
```
Content-Type: application/json
dakazina-signature: sha256=invalid_signature
dakazina-timestamp: <UNIX_TIMESTAMP>
```
**Body**: Same as Test 2
**Expected Response**:
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```
**Status Code**: 401

## Vercel Log Monitoring

After deploying these changes, monitor Vercel logs for the webhook endpoint. You should see:

1. **📦 Dakazina webhook: Received request** - When webhook is called
2. **📋 Dakazina webhook: Full payload:** - Raw JSON payload
3. **📊 Dakazina webhook received:** - Summary of extracted data
4. **✅ Dakazina webhook: Found X transactions** - Number of matching transactions
5. **📝 Dakazina webhook: Transaction patch being applied:** - Patch object
6. **🆔 Dakazina webhook: Transaction IDs to update:** - List of IDs
7. **✅ Dakazina webhook: Updated X transactions** - Update count
8. **✅ Dakazina webhook: Found X orders** - Number of matching orders
9. **📝 Dakazina webhook: Order patch being applied:** - Patch object
10. **🆔 Dakazina webhook: Order IDs to update:** - List of IDs
11. **✅ Dakazina webhook: Updated X orders** - Update count
12. **✅ SUCCESS - Dakazina webhook processed successfully:** - Final response
13. **📊 FINAL STATUS: X transactions updated, X orders updated** - Summary

## Conclusion

The webhook implementation is already correct. The only change made was adding enhanced logging to help debug any issues in Vercel. If webhooks are still not matching orders, the issue is likely:
1. The transaction_code from Dakazina is not being saved correctly during purchase (check Vercel logs during purchase)
2. The database is not being updated correctly (check Supabase directly)
3. The webhook payload from Dakazina has a different structure than expected (check Vercel logs during webhook)
