# Supabase Auth System - Full Setup & Workaround Guide

## Problem Analysis

Your Supabase project has:
- ✅ Profiles table exists
- ✅ Foreign key constraint exists (profiles.id → auth.users.id)
- ❌ Auth infrastructure NOT working
- ❌ Cannot create users via `signUp()` or `admin.createUser()`
- ❌ Cannot insert profiles directly (FK constraint violation)

## Solution: Enable Supabase Auth

### Step 1: Go to Supabase Dashboard

1. Open: https://supabase.com/dashboard
2. Select project: `ieqrdlbdqilzwibtyyqy`
3. Navigate to: **Authentication** → **Settings**

### Step 2: Enable Email/Password Authentication

Under "General Settings":

```
☑ Enable user sign-ups
☑ Confirm email
(or set to ☑ Confirm phone if preferred)
☑ Enable email provider
```

Scroll down and click **Save**.

### Step 3: Verify Authentication Providers

Go to: **Authentication** → **Providers**

Confirm: **Email** provider is **Enabled**

### Step 4: Test Email Provider Configuration

Go to: **Authentication** → **Email Templates**

Ensure: **Confirm signup email** template exists

### Step 5: Deploy Database Schema (If Not Done)

Go to: **SQL Editor** → **New Query**

Copy-paste the entire contents of `src/lib/database.sql` and run it.

### Step 6: Restart Supabase Project (Optional but Recommended)

Go to: **Project Settings** → **General**

Click: **Restart project**

Wait 1-2 minutes for restart to complete.

## After Auth is Enabled

Then test signup:

```bash
curl -X POST http://localhost:9002/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"yourtest@example.com",
    "password":"TestPass123!",
    "fullName":"Test User",
    "phone":"0123456789"
  }'
```

Expected response:
```json
{
  "success": true,
  "userId": "...",
  "email": "yourtest@example.com",
  "profile": {...}
}
```

## Troubleshooting: If Auth Still Doesn't Work

### Option A: Remove FK Constraint (Temporary Workaround)

If you want to proceed without auth, remove the foreign key:

1. Go to **SQL Editor** → **New Query**
2. Run:
```sql
ALTER TABLE public.profiles
DROP CONSTRAINT profiles_id_fkey;
```

Then signup will create users in profiles table only.

### Option B: Create New Supabase Project

If auth is still broken:

1. Create new project at https://supabase.com/dashboard
2. Note the new credentials
3. Update `.env.local` with new credentials
4. Deploy database schema again
5. This fresh project should have auth working

## Debug Commands

Test if auth is actually working:

```bash
# Via Supabase CLI
supabase link --project-ref ieqrdlbdqilzwibtyyqy
supabase db pull  # Check schema

# Via REST API to check if auth tables exist
curl https://ieqrdlbdqilzwibtyyqy.supabase.co/rest/v1/information_schema.tables?table_schema=eq.auth \
  -H "apikey: YOUR_ANON_KEY"
```

## Current Status

- Dev server: http://localhost:9002
- Signup endpoint: POST /api/auth/signup
- Signin endpoint: POST /api/auth/signin
- Debug pages: /debug/supabase, /debug/auth

You need to enable auth in Supabase dashboard before signup/signin will work fully.

