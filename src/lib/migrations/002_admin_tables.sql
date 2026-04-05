-- Run in Supabase SQL editor (once).

CREATE TABLE IF NOT EXISTS public.provider_order_overrides (
  transaction_id text PRIMARY KEY,
  status text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.provider_order_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; app uses service role for admin writes.
-- Authenticated users can read broadcasts:
CREATE POLICY "read_broadcasts"
  ON public.broadcast_notifications FOR SELECT
  TO authenticated
  USING (true);
