# Dakazina Webhook Integration Setup

## Overview
The Bundle Ghana application now supports real-time order status updates from Dakazina via webhooks. When Dakazina processes orders and updates their status, webhook notifications are sent to your application to automatically update the order table.

## Webhook Configuration

### Dakazina Provider Settings
Update your Dakazina webhook configuration with the following:

**Primary Webhook URL:** `https://sbbundles-main.vercel.app/api/webhooks/dakazina`

**Alternative URL (if needed):** `https://bundles-store.vercel.app/api/webhooks/dakazina`

> **Note:** Use the main site URL (`sbbundles-main.vercel.app`) for webhooks as it has admin access for debugging. Both URLs work since they share the same codebase.

**Trigger Webhook on Statuses:**
- ✅ PROCESSING
- ✅ DELIVERED

**Rate Limit:** 100/min (as configured)

### Environment Variables
Add the following environment variable to **BOTH** Vercel deployments:

**Main Site (sbbundles-main.vercel.app):**
```
DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Store Site (bundles-store.vercel.app):**
```
DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

> **Important:** Use the same secret value for both sites since they share the same codebase.

## Webhook Payload Format

Dakazina sends webhooks with the following structure:

```json
{
  "id": 7988,
  "type": "test_event",
  "status": "DELIVERED",
  "previous_status": "PROCESSING",
  "order_code": "DKZ-TEST-RQ5WKR",
  "reference": "REF-HETWWVUOTM",
  "amount": 10,
  "user_id": 4,
  "occurred_at": "2026-04-10T21:15:44+00:00",
  "test": true,
  "metadata": {
    "message": "This is a test webhook from Dakazina"
  }
}
```

## How It Works

1. **Webhook Reception**: The `/api/webhooks/dakazina` endpoint receives webhook notifications
2. **Authentication**: Webhooks are authenticated using the `DAKAZINA_WEBHOOK_SECRET`
3. **Status Updates**: The webhook updates two tables:
   - `transactions`: Updates the order status in the main transactions table
   - `provider_order_overrides`: Stores status overrides for admin display
4. **Real-time Display**: The admin orders table (`/myadminportal/orders`) displays the updated status immediately

## Testing

### Test Script
Use the provided test script to verify webhook functionality:

```bash
# Set your webhook secret
export DAKAZINA_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Run the test
node test-webhook.js
```

### Manual Testing
You can also test manually using curl:

```bash
curl -X POST https://sbbundles-main.vercel.app/api/webhooks/dakazina \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456" \
  -d '{
    "id": 7988,
    "type": "test_event",
    "status": "DELIVERED",
    "order_code": "DKZ-TEST-RQ5WKR",
    "reference": "REF-TEST-123",
    "amount": 10,
    "occurred_at": "2026-04-10T21:15:44+00:00",
    "test": true
  }'
```

## Order Status Flow

The webhook supports these status updates:
- **PROCESSING**: Order is being processed by Dakazina
- **DELIVERED**: Data bundle has been successfully delivered
- **CANCELED**: Order was canceled (if supported by Dakazina)

## Admin Features

The admin orders table at `/myadminportal/orders` provides:
- Real-time status updates from webhooks
- Manual status override capability
- Order history from both main site and store orders
- Filtering and search functionality
- Status change notifications

## Security

- Webhooks require authentication via `x-webhook-secret` header
- Only authenticated requests are processed
- All webhook activities are logged for debugging
- Test webhooks are marked and handled appropriately

## Troubleshooting

If webhooks aren't working:
1. Verify the webhook URL is correct in Dakazina settings
2. Check that `DAKAZINA_WEBHOOK_SECRET` is set in Vercel
3. Ensure the secret matches between Dakazina and your app
4. Check Vercel function logs for webhook processing errors
5. Verify orders exist in the transactions table with matching references

## Support

For issues with the webhook integration:
1. Check the browser console for JavaScript errors
2. Review Vercel function logs
3. Test with the provided test script
4. Verify order references match between systems
