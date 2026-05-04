# 🚀 Webhook Deployment Checklist

## ✅ Pre-Deployment Setup - COMPLETED
- [x] Webhook endpoint created: `/api/webhooks/dakazina`
- [x] Test script updated with your secret key
- [x] Documentation updated with specific secret key
- [x] Secret key: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

## 📋 Environment Variables Setup

### Main Site (sbbundles-main.vercel.app)
```
DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Store Site (bundles-store.vercel.app)
```
DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

## 🎯 Dakazina Webhook Configuration

**Webhook URL:** `https://sbbundles-main.vercel.app/api/webhooks/dakazina`

**Secret/Key:** `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

**Header:** `x-webhook-secret`

**Trigger Statuses:**
- ✅ PROCESSING
- ✅ DELIVERED

## 🧪 Testing Commands

### After Deployment
```bash
# Test webhook endpoint
node test-webhook.js

# Manual curl test
curl -X POST https://sbbundles-main.vercel.app/api/webhooks/dakazina \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456" \
  -d '{"id": 7988, "status": "DELIVERED", "reference": "REF-TEST-123", "test": true}'
```

## 📊 Verification Steps

### 1. Check Webhook Endpoint
Visit: `https://sbbundles-main.vercel.app/api/webhooks/dakazina`
- Should return 404 (GET not supported)
- POST requests should work with proper secret

### 2. Test Order Status Updates
1. Go to: `https://sbbundles-main.vercel.app/myadminportal/orders`
2. Verify orders are displayed
3. Test webhook should update order status
4. Check if status changes appear in admin table

### 3. Verify Store Integration
1. Go to: `https://bundles-store.vercel.app/`
2. Make a test order (if possible)
3. Check if it appears in main admin panel

## 🔍 Troubleshooting

### If Webhook Fails
1. Check Vercel function logs
2. Verify environment variables are set
3. Ensure secret matches exactly
4. Check webhook URL is correct

### If Orders Don't Update
1. Check `transactions` table for matching references
2. Verify `provider_order_overrides` table updates
3. Check admin orders table for webhook overrides

## 📝 Deployment Steps

1. **Add Environment Variables** to both Vercel projects
2. **Deploy Code** (if not already deployed)
3. **Configure Dakazina** webhook settings
4. **Test Webhook** with provided script
5. **Verify Order Table** updates work
6. **Monitor Logs** for any issues

## 🎉 Success Indicators

- ✅ Webhook endpoint responds 200 OK
- ✅ Test script shows successful updates
- ✅ Order statuses change in admin table
- ✅ No errors in Vercel function logs
- ✅ Dakazina shows successful webhook delivery

---

**Ready to deploy! 🚀**
