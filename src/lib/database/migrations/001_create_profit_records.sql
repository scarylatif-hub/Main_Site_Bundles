-- Migration: Create profit_records table for detailed store profit tracking
-- This table provides granular profit breakdown for each store order

CREATE TABLE IF NOT EXISTS public.profit_records (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  store_id UUID NOT NULL,
  actual_cost NUMERIC NOT NULL,
  selling_price NUMERIC NOT NULL,
  reseller_profit NUMERIC NOT NULL,
  platform_profit NUMERIC NOT NULL,
  profit_margin NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  
  CONSTRAINT profit_records_pkey PRIMARY KEY (id),
  CONSTRAINT profit_records_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT profit_records_store_id_fkey FOREIGN KEY (store_id) REFERENCES profiles (id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_profit_records_store_id ON public.profit_records USING btree (store_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_profit_records_created_at ON public.profit_records USING btree (created_at) TABLESPACE pg_default;
