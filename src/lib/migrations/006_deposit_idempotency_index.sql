-- =============================================================================
-- 006: Optional — one deposit row per Paystack reference (partial unique index)
-- Fails if you already have two deposit rows sharing the same transaction_code.
-- Many schemas already have UNIQUE(transaction_code) on all rows; then you can skip this.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS transactions_deposit_transaction_code_key
  ON public.transactions (transaction_code)
  WHERE transaction_type = 'deposit';
