-- Profit Records Table for Store Order Tracking
-- This table tracks detailed profit breakdown for each store order

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profit_records_store_id ON public.profit_records USING btree (store_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_profit_records_created_at ON public.profit_records USING btree (created_at) TABLESPACE pg_default;

-- What this table means:
-- 1. order_id: Links to the original order in the orders table
-- 2. store_id: Links to the store owner (profiles table)
-- 3. actual_cost: Cost to platform (DataKazina API price + admin margin)
-- 4. selling_price: Price charged to customer
-- 5. reseller_profit: Profit earned by store owner
-- 6. platform_profit: Profit earned by platform/admin
-- 7. profit_margin: Percentage profit margin for this order
-- 8. created_at/updated_at: Timestamps for tracking

-- This provides detailed financial tracking for:
-- - Store owner earnings analysis
-- - Platform revenue tracking  
-- - Profit margin analysis per order
-- - Historical profit data for reporting
-- - Audit trail for all transactions
