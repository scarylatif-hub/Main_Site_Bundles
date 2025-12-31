
"use client";

import { createClient } from "@supabase/supabase-js";

// This file is the single source of truth for the client-side Supabase instance.
export const supabase = createClient(
  "https://ieqrdlbdqilzwibtyyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcXJkbGJkcWlsendpYnR5eXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE3NDg3NTYsImV4cCI6MjAzNzMyNDc1Nn0.V_g6O5i5j_G-gH4a-qf2X-qUayKy3iN0GvW-iYwX-p0"
);
