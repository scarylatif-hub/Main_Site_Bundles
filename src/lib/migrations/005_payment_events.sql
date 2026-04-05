-- =============================================================================
-- 005: Idempotent Paystack crediting via payment_events + atomic claim RPC
-- Run after 004 (transactions.reference) if you use reference on deposits.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  status text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_user_id_idx ON public.payment_events (user_id);
CREATE INDEX IF NOT EXISTS payment_events_processed_at_idx ON public.payment_events (processed_at DESC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.payment_events IS
  'One row per processed Paystack reference; UNIQUE(reference) prevents double credit.';

-- Optional simple helper (wallet only — prefer claim_paystack_deposit for deposits)
CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id uuid, p_amount numeric)
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
END;
$$;

-- Atomic: claim reference → credit wallet → log transactions row (rolls back together)
CREATE OR REPLACE FUNCTION public.claim_paystack_deposit(
  p_reference text,
  p_user_id uuid,
  p_credit_amount_ghs numeric,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deposits logged before payment_events existed: do not credit again; backfill event row
  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.transaction_code = p_reference
      AND t.transaction_type = 'deposit'
  ) THEN
    INSERT INTO public.payment_events (reference, status, amount, user_id)
    VALUES (p_reference, 'success', p_credit_amount_ghs, p_user_id)
    ON CONFLICT (reference) DO NOTHING;
    RETURN jsonb_build_object('credited', false, 'reason', 'already_processed');
  END IF;

  INSERT INTO public.payment_events (reference, status, amount, user_id)
  VALUES (p_reference, 'success', p_credit_amount_ghs, p_user_id);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_credit_amount_ghs,
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
    p_credit_amount_ghs,
    'deposit',
    'success',
    p_reference,
    p_reference,
    p_description
  );

  RETURN jsonb_build_object('credited', true, 'reason', 'ok');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_processed');
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_paystack_deposit(text, uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_paystack_deposit(text, uuid, numeric, text) TO service_role;
