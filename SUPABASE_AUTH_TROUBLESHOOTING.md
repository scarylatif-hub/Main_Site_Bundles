# Supabase Auth Setup & Troubleshooting Guide

## Problem Summary

The "Failed to fetch" error during signup is caused by a "Database error creating new user" from the Supabase auth service. This indicates the Supabase project's auth system is not properly configured.

## Root Cause

Supabase requires specific configuration for email/password authentication:
1. Authentication provider must be enabled (email/password)
2. Email provider must be configured
3. Database triggers and functions must exist
4. Auth tables must be properly set up

## Solution Steps

### Step 1: Verify Auth Settings in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project: `ieqrdlbdqilzwibtyyqy`
3. Navigate to: **Authentication** → **Settings**
4. Check these settings:

   a. **General Settings:**
   - Enable "User sign-ups" 
   - Enable "Email provider"
   - Set "Email confirmation" to "Enabled" or "Disabled" (your choice)

   b. **Security Settings:**
   - JWT expiry: 3600s (1 hour default is fine)
   - Refresh token rotation: Enabled
   - Enable MFA: Optional

5. **Click "Save"**

### Step 2: Verify Email Provider Configuration

1. Still in Authentication settings, go to **Providers** tab
2. Find **Email** provider
3. Confirm it shows "Enabled"
4. If "Disabled", click **Enable**

### Step 3: Run the Database Schema

Even though profiles table exists, there might be missing auth configuration SQL:

1. Go to: **SQL Editor**  
2. Click **New Query**
3. Copy and paste this SQL to ensure auth is working:

```sql
-- Verify internal auth schema exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'audit_log_entries'
);

-- Verify users table is available
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'users'
  AND table_schema = 'auth'
);

-- If above returns false, you may need to contact Supabase support
-- or recreate the project with auth enabled
```

### Step 4: Test Signup with the Debug Pages

After confirming auth settings, test via the debug pages:

1. **Debug Page 1 - System Check:** http://localhost:9002/debug/supabase
   - Verify REST API returns 200
   - Verify profiles table is accessible

2. **Debug Page 2 - Auth Test:** http://localhost:9002/debug/auth
   - Click "Test Sign Up" button
   - Check browser console (F12) for detailed error messages
   - Note any error codes from Supabase

### Step 5: If Still Getting Errors

If you're still seeing "Database error creating new user", try:

#### Option A: Complete Project Reset (Recommended if errors persist)

1. Go to **Project Settings** → **General**
2. Select "Restart project" or "Reset database"
3. This will rebuild auth infrastructure from scratch
4. Re-run the database schema from `src/lib/database.sql`

#### Option B: Create New Supabase Project

If the above doesn't work:

1. Create a new Supabase project
2. Update `.env.local` with new credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<new-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-key>
   SUPABASE_SERVICE_ROLE_KEY=<new-service-key>
   ```
3. Run database schema on new project
4. Test signup again

## Alternative: Client-Side Signup Workaround

If server-side signup continues to fail due to Supabase auth database issues:

1. Go to file: `src/app/signup/page.tsx`
2. Revert to client-side authentication (previous version)
3. This uses:
   - `supabase.auth.signUp()` for auth
   - Automatic db trigger for profile creation

This might work better depending on your Supabase auth configuration.

## Debug Information

**Current Status:**
- ✅ Dev server running on port 9002
- ✅ Supabase API reachable (HTTP 200)
- ✅ Database tables accessible
- ✅ REST API working
- ❌ Auth service returning: "Database error creating new user"

**Files Changed:**
- `src/lib/supabase/client.ts` - Updated with env vars & auth config
- `src/app/api/auth/signup/route.ts` - New server-side signup endpoint
- `src/app/signup/page.tsx` - Updated to use server-side signup
- `src/app/debug/supabase/page.tsx` - New debug page
- `src/app/debug/auth/page.tsx` - New auth test page

## Next Steps

1. **First, check auth settings** in Supabase dashboard (Step 1-2 above)
2. **Test with debug pages** to see specific error details
3. **If "confirmed_at" errors appear**, check email confirmation settings
4. **If persists, try project reset** (Option A in Step 5)

## Support Information

Keep these items ready if you need Supabase support:
- Project ID: `ieqrdlbdqilzwibtyyqy`
- Error message: "Database error creating new user"
- Error type: AuthRetryableFetchError → "Failed to fetch"
- Server error: "Database error creating new user" from auth.admin.createUser()

