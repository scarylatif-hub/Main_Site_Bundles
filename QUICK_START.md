# Quick Setup Guide for SB Bundles

## Prerequisites

- Node.js 18+ and npm
- Supabase project (https://supabase.com)
- Paystack account (https://paystack.com)
- External API access credentials

## Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in Supabase credentials:**
   ```
   # Get from: Supabase Dashboard → Project Settings → API
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Fill in Paystack credentials:**
   ```
   # Get from: Paystack Dashboard → Settings → API Keys & Webhooks
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
   PAYSTACK_SECRET_KEY=sk_live_...
   ```

4. **Fill in External API:**
   ```
   EXTERNAL_API_URL=https://api.provider.com
   EXTERNAL_API_KEY=6C0gNLA90BmVVMaZOgOglMFF0mvR4uczlnSPj5beLY
   ```

## Database Setup

1. **Create Supabase project**

2. **Run migrations in Supabase SQL Editor:**
   ```sql
   -- Paste contents from src/lib/database.sql
   ```

3. **Verify tables created:**
   - `public.profiles` - User accounts & wallets
   - `public.transactions` - Payment history

4. **Enable RLS** (Row Level Security) in Supabase

## Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Visit http://localhost:3000
```

## Testing the Flow

### 1. Signup
```
1. Go to http://localhost:3000/signup
2. Enter: Full Name, Email, Phone (0XX XXX XXXX), Password
3. Password must have: uppercase, lowercase, numbers, special char
4. Click "Create Account"
```

**Expected:** Account created, redirected to home

### 2. Deposit Funds
```
1. Login if needed
2. On home page, see "Wallet Balance: GHS 0.00"
3. Enter deposit amount (e.g., 50)
4. Click "Deposit Funds"
5. Complete Paystack payment
```

**Expected:** Wallet shows updated balance

### 3. Purchase Data
```
1. Select phone number and network (MTN, Telecel, AirtelTigo)
2. Choose a package
3. Click "Buy"
4. Go to cart
5. Click "Checkout"
6. Click "Pay with Wallet"
```

**Expected:** Purchase successful, wallet deducted

### 4. Check History
```
1. Click "Wallet" in navigation
2. View transaction history
```

**Expected:** All deposits and purchases listed

## Paystack Test Cards

Use these in test mode:

| Card Number | Expiry | CVV |
|-------------|--------|-----|
| 4111111111111111 | 01/25 | 123 |
| 5555555555554444 | 01/25 | 123 |

**Test Phone:** Use any number with MoMo

## API Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/profile` | Create profile |
| GET | `/api/auth/profile` | Get profile |
| POST | `/api/paystack/initialize` | Start payment |
| GET | `/api/paystack/verify` | Verify payment |
| POST | `/api/paystack/webhook` | Webhook callback |
| GET | `/api/packages` | List packages (with fallback) |
| GET | `/api/external/all-packages` | Fetch from provider |
| POST | `/api/external/buy-other` | Purchase with provider |
| GET | `/api/external/all-orders` | Order history |
| GET | `/api/external/all-orders-by-transaction` | Single order lookup |
| POST | `/api/buy-bundle` | Wallet purchase |

## Troubleshooting

### Build Errors
```bash
npm run build
# Check for TypeScript errors
```

### Supabase Connection Issues
```
Error: Failed to connect to Supabase
→ Verify NEXT_PUBLIC_SUPABASE_URL is correct
→ Check NEXT_PUBLIC_SUPABASE_ANON_KEY is valid
```

### Paystack Not Working
```
Error: Payment gateway is not ready
→ Verify NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY starts with pk_
→ Check PAYSTACK_SECRET_KEY is set
```

### Profile Not Created
```
No profile found after signup
→ Check Supabase RLS policies
→ Verify handle_new_user trigger exists
→ Check database logs in Supabase
```

### Wallet Not Updating
```
Balance not changing after payment
→ Run verification endpoint manually
→ Check webhook logs in Paystack
→ Verify RPC function permissions
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Project → Settings → Environment Variables
```

### Other Platforms
1. Set all environment variables
2. Run `npm run build`
3. Run `npm start`
4. Configure webhook URL in Paystack

## Next Steps

- [ ] Complete environment setup
- [ ] Run database migrations
- [ ] Test signup/login flow
- [ ] Test wallet deposit
- [ ] Test data purchase
- [ ] Deploy to production
- [ ] Monitor transactions
- [ ] Scale external API calls

## Support Files

- `IMPLEMENTATION_GUIDE.md` - Detailed documentation
- `.env.example` - Environment template
- `src/lib/database.sql` - Database schema
- `API_TESTING.md` - API endpoints reference

## Useful Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

**Need help?** Check the `IMPLEMENTATION_GUIDE.md` for more details.
