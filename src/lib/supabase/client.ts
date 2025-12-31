"use client";

import { createBrowserClient } from "@supabase/ssr";

// This file is the single source of truth for the client-side Supabase instance.
// The values are loaded from environment variables.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
