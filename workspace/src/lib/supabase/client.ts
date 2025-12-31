"use client";

import { createClient } from "@supabase/supabase-js";

// This file is the single source of truth for the client-side Supabase instance.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
