# Dual Deployment Setup Guide

## Overview
Deploy the same codebase to two separate Vercel projects:
- **Main App**: `bundle-ghana.vercel.app` (full features)
- **Store App**: `storebundles.vercel.app` (store-only frontend)

## Architecture
```
┌─────────────────┐    ┌─────────────────┐
│ bundle-ghana    │    │ storebundles    │
│   .vercel.app   │    │   .vercel.app   │
│                 │    │                 │
│ Main Website    │    │ Store Frontend  │
│ Admin Panel     │    │ Customer Views  │
│ All Features    │    │ Store Pages Only│
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │   Supabase DB   │
          │  (Single Source) │
          └─────────────────┘
```

## Step 1: Environment Variables

### Main App (bundle-ghana.vercel.app)
```env
NEXT_PUBLIC_APP_MODE=main
NEXT_PUBLIC_STORE_DOMAIN=storebundles.vercel.app
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_key
PAYSTACK_SECRET_KEY=your_paystack_secret
# ... other existing env vars
```

### Store App (storebundles.vercel.app)
```env
NEXT_PUBLIC_APP_MODE=store
NEXT_PUBLIC_STORE_DOMAIN=storebundles.vercel.app
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_key
PAYSTACK_SECRET_KEY=your_paystack_secret
# ... other existing env vars (same as main)
```

## Step 2: Vercel Setup

### Option A: One Repository (Recommended)
1. Create one Vercel project for main app
2. Create second Vercel project pointing to same GitHub repo
3. Set different environment variables for each project

### Option B: Two Repositories
1. Create `storebundles` repo as copy of `bundle-ghana`
2. Deploy each repo to separate Vercel projects
3. Keep both repos in sync (more maintenance)

## Step 3: Paystack Configuration
Add both domains to your Paystack dashboard:
1. Go to Paystack Dashboard → Settings → Domains
2. Add: `bundle-ghana.vercel.app`
3. Add: `storebundles.vercel.app`
4. Add any custom domains you use

## Step 4: Custom Domain (Optional)
For `storebundles.vercel.app` you can set up custom domains:
1. In Vercel project settings → Domains
2. Add custom domain like `storebundles.com`
3. Update `NEXT_PUBLIC_STORE_DOMAIN` env var
4. Update Paystack domains

## Step 5: How It Works

### URL Generation
- Main App: `/store/john-doe` → `bundle-ghana.vercel.app/store/john-doe`
- Store App: `/store/john-doe` → `storebundles.vercel.app/john-doe`

### Route Restrictions
Store app only allows:
- `/` (home redirects to store)
- `/store/[slug]` (store pages)
- API endpoints needed for stores

Store app blocks:
- `/admin`, `/dashboard`, `/reseller`, `/profile`
- Admin APIs
- Any main app features

### Database Sharing
Both apps use the same Supabase database:
- Orders from store app appear in main admin panel
- Reseller pricing updates reflect instantly
- User authentication works across both
- No syncing needed

## Step 6: Testing Checklist

### Store App Tests
- [ ] Store URL works: `storebundles.vercel.app/john-doe`
- [ ] Admin routes redirect to home
- [ ] Orders appear in main admin panel
- [ ] Paystack payments work
- [ ] Data delivery works

### Main App Tests  
- [ ] All features work normally
- [ ] Admin panel accessible
- [ ] Store URLs use correct domain
- [ ] No functionality broken

## Step 7: Deployment Commands

```bash
# Deploy both apps (one repo approach)
git push origin main
# Both Vercel projects auto-deploy from same push

# Deploy manually if needed
vercel --prod  # Main app
vercel --prod --scope storebundles  # Store app
```

## Benefits
✅ **Zero Sync Needed**: Same database = instant updates  
✅ **Customer Isolation**: They never see bundle-ghana.vercel.app  
✅ **Shared Logic**: Same pricing, orders, DataKazina API  
✅ **Easy Maintenance**: One codebase, deploy fixes to both  
✅ **Professional Branding**: Custom domain for stores  

## Troubleshooting

### Store App Shows Blank Pages
- Check `NEXT_PUBLIC_APP_MODE=store` is set
- Verify middleware-store.ts is working
- Check browser console for routing errors

### Paystack Fails on Store App
- Add store domain to Paystack dashboard
- Verify Paystack keys are identical on both apps
- Check callback URLs in Paystack settings

### Orders Not Appearing in Admin
- Verify both apps use same Supabase URL/keys
- Check `store_id` is being set correctly
- Verify database permissions

### Store URLs Wrong Domain
- Check `NEXT_PUBLIC_STORE_DOMAIN` env var
- Verify `getStoreUrl()` function usage
- Clear browser cache
