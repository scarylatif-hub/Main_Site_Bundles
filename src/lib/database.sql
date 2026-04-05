
-- ===============================================================================================
-- 1. TABLES
-- ===============================================================================================

-- Create profiles table to store public user data
-- This table is linked to the auth.users table
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text,
  phone_number text,
  wallet_balance numeric(10, 2) NOT NULL DEFAULT 0.00,
  is_admin boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT full_name_length CHECK (char_length(full_name) >= 3)
);

-- Create transactions table to log all user financial activities
DROP TABLE IF EXISTS public.transactions CASCADE;

CREATE TABLE public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
    reference text NOT NULL UNIQUE,
    transaction_code text UNIQUE,
    transaction_type text NOT NULL,
    recipient_msisdn text,
    network_id integer,
    shared_bundle integer,
    bundle_amount text,
    amount numeric(10, 2) NOT NULL,
    status text DEFAULT 'pending',
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ===============================================================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ===============================================================================================

-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_admin_all" ON public.transactions;

-- Policies for profiles table
-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policies for transactions table (see migrations/004_transactions_reference_rls.sql for upgrades)
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_admin_all"
  ON public.transactions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin IS TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin IS TRUE
    )
  );


-- ===============================================================================================
-- 3. DATABASE FUNCTIONS
-- ===============================================================================================

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.add_to_wallet_and_log_transaction(uuid, numeric, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.purchase_bundle_and_log_transaction(uuid, numeric, text, text, text, integer, integer, text, text) CASCADE;

-- Function to handle new user setup
-- This function is triggered when a new user signs up in the auth.users table
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone_number, wallet_balance, is_admin)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.email,
    new.raw_user_meta_data->>'phone_number',
    0.00,
    false
  );

  RETURN new;
END;
$$;


-- ===============================================================================================
-- 4. DATABASE TRIGGERS
-- ===============================================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;

-- Trigger to execute handle_new_user function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Manually update timestamp on profile changes (moddatetime not always available)
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);


-- ===============================================================================================
-- 5. STORED PROCEDURES (RPC)
-- ===============================================================================================

-- Function to securely add funds to a user's wallet and log the transaction
CREATE OR REPLACE FUNCTION public.add_to_wallet_and_log_transaction(
    p_user_id uuid,
    p_amount numeric,
    p_transaction_type text,
    p_status text,
    p_transaction_code text,
    p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Update the user's wallet balance
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    transaction_type,
    status,
    transaction_code,
    reference,
    description
  ) VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    p_status,
    p_transaction_code,
    p_transaction_code,
    p_description
  );
END;
$$;

-- Function to securely process a data bundle purchase
CREATE OR REPLACE FUNCTION public.purchase_bundle_and_log_transaction(
    p_user_id uuid,
    p_amount numeric,
    p_transaction_code text,
    p_status text,
    p_recipient_msisdn text,
    p_network_id integer,
    p_shared_bundle integer,
    p_bundle_amount text,
    p_description text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  -- Get current balance and lock the row for update
  SELECT wallet_balance INTO v_balance_before FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Check if the user has sufficient funds
  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Calculate new balance
  v_balance_after := v_balance_before - p_amount;

  -- Update user's wallet balance
  UPDATE public.profiles
  SET wallet_balance = v_balance_after,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO public.transactions (
    user_id,
    amount,
    transaction_type,
    status,
    transaction_code,
    reference,
    recipient_msisdn,
    network_id,
    shared_bundle,
    bundle_amount,
    description
  ) VALUES (
    p_user_id,
    -p_amount,
    'purchase',
    p_status,
    p_transaction_code,
    p_transaction_code,
    p_recipient_msisdn,
    p_network_id,
    p_shared_bundle,
    p_bundle_amount,
    p_description
  );

  RETURN v_balance_after;
END;
$$;


-- ===============================================================================================
-- 6. HELPER FUNCTION (if moddatetime doesn't exist)
-- ===============================================================================================

-- Create moddatetime function if it doesn't already exist
CREATE OR REPLACE FUNCTION moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================================================================
-- END OF SCRIPT - DATABASE READY
-- ===============================================================================================
