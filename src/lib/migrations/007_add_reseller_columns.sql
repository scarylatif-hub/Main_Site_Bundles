-- Add reseller/store management columns to profiles table

-- Add reseller and store columns if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_reseller boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reseller_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS store_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS store_name text,
ADD COLUMN IF NOT EXISTS reseller_slug text UNIQUE,
ADD COLUMN IF NOT EXISTS profit_margin numeric(5, 2) DEFAULT 0.05,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_reseller_slug ON public.profiles(reseller_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_is_reseller ON public.profiles(is_reseller);
CREATE INDEX IF NOT EXISTS idx_profiles_reseller_approved ON public.profiles(reseller_approved);
