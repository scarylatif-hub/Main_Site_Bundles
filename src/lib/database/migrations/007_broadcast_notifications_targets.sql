-- Adds recipient targeting metadata to broadcast notifications.
-- Safe to run multiple times.

ALTER TABLE public.broadcast_notifications
  ADD COLUMN IF NOT EXISTS recipients_mode text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broadcast_notifications_recipients_mode_check'
  ) THEN
    ALTER TABLE public.broadcast_notifications
      ADD CONSTRAINT broadcast_notifications_recipients_mode_check
      CHECK (recipients_mode IN ('all', 'single', 'custom'));
  END IF;
END $$;

UPDATE public.broadcast_notifications
SET recipients_mode = 'all'
WHERE recipients_mode IS NULL;

UPDATE public.broadcast_notifications
SET recipient_count = 0
WHERE recipient_count IS NULL OR recipient_count < 0;
