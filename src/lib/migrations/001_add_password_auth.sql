-- Add password_hash column to profiles for local authentication
ALTER TABLE public.profiles
ADD COLUMN password_hash TEXT;

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
