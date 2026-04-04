# Supabase Database Setup Guide

## Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **ieqrdlbdqilzwibtyyqy**
3. Click **SQL Editor** in the left sidebar
4. Click **+ New Query**

---

## Step 2: Run the Setup Script

1. Copy the entire contents of `src/lib/database.sql`
2. Paste into the SQL Editor
3. Click **Run** (or press `Ctrl+Enter`)

**Expected Output:**
```
SUCCESS

12-20 statements executed
```

---

## Step 3: Verify Database Schema

After running the script, verify the tables were created:

### Check Profiles Table
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `full_name` (text, nullable)
- `email` (text, nullable)
- `phone_number` (text, nullable)
- `wallet_balance` (numeric, NOT NULL, default 0)
- `is_admin` (boolean, default false)
- `updated_at` (timestamp, nullable)

### Check Transactions Table
```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (uuid)
- `user_id` (uuid)
- `transaction_code` (text, unique)
- `transaction_type` (text)
- `recipient_msisdn` (text)
- `network_id` (integer)
- `shared_bundle` (integer)
- `bundle_amount` (text)
- `amount` (numeric)
- `status` (text, default 'pending')
- `description` (text)
- `created_at` (timestamp)

### Verify RLS is Enabled
```sql
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'transactions');
```

Expected:
```
profiles    | true
transactions | true
```

### Verify Functions Exist
```sql
SELECT 
  proname,
  oid
FROM pg_proc
WHERE pronamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
AND proname IN (
  'add_to_wallet_and_log_transaction',
  'purchase_bundle_and_log_transaction',
  'handle_new_user'
);
```

Expected: 3 functions listed

### Verify Triggers Exist
```sql
SELECT 
  trigger_name,
  event_object_table,
  trigger_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

Expected: 2 triggers
- `on_auth_user_created` on `auth.users`
- `handle_updated_at` on `profiles`

---

## Step 4: Test Database Functionality

### Test 1: Create a User (Trigger Test)
1. Go to **Authentication** in Supabase
2. Add a new user:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Click **Create User**

3. Back in SQL Editor, run:
```sql
SELECT id, full_name, email, wallet_balance 
FROM public.profiles 
WHERE email = 'test@example.com';
```

**Expected:** Profile record created automatically with `wallet_balance = 0`

### Test 2: RLS Policy Test
```sql
-- As the authenticated user, should see their own profile
SELECT id, email, wallet_balance FROM public.profiles 
WHERE id = auth.uid() LIMIT 1;
```

**Expected:** Returns user's profile (or empty if not running as authenticated user)

### Test 3: Add Funds (RPC Function Test)
```sql
SELECT add_to_wallet_and_log_transaction(
  'USER_UUID_HERE',  -- Replace with actual user UUID from profiles
  50.00,             -- Amount
  'deposit',         -- Type
  'success',         -- Status
  'TEST_REF_001',    -- Reference
  'Test deposit'     -- Description
);
```

**Expected:** Function executes without error

Then verify transaction was logged:
```sql
SELECT * FROM public.transactions 
WHERE transaction_code = 'TEST_REF_001';
```

**Expected:** Transaction record exists with:
- `amount = 50.00`
- `transaction_type = 'deposit'`
- `status = 'success'`

**And verify wallet was updated:**
```sql
SELECT wallet_balance FROM public.profiles 
WHERE id = 'USER_UUID_HERE';
```

**Expected:** `wallet_balance = 50.00`

### Test 4: Purchase Bundle (RPC Function Test)
```sql
SELECT purchase_bundle_and_log_transaction(
  'USER_UUID_HERE',  -- Replace with actual user UUID
  10.00,             -- Amount to deduct
  'TXN_001',         -- Transaction code
  'pending',         -- Status
  '0501234567',      -- Phone number
  1,                 -- Network ID (MTN)
  10,                -- Bundle amount
  '10GB',            -- Bundle description
  'Test purchase'    -- Description
);
```

**Expected:** Function returns new balance (40.00 if previous balance was 50.00)

Verify transaction logged:
```sql
SELECT * FROM public.transactions 
WHERE transaction_code = 'TXN_001';
```

**Expected:** Transaction with type 'purchase' and amount -10.00

---

## Troubleshooting

### Error: "ERROR: 42601: syntax error"

**Solution:** The SQL script has been fixed to use Supabase-compatible syntax. Run the updated `src/lib/database.sql`.

### Error: "function X already exists"

**Solution:** The script now includes `DROP FUNCTION IF EXISTS` to handle this. Just run the full script again.

### Error: "permission denied"

**Solution:** You may need the service role key. Check that you're logged in with sufficient permissions.

**To use service role:**
1. Get `SUPABASE_SERVICE_ROLE_KEY` from project settings
2. Use it in backend API calls (not frontend)

### Trigger Not Firing

If profiles not creating when new users sign up:

1. Check trigger exists:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

2. Check trigger is enabled:
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

3. Try manual insert to test:
```sql
INSERT INTO public.profiles (id, full_name, email, wallet_balance)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Test User',
  'test@example.com',
  0
);
```

---

## What Each Component Does

### Profiles Table
- Stores user account information
- Links to Supabase Auth users via UUID
- Tracks wallet balance
- RLS: Users can only see/edit their own profile

### Transactions Table
- Logs all financial activity (deposits, purchases)
- Linked to profiles via user_id
- RLS: Users can only see their own transactions

### RPC Functions
**add_to_wallet_and_log_transaction:**
- Called when user deposits funds
- Updates wallet_balance UP
- Creates transaction record with positive amount
- Called from Paystack webhook

**purchase_bundle_and_log_transaction:**
- Called when user purchases data
- Updates wallet_balance DOWN
- Creates transaction record with negative amount
- Called from checkout page

### Triggers
**on_auth_user_created:**
- Fires when new user signs up in Supabase Auth
- Automatically creates profile record
- Sets wallet_balance to 0

**handle_updated_at:**
- Updates the `updated_at` timestamp whenever profile changes
- Automatic tracking of last modification

---

## Environment Variables Used

From your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ieqrdlbdqilzwibtyyqy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are pre-configured in your app - no additional setup needed!

---

## Next Steps

After verifying the database:

1. ✅ Install dependencies: `npm install`
2. ✅ Start development: `npm run dev`
3. ✅ Test signup at http://localhost:3000/signup
4. ✅ Verify profile created in Supabase
5. ✅ Test deposit flow with Paystack

---

**Status:** ✅ Database Ready for Testing
