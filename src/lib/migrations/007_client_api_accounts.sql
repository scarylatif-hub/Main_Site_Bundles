-- 007_client_api_accounts.sql
-- Client API account, balance, and transaction system for bundled API sales.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_balances (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'purchase')),
  reference TEXT,
  bundle_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS balance_transactions_client_created_idx
  ON public.balance_transactions (client_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.credit_client_balance(
  p_client_id UUID,
  p_amount NUMERIC(12,2),
  p_reference TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'deposit'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO public.api_balances (client_id, balance, created_at, updated_at)
  VALUES (p_client_id, 0.00, NOW(), NOW())
  ON CONFLICT (client_id) DO NOTHING;

  UPDATE public.api_balances
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE client_id = p_client_id;

  SELECT balance INTO v_balance
  FROM public.api_balances
  WHERE client_id = p_client_id;

  INSERT INTO public.balance_transactions (client_id, amount, type, reference, created_at)
  VALUES (p_client_id, p_amount, p_type, p_reference, NOW());

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(v_balance, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_client_balance(
  p_client_id UUID,
  p_amount NUMERIC(12,2),
  p_bundle_id TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;

  SELECT balance INTO v_balance
  FROM public.api_balances
  WHERE client_id = p_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client balance record not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Insufficient balance',
      'balance', v_balance,
      'required', p_amount
    );
  END IF;

  UPDATE public.api_balances
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE client_id = p_client_id;

  INSERT INTO public.balance_transactions (client_id, amount, type, bundle_id, reference, created_at)
  VALUES (p_client_id, -p_amount, 'purchase', p_bundle_id, p_reference, NOW());

  SELECT balance INTO v_balance
  FROM public.api_balances
  WHERE client_id = p_client_id;

  RETURN jsonb_build_object('ok', true, 'balance', COALESCE(v_balance, 0));
END;
$$;
