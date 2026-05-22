-- Migration 008: Add dakazina_order_id field to orders and transactions tables
-- This allows webhook processing to match orders/transactions by Dakazina's order code (ORDER-XXXXXX)

-- Add dakazina_order_id column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS dakazina_order_id text UNIQUE;

-- Add index for faster lookups by dakazina_order_id
CREATE INDEX IF NOT EXISTS idx_orders_dakazina_order_id ON public.orders(dakazina_order_id);

-- Add dakazina_order_id column to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS dakazina_order_id text UNIQUE;

-- Add index for faster lookups by dakazina_order_id
CREATE INDEX IF NOT EXISTS idx_transactions_dakazina_order_id ON public.transactions(dakazina_order_id);

-- Comment explaining the columns
COMMENT ON COLUMN public.orders.dakazina_order_id IS 'Dakazina provider order code (format: ORDER-XXXXXX) used for webhook matching';
COMMENT ON COLUMN public.transactions.dakazina_order_id IS 'Dakazina provider order code (format: ORDER-XXXXXX) used for webhook matching';
