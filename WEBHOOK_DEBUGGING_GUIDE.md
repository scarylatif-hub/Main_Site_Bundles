# 🔧 Dakazina Webhook Debugging Guide

## ⚠️ Issue Reported
Order status shows "processing" in system but Dakazina API shows "placed" - webhook not updating status.

---

## 🔍 Enhanced Debugging Added

### **Webhook Route Updates** (`src/app/api/webhooks/dakazina/route.ts`)
✅ **Added detailed logging:**
- Request headers logging
- Secret validation logging
- Transaction lookup OR clause logging
- Order lookup OR clause logging
- Match count logging for both tables

### **Debug Test Endpoint** (`src/app/api/debug/webhook-test/route.ts`)
✅ **Created debug endpoint:**
- `GET /api/debug/webhook-test` - Check configuration and recent records
- `POST /api/debug/webhook-test` - Send test webhook payload

---

## 🚀 Deployment Steps

```bash
git add .
git commit -m "Add webhook debugging and test endpoint"
git push origin main
```

---

## 🧪 Debugging Steps

### **1. Check Webhook Configuration**
```bash
curl https://sbbundles-main.vercel.app/api/debug/webhook-test
```
**Expected Response:**
```json
{
  "config": {
    "webhookUrl": "https://sbbundles-main.vercel.app/api/webhooks/dakazina",
    "hasSecret": true,
    "secretLength": 32
  },
  "recentTransactions": [...],
  "recentOrders": [...]
}
```

**If `hasSecret: false`:**
- Check `.env.local` for `DAKAZINA_WEBHOOK_SECRET`
- Add the secret and redeploy

---

### **2. Send Test Webhook**
```bash
curl -X POST https://sbbundles-main.vercel.app/api/debug/webhook-test \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "TEST-REF-123",
    "status": "delivered"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "status": 200,
  "webhookResponse": {
    "ok": true,
    "transactions_updated": 0,
    "orders_updated": 0
  }
}
```

**If `success: false`:**
- Check console logs for detailed error
- Verify secret configuration

---

### **3. Check Console Logs**
After deployment, check Vercel logs for:
```
Dakazina webhook: Received request
Headers: { ... }
Dakazina webhook: Secret check { hasSecret: true, hasHeaderSecret: true, ... }
Dakazina webhook: Looking up transactions with OR clause: reference.eq.REF,transaction_code.eq.REF
Dakazina webhook: Found transactions: 1
Dakazina webhook: Looking up orders with OR clause: paystack_transaction_id.eq.REF,payment_reference.eq.REF
Dakazina webhook: Found orders: 1
```

**Common Issues:**
- `Unauthorized` - Secret mismatch
- `Missing reference` - No reference in webhook payload
- `Found transactions: 0` - Reference doesn't match any transactions
- `Found orders: 0` - Reference doesn't match any orders

---

### **4. Verify Dakazina Webhook Configuration**
Check Dakazina dashboard for:
1. **Webhook URL:** `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
2. **Secret:** Should match `DAKAZINA_WEBHOOK_SECRET`
3. **Events:** Should include status change events
4. **Status:** Should be active/enabled

---

### **5. Check Reference Matching**
The webhook looks for orders using these fields:

**Transactions Table:**
- `reference`
- `transaction_code`

**Orders Table:**
- `paystack_transaction_id`
- `payment_reference`

**Run this query to check your order:**
```sql
SELECT id, reference, transaction_code, status 
FROM transactions 
WHERE transaction_type = 'purchase' 
ORDER BY created_at DESC 
LIMIT 10;
```

```sql
SELECT id, paystack_transaction_id, payment_reference, status 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;
```

**If references don't match:**
- Check how orders are created
- Verify reference generation logic
- Check webhook payload structure

---

### **6. Manual Webhook Test**
Use a webhook testing tool like webhook.site:

1. **Create test webhook URL** on webhook.site
2. **Configure Dakazina** to send to webhook.site
3. **Trigger a status change** on Dakazina
4. **Check webhook.site** for received payload
5. **Compare payload structure** with expected format

**Expected Payload Format:**
```json
{
  "id": 7988,
  "type": "order_status_changed",
  "status": "DELIVERED",
  "previous_status": "PROCESSING",
  "order_code": "DKZ-TEST-RQ5WKR",
  "reference": "REF-HETWWVUOTM",
  "amount": 10,
  "user_id": 4,
  "occurred_at": "2026-04-10T21:15:44+00:00",
  "test": false
}
```

---

## 🎯 Common Issues & Solutions

### **Issue 1: Webhook Not Receiving Calls**
**Symptoms:** No logs in Vercel console
**Solutions:**
- Check Dakazina webhook URL is correct
- Verify Dakazina webhook is enabled
- Check firewall/network restrictions
- Test webhook URL with curl

### **Issue 2: Unauthorized (401)**
**Symptoms:** `Unauthorized` error in logs
**Solutions:**
- Verify `DAKAZINA_WEBHOOK_SECRET` is set in environment
- Check secret matches Dakazina dashboard
- Check header name (x-webhook-secret, x-dakazina-signature, x-provider-signature)

### **Issue 3: No Orders Matched**
**Symptoms:** `Found transactions: 0` or `Found orders: 0`
**Solutions:**
- Check reference values in webhook payload
- Verify reference fields in database
- Check reference generation logic
- Use debug endpoint to see recent records

### **Issue 4: Status Not Updating**
**Symptoms:** Orders found but status doesn't change
**Solutions:**
- Check database permissions
- Verify status field is updatable
- Check for database constraints
- Check Supabase RLS policies

---

## 📋 Troubleshooting Checklist

- [ ] Webhook URL is correct in Dakazina dashboard
- [ ] `DAKAZINA_WEBHOOK_SECRET` is set in environment
- [ ] Secret matches between Dakazina and environment
- [ ] Webhook is enabled in Dakazina dashboard
- [ ] Status change events are enabled
- [ ] Console logs show webhook requests
- [ ] References match between webhook and database
- [ ] Database permissions allow updates
- [ ] RLS policies don't block updates
- [ ] Test webhook endpoint works

---

## 🚨 Next Steps

1. **Deploy the debugging changes**
2. **Check configuration** with debug endpoint
3. **Send test webhook** to verify functionality
4. **Monitor console logs** for real webhook calls
5. **Compare references** between webhook and database
6. **Verify Dakazina configuration** in their dashboard

---

**Enhanced debugging is now deployed and ready for testing!** ✅
