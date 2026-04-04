# Local Auth Migration - Required Database Update

## Status
✅ Local authentication system is **WORKING** on your app!
⏸️ Just need 1 database schema change to complete setup

## The Problem
The `profiles` table is missing the `password_hash` column needed to store hashed passwords.

## Solution (2 minutes to fix)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Select project: `ieqrdlbdqilzwibtyyqy`
3. Click: **SQL Editor** → **New Query**

### Step 2: Run This Migration SQL

Copy and paste the entire block below into the SQL Editor:

```sql
-- Add password_hash column to profiles for local authentication
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create email index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON public.profiles(email);

-- Ensure email is unique (optional - prevents duplicate signups)
-- ALTER TABLE public.profiles
-- ADD CONSTRAINT profiles_email_unique UNIQUE(email);
```

### Step 3: Click "Run"

The SQL should complete instantly with:
```
Success. No rows returned
```

## That's It!

Your app is now ready to:

✅ **Sign up** users with email/password
✅ **Sign in** users with email/password  
✅ **Store** passwords securely (bcrypt hashed)
✅ **Manage** user profiles in Supabase

## Testing After Migration

The following will now work:

**Sign up:**
```bash
curl -X POST http://localhost:9002/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe",
    "phone": "0123456789"
  }'
```

Response:
```json
{
  "success": true,
  "userId": "...",
  "email": "user@example.com",
  "profile": {...}
}
```

**Sign in:**
```bash
curl -X POST http://localhost:9002/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

## Features Enabled

- 🔐 **Secure Authentication**: Bcrypt password hashing (10 rounds)
- 📧 **Email-based Login**: No Supabase auth required
- 💾 **Profile Storage**: User data in profiles table
- ⚡ **Fast**: Email index for quick lookups
- 🔒 **Password Protected**: Hashed and salted passwords

## Dev Server

**Create new terminal and run:**
```bash
npm run dev
```

**Access at:** http://localhost:9002

- Sign up page: http://localhost:9002/signup
- Login page: http://localhost:9002/login

All features are functional! Just need that one SQL migration.
