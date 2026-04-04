# SB Bundles - Complete Implementation Guide

## Overview

This document describes the complete implementation of the SB Bundles wallet-only data purchase system with Supabase authentication, Paystack payments, and external API integration.

---

## 1. Authentication & User Profiles

### Signup Flow

**Endpoint:** `POST /auth/signUp` (Supabase)

```typescript
// Frontend
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "SecurePass123!@#",
  options: {
    data: {
      full_name: "John Doe",
      phone_number: "0501234567",
    }
  }
});

// Backend automatically creates profile via trigger
```

**What happens:**
1. Auth user created in `auth.users` table
2. Trigger `on_auth_user_created` fires
3. Profile automatically created in `public.profiles` table with:
   - `wallet_balance: 0`
   - `is_admin: false`
   - `email`: from auth user

### Login Flow

**Endpoint:** `POST /auth/signInWithPassword` (Supabase)

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "SecurePass123!@#"
});
```

### Logout

```typescript
await supabase.auth.signOut();
```

### Get Profile

**Endpoint:** `GET /api/auth/profile`

```typescript
const response = await fetch('/api/auth/profile');
const profile = await response.json();
// Returns: { id, full_name, email, phone_number, wallet_balance, is_admin, updated_at }
```

---

## 2. Wallet & Deposits

### Deposit Funds via Paystack

#### Step 1: Initialize Payment

**Endpoint:** `POST /api/paystack/initialize`

```typescript
const response = await fetch('/api/paystack/initialize', {
  method: 'POST',
  body: JSON.stringify({
    amount: 50.00,            // GHS amount
    type: 'deposit',          // 'deposit' or 'purchase'
    description: 'Wallet top-up'
  })
});

const { authorizationUrl, reference } = await response.json();
// User redirected to authorizationUrl to complete payment
```

#### Step 2: Webhook Verification

When payment is completed, Paystack sends webhook to `POST /api/paystack/webhook`

```
Headers:
  x-paystack-signature: <signature>

Body:
{
  "event": "charge.success",
  "data": {
    "reference": "DEPOSIT_abc123_1234567890",
    "amount": 5000,  // in kobo (GHS 50.00)
    "status": "success",
    "metadata": {
      "userId": "user-uuid",
      "type": "deposit",
      "description": "Wallet top-up"
    }
  }
}
```

**Backend verification:**
1. Signature verified using `PAYSTACK_SECRET_KEY`
2. RPC function called: `add_to_wallet_and_log_transaction()`
3. Wallet balance updated
4. Transaction logged in `transactions` table

### Check Wallet Balance

Access `userProfile.wallet_balance` from `useAuth()` hook

```typescript
const { userProfile } = useAuth();
console.log(`Balance: GHS ${userProfile?.wallet_balance}`);
```

---

## 3. Data Packages & Shopping

### Fetch All Packages

**Endpoint:** `GET /api/packages`

Returns fallback data if external API not configured. Format:

```typescript
[
  {
    id: 'mtn-1gb',
    network: { id: 1, name: 'MTN' },
    dataAmount: '1GB',
    validity: '30 days',
    price: 4.57,
    sharedBundle: 1
  },
  // ... more packages
]
```

### Fetch from External API

**Endpoint:** `GET /api/external/all-packages`

Proxies to external provider and returns raw data.

### Add to Cart

```typescript
const { addToCart } = useCart();

addToCart({
  recipientMsisdn: '0501234567',
  networkId: 1,
  networkName: 'MTN',
  sharedBundle: 10,
  price: 42.86,
  dataAmount: '10GB'
});
```

### View Cart

```typescript
const { cartItems, totalPrice } = useCart();
// cartItems[]: CartItem[]
// totalPrice: number
```

---

## 4. Checkout & Purchase

### Check Balance Before Purchase

```typescript
const { userProfile } = useAuth();
const { totalPrice } = useCart();

if (userProfile.wallet_balance < totalPrice) {
  // Show insufficient balance alert
  // Redirect to wallet for deposit
}
```

### Process Purchase

**Endpoint:** `POST /api/buy-bundle`

```typescript
const response = await fetch('/api/buy-bundle', {
  method: 'POST',
  body: JSON.stringify({
    recipientMsisdn: '0501234567',
    networkId: 1,
    sharedBundle: 10,
    price: 42.86,
    dataAmount: '10GB'
  })
});

if (response.ok) {
  // Purchase successful
  // Wallet deducted
  // Transaction logged
  // External API called to deliver bundle
}
```

**What happens:**
1. Wallet balance verified (must be >= price)
2. Wallet deducted immediately
3. Transaction logged with status: 'pending'
4. External API called to deliver bundle
5. Provider returns success → Transaction status: 'delivered'
6. Or provider fails → Wallet refunded

---

## 5. External API Integration

### Available Endpoints

All proxied through your backend for security.

#### 1. Get All Packages

**Endpoint:** `GET /api/external/all-packages`

```
External: GET /api/external/packages/all-packages
Headers: X-API-KEY: {EXTERNAL_API_KEY}

Response: Array of packages
```

#### 2. Purchase Bundle

**Endpoint:** `POST /api/external/buy-other`

```
External: POST /api/external/packages/buy-other
Headers: X-API-KEY: {EXTERNAL_API_KEY}

Body:
{
  "recipient_msisdn": "0501234567",
  "network_id": 1,
  "shared_bundle": 10
}

Response:
{
  "success": true,
  "transaction_id": "TXN_12345",
  "message": "Bundle purchased successfully"
}
```

#### 3. Get All Orders

**Endpoint:** `GET /api/external/all-orders`

```
External: GET /api/external/orders/all-orders
Headers: X-API-KEY: {EXTERNAL_API_KEY}

Response: Array of orders (or empty array on error)
```

#### 4. Get Order by Transaction

**Endpoint:** `GET /api/external/all-orders-by-transaction`

```
External: GET /api/external/orders/all-orders-by-transaction
Query: ?transactionId={id}
Headers: X-API-KEY: {EXTERNAL_API_KEY}

Response: Single order or null
```

---

## 6. Transaction History

### Fetch Transactions

```typescript
const { data: transactions } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

### Transaction Object

```typescript
{
  id: uuid,                      // Unique transaction ID
  user_id: uuid,                 // User who initiated
  transaction_code: string,      // Reference (Paystack ref or purchase ID)
  transaction_type: string,      // 'purchase' or 'deposit'
  recipient_msisdn: string,      // Phone number (for purchases)
  network_id: number,            // Network ID (for purchases)
  bundle_amount: string,         // '10GB' (for purchases)
  amount: numeric,               // GHS amount
  status: string,                // 'success', 'failed', 'pending'
  description: string,           // Human-readable description
  created_at: timestamptz        // When transaction occurred
}
```

---

## 7. RPC Functions (Backend Database)

### add_to_wallet_and_log_transaction

Called when depositing funds:

```sql
SELECT add_to_wallet_and_log_transaction(
  p_user_id := 'user-uuid',
  p_amount := 50.00,
  p_transaction_type := 'deposit',
  p_status := 'success',
  p_transaction_code := 'PAYSTACK_REF',
  p_description := 'Wallet top-up'
);
```

**What it does:**
1. Updates `profiles.wallet_balance += amount`
2. Inserts transaction record
3. Sets `updated_at` timestamp

### purchase_bundle_and_log_transaction

Called when purchasing data:

```sql
SELECT purchase_bundle_and_log_transaction(
  p_user_id := 'user-uuid',
  p_amount := -42.86,  -- Negative for deduction
  p_transaction_code := 'TXN_12345',
  p_status := 'pending',
  p_recipient_msisdn := '0501234567',
  p_network_id := 1,
  p_bundle_amount := '10GB',
  p_description := 'MTN 10GB data purchase'
);
```

**What it does:**
1. Deducts from `profiles.wallet_balance` (amount is negative)
2. Inserts transaction record
3. Sets `updated_at` timestamp

---

## 8. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_SECRET_KEY=sk_live_...

# External API
EXTERNAL_API_URL=https://api.provider.com
EXTERNAL_API_KEY=6C0gNLA90BmVVMaZOgOglMFF0mvR4uczlnSPj5beLY

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 9. Paystack Webhook Setup

1. Log into Paystack dashboard
2. Go to Settings → API Keys & Webhooks
3. Add webhook URL: `https://yourdomain.com/api/paystack/webhook`
4. Events to enable:
   - **charge.success** (main event for deposits)

5. Test webhook:
   ```bash
   curl -X POST http://localhost:3000/api/paystack/webhook \
     -H "x-paystack-signature: <signature>" \
     -H "Content-Type: application/json" \
     -d '{...}'
   ```

---

## 10. Error Handling

### Insufficient Balance
```
Status: 400
{
  "error": "Insufficient funds. Please top up your wallet."
}
```

### Payment Verification Failed
```
Status: 400
{
  "error": "Payment verification failed"
}
```

### External API Unavailable
```
Status: 503
{
  "error": "Failed to purchase bundle from provider"
}
```

### Invalid API Key
```
Status: 401
{
  "error": "Unauthorized"
}
```

---

## 11. Testing Checklist

- [ ] Signup creates profile and wallet
- [ ] Login retrieves profile with balance
- [ ] Deposit via Paystack updates balance
- [ ] Webhook processes payment correctly
- [ ] Packages load (fallback or external API)
- [ ] Add to cart works
- [ ] Checkout shows balance check
- [ ] Purchase deducts from wallet
- [ ] Transaction history displays correctly
- [ ] External API endpoints respond

---

## 12. Deployment Checklist

- [ ] Set all environment variables in hosting
- [ ] Enable Supabase RLS policies
- [ ] Configure Paystack webhook
- [ ] Set external API credentials
- [ ] Run database migrations
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook delivery
- [ ] Set up error logging/monitoring

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── profile/route.ts          # Profile CRUD
│   │   ├── external/
│   │   │   ├── all-packages/route.ts
│   │   │   ├── buy-other/route.ts
│   │   │   ├── all-orders/route.ts
│   │   │   └── all-orders-by-transaction/route.ts
│   │   ├── paystack/
│   │   │   ├── initialize/route.ts       # Start payment
│   │   │   └── webhook/route.ts          # Payment confirmation
│   │   └── buy-bundle/route.ts           # Purchase with wallet
│   ├── signup/page.tsx                   # Signup form
│   ├── login/page.tsx                    # Login form
│   ├── checkout/page.tsx                 # Checkout page
│   └── wallet/page.tsx                   # Wallet & history
├── context/
│   ├── auth-context.tsx                  # Auth state
│   └── cart-context.tsx                  # Cart state
├── hooks/
│   ├── use-paystack.ts                   # Paystack integration
│   └── use-cart.ts                       # Cart management
└── lib/
    ├── paystack-config.ts                # Fee calculations
    └── supabase/
        ├── client.ts
        └── server.ts
```

---

## Support & Debugging

### Common Issues

**Profile not created after signup:**
- Check database trigger `on_auth_user_created`
- Verify Supabase API key has proper permissions
- Check RLS policies on profiles table

**Paystack webhook not received:**
- Verify webhook URL is publicly accessible
- Check Paystack dashboard for webhook logs
- Ensure `PAYSTACK_SECRET_KEY` matches dashboard

**External API failing:**
- Verify `EXTERNAL_API_KEY` and `EXTERNAL_API_URL`
- Check network connectivity
- Review external API rate limits

**Balance not updating:**
- Check RPC function permissions
- Verify wallet_balance column has no check constraints
- Review transaction logs

---

**Version:** 1.0  
**Last Updated:** April 4, 2026
