-- Run in Supabase SQL editor if RPC / inserts fail with:
--   column "shared_bundle" of relation "transactions" does not exist
-- Aligns live DB with app expectations (see database.sql).

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS shared_bundle integer;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS network_id integer;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bundle_amount text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recipient_msisdn text;

-- After running: in Supabase → Settings → API → restart project, or run
-- NOTIFY pgrst, 'reload schema';  (if your role allows) so PostgREST picks up new columns.
