"use client";

import { createClient } from "@supabase/supabase-js";

// This file is the single source of truth for the client-side Supabase instance.
export const supabase = createClient(
  "https://ieqrdlbdqilzwibtyyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcXJkbGJkcWlsendpYnR5eXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MzIwMTUsImV4cCI6MjA4MjMwODAxNX0.vKWlA8t4-vllguDrd7AN7ipYDFGile025bnZ4HSSer8"
);
