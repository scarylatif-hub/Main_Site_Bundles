# SB Bundles - Setup Verification Checklist

Use this checklist to verify your setup before going to production.

---

## 1. Environment Configuration

- [ ] `.env.local` file created (copy from `.env.example`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Filled with actual Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Filled with anon key from Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Filled with service role key
- [ ] `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` - Starts with `pk_live_`
- [ ] `PAYSTACK_SECRET_KEY` - Filled with secret key
- [ ] `EXTERNAL_API_URL` - Set to provider URL
- [ ] `EXTERNAL_API_KEY` - Set to API key provided

**Verification:** 
```bash
# Check environment file exists
ls -la .env.local
```

---

## 2. Supabase Setup

### Create Project
- [ ] Supabase account created (https://supabase.com)
- [ ] New project created
- [ ] Project URL copied to environment
- [ ] Anon key copied to environment
- [ ] Service role key copied to environment

### Database Schema
- [ ] Logged into Supabase SQL Editor
- [ ] Copied `src/lib/database.sql` content
- [ ] Pasted into SQL Editor and executed
- [ ] Verify tables created:
  - [ ] `public.profiles` exists
  - [ ] `public.transactions` exists
- [ ] Verify RLS enabled on both tables
- [ ] Verify triggers created:
  - [ ] `on_auth_user_created` trigger exists

### Row Level Security (RLS)
- [ ] RLS enabled on `profiles` table
- [ ] RLS enabled on `transactions` table
- [ ] Write policies allow authenticated users
- [ ] Read policies for own data only

**Verification in Supabase:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Check functions exist
SELECT proname FROM pg_proc WHERE pronamespace = 
  (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

---

## 3. Paystack Setup

### API Keys
- [ ] Paystack account created (https://paystack.com)
- [ ] Public key copied to `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- [ ] Secret key copied to `PAYSTACK_SECRET_KEY`
- [ ] Keys are from **Live** environment (not test)

**Verify:** Public key should start with `pk_live_` and secret with `sk_live_`

### Webhook Configuration
- [ ] Logged into Paystack Dashboard
- [ ] Navigated to Settings → API Keys & Webhooks
- [ ] Added webhook URL: `https://yourdomain.com/api/paystack/webhook`
- [ ] Enabled event: `charge.success`
- [ ] Test webhook delivery (should return 200 OK)

**Local Testing:**
```bash
# Paystack sends to https://yourdomain.com/api/paystack/webhook
# Should return { ok: true }
```

### Test Payments
- [ ] Test with provided Paystack test cards
- [ ] Webhook successfully delivers
- [ ] Balance updates in database
- [ ] Transaction recorded

---

## 4. External API Setup

### Credentials
- [ ] API URL obtained from provider
- [ ] API key obtained from provider: `6C0gNLA90BmVVMaZOgOglMFF0mvR4uczlnSPj5beLY`
- [ ] Both stored in environment variables
- [ ] Network connectivity verified

### Endpoint Testing
Test each endpoint is accessible:

```bash
# Test all-packages
curl -H "X-API-KEY: your_key" \
  https://api.provider.com/api/external/packages/all-packages

# Test buy-other
curl -X POST \
  -H "X-API-KEY: your_key" \
  -H "Content-Type: application/json" \
  -d '{"recipient_msisdn":"0501234567","network_id":1,"shared_bundle":10}' \
  https://api.provider.com/api/external/packages/buy-other

# Test all-orders
curl -H "X-API-KEY: your_key" \
  https://api.provider.com/api/external/orders/all-orders

# Test order by transaction
curl -H "X-API-KEY: your_key" \
  "https://api.provider.com/api/external/orders/all-orders-by-transaction?transactionId=TXN_123"
```

---

## 5. Local Development Testing

### Installation
```bash
# Install dependencies
npm install

# Verify build
npm run build
```

- [ ] No build errors
- [ ] No TypeScript errors
- [ ] All routes compiled

### Development Server
```bash
npm run dev
```

- [ ] Server starts on http://localhost:3000
- [ ] No console errors
- [ ] Pages load

### Verify Database Connection
```bash
# In browser console or via API
fetch('/api/auth/profile')
  .then(r => r.json())
  .then(console.log)
  // Should return either profile or 401/404 (not 500)
```

---

## 6. Application Flow Testing

### Test Signup
```
1. Navigate to http://localhost:3000/signup
2. Fill in form:
   - Full Name: John Doe
   - Email: john@example.com
   - Phone: 0501234567
   - Password: MyPassword123!@#
3. Check password validation
   ✓ Must have uppercase: Y
   ✓ Must have lowercase: y
   ✓ Must have number: 1
   ✓ Must have special char: !@#
4. Click "Create Account"
5. Should redirect to home page
```

**Verify:**
- [ ] Account created in Supabase Auth
- [ ] Profile created in public.profiles
- [ ] Wallet balance = 0
- [ ] User can see dashboard

### Test Login
```
1. Log out (if logged in)
2. Navigate to http://localhost:3000/login
3. Enter email and password
4. Click "Login"
5. Should redirect to home page
```

**Verify:**
- [ ] Session created
- [ ] Profile loaded
- [ ] Balance displayed

### Test Wallet Deposit
```
1. On home page, find "Wallet Balance" section
2. Enter deposit amount: 50
3. Click "Deposit Funds"
4. Paystack modal should appear
5. Enter test card: 4111111111111111
6. Enter expiry: 01/25
7. Enter CVV: 123
8. Approve payment
9. Should see success message
```

**Verify:**
- [ ] Balance updated to 50.00
- [ ] Transaction logged in database
- [ ] Status = "success"
- [ ] Amount = 50 (not including platform fee)

### Test Package Browsing
```
1. On home page
2. Select phone number: 0501234567
3. Select network: MTN
4. Should see packages list
```

**Verify:**
- [ ] Packages load (from fallback or API)
- [ ] Packages correctly filtered by network
- [ ] Prices display correctly
- [ ] Can click package to add to cart

### Test Add to Cart
```
1. Select package (e.g., MTN 10GB)
2. Click "Buy"
3. Navigate to cart
```

**Verify:**
- [ ] Item added to cart
- [ ] Cart displays phone number, network, amount
- [ ] Total calculated correctly

### Test Checkout
```
1. In cart, click "Checkout"
2. Should show:
   - Order summary
   - Wallet balance
   - "Pay with Wallet" button
```

**Verify (if sufficient balance):**
- [ ] "Pay with Wallet" button enabled
- [ ] Can click button

**Verify (if insufficient balance):**
- [ ] "Insufficient Balance" error shown
- [ ] Shortfall calculation correct
- [ ] Button disabled
- [ ] Link to deposit provided

### Test Purchase
```
1. (Ensure wallet has enough: ≥ package price)
2. Click "Pay with Wallet"
3. Should process payment
```

**Verify:**
- [ ] Success message displayed
- [ ] Wallet balance reduced by purchase amount
- [ ] Transaction logged
- [ ] Status depends on external API response

### Test Transaction History
```
1. Navigate to Wallet page
2. Scroll to "Transaction History"
```

**Verify:**
- [ ] All deposits shown with + sign (green)
- [ ] All purchases shown with - sign (red)
- [ ] Amounts correct
- [ ] Timestamps displayed
- [ ] Description helpful

---

## 7. API Endpoint Testing

Test each endpoint manually:

### Auth Profile
```bash
# Get profile (requires authentication)
curl -H "Authorization: Bearer <session_token>" \
  http://localhost:3000/api/auth/profile
# Should return: { id, full_name, email, phone_number, wallet_balance, is_admin, updated_at }
```

- [ ] Returns current user profile
- [ ] Returns 401 if not authenticated
- [ ] Returns 404 if profile doesn't exist

### Paystack Initialize
```bash
curl -X POST http://localhost:3000/api/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{"amount":50,"type":"deposit","description":"Test"}'
# Should return: { authorizationUrl, reference, accessCode }
```

- [ ] Returns authorization URL
- [ ] Reference generated correctly
- [ ] Amount calculated with fees

### Packages (Fallback)
```bash
curl http://localhost:3000/api/packages
# Should return array of packages
```

- [ ] Returns fallback packages (if external API not configured)
- [ ] Or returns from external API (if configured)
- [ ] Never returns 500 error

### Buy Bundle
```bash
curl -X POST http://localhost:3000/api/buy-bundle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "recipientMsisdn":"0501234567",
    "networkId":1,
    "sharedBundle":10,
    "price":42.86,
    "dataAmount":"10GB"
  }'
# Should return success or error
```

- [ ] Requires authentication
- [ ] Checks wallet balance
- [ ] Returns 400 if insufficient funds
- [ ] Calls external API
- [ ] Updates wallet and logs transaction

---

## 8. Error Handling Verification

### Test Insufficient Balance
- [ ] Try to buy when wallet < price
- [ ] Error message displays correctly
- [ ] Shortfall shown
- [ ] Button disabled
- [ ] Can deposit more

### Test Invalid Payment
- [ ] Use declined card in Paystack
- [ ] Should show error
- [ ] Wallet not charged
- [ ] Can retry

### Test Network Errors
- [ ] Disconnect internet
- [ ] Try to load packages
- [ ] Should show error gracefully
- [ ] Fallback data shown
- [ ] No app crash

### Test Missing Credentials
- [ ] Remove `PAYSTACK_SECRET_KEY` from environment
- [ ] Try to deposit
- [ ] Should show configuration error
- [ ] Not a blank page

---

## 9. Database Verification

### Check Data Integrity
```sql
-- In Supabase SQL Editor

-- Check profiles created
SELECT COUNT(*) as profile_count FROM public.profiles;

-- Check transactions recorded
SELECT transaction_type, COUNT(*) as count 
FROM public.transactions 
GROUP BY transaction_type;

-- Check wallet totals
SELECT 
  SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
  SUM(CASE WHEN transaction_type = 'purchase' THEN amount ELSE 0 END) as total_purchases
FROM public.transactions;

-- Check for orphaned records
SELECT * FROM public.transactions 
WHERE user_id NOT IN (SELECT id FROM public.profiles);
```

### Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('profiles', 'transactions');
-- Should show: rowsecurity = true for both
```

---

## 10. Production Deployment Checklist

### Before Going Live
- [ ] All environment variables configured
- [ ] OAuth/Auth properly secured
- [ ] Paystack webhook URL updated to production
- [ ] External API configured for production
- [ ] Database backed up
- [ ] SSL certificate installed (HTTPS)
- [ ] Rate limiting configured
- [ ] Error monitoring set up
- [ ] Database monitoring enabled
- [ ] Backups automated

### Deployment Steps
```bash
# Build for production
npm run build

# Test production build locally
npm start

# Deploy to hosting (Vercel, etc.)
# Set all environment variables in hosting dashboard
# Verify webhook URLs are accessible
```

- [ ] Build completes without errors
- [ ] Production server starts
- [ ] All endpoints accessible
- [ ] Database connections work
- [ ] Paystack production keys used
- [ ] External API production URL used

### Post-Deployment
- [ ] Monitor error logs
- [ ] Monitor transaction logs
- [ ] Test full deposit flow
- [ ] Test full purchase flow
- [ ] Check webhook delivery
- [ ] Verify emails sent (if configured)
- [ ] Monitor database performance
- [ ] Verify backups run

---

## 11. Performance Monitoring

### Metrics to Track
- [ ] Page load time < 3 seconds
- [ ] API response time < 1 second
- [ ] Database query time < 500ms
- [ ] Paystack webhook delivery < 5 seconds
- [ ] Error rate < 1%

### Tools to Set Up
- [ ] Sentry or similar for error tracking
- [ ] Vercel Analytics (if using Vercel)
- [ ] Database query logs
- [ ] Webhook delivery logs (Paystack)
- [ ] Uptime monitoring

---

## Quick Reference

### Useful Commands
```bash
# Development
npm run dev

# Build
npm run build

# Production test
npm start

# Type check
npm run typecheck

# Lint
npm run lint
```

### Key Environment Values
```
SUPABASE_URL: https://your-project.supabase.co
PAYSTACK_PUBLIC: pk_live_**** (public, embed in app)
PAYSTACK_SECRET: sk_live_**** (secret, server only)
EXTERNAL_KEY: 6C0gNLA90BmVVMaZOgOglMFF0mvR4uczlnSPj5beLY
```

### Critical Endpoints
- Authentication: Supabase SDK
- Payments: `/api/paystack/*`
- Packages: `/api/packages` (with fallback)
- Purchases: `/api/buy-bundle`
- External: `/api/external/*`

---

## Support & Troubleshooting

### If Something Doesn't Work

1. **Check Environment Variables**
   ```bash
   # Verify all required vars are set
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $PAYSTACK_SECRET_KEY
   echo $EXTERNAL_API_KEY
   ```

2. **Check Database**
   - Verify tables exist in Supabase
   - Verify RLS policies
   - Check triggers are running

3. **Check Paystack**
   - Verify webhook URL is accessible
   - Check Paystack dashboard logs
   - Verify signature verification

4. **Check External API**
   - Test API endpoint directly with curl
   - Verify API key is correct
   - Check network connectivity

5. **Check Logs**
   - Browser console for client errors
   - Terminal for server errors
   - Supabase logs for database errors
   - Paystack logs for payment errors

### Documentation Files
- `IMPLEMENTATION_GUIDE.md` - Complete technical guide
- `QUICK_START.md` - Quick setup
- `API_TESTING.md` - API reference
- `CHANGES_SUMMARY.md` - What was built

---

## Final Sign-Off

Once you've verified all items above, your implementation is ready for production.

**Date Verified:** _________________  
**Verified By:** _________________  
**Environment:** □ Development  □ Staging  □ Production  

---

**Questions?** Check the documentation files or review the inline code comments.
