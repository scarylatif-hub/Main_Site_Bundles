-- =============================================================================
-- 004: Canonical `reference`, stricter RLS, wallet RPC writes `reference`
-- Run in Supabase SQL Editor (project may already have partial policies).
-- =============================================================================

-- 1) Column: shared key between your app and the provider (and Paystack, etc.)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reference text;

-- Backfill: use existing code, or stable id-based value (must be unique)
UPDATE public.transactions
SET reference = COALESCE(
  NULLIF(trim(transaction_code), ''),
  'migrated-' || id::text
)
WHERE reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_unique
  ON public.transactions (reference);

ALTER TABLE public.transactions
  ALTER COLUMN reference SET NOT NULL;

-- 2) Deposits / wallet RPC: keep transaction_code and reference in sync
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

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

-- Optional: purchase RPC also sets reference (if you still call it elsewhere)
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
BEGIN
  SELECT wallet_balance INTO v_balance_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  v_balance_after := v_balance_before - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_balance_after,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

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

-- 3) RLS: users read/insert own rows only; no user updates/deletes.
--    Service role bypasses RLS. Authenticated admins (profiles.is_admin) get full access.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
DROP POLICY IF EXISTS "transactions_admin_all" ON public.transactions;

CREATE POLICY "transactions_select_own"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON public.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins using the anon key + their JWT (not service role) can manage all rows
CREATE POLICY "transactions_admin_all"
  ON public.transactions
  FOR ALL
  TO authenticated
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

-- Reload PostgREST schema cache if needed:
-- NOTIFY pgrst, 'reload config';
