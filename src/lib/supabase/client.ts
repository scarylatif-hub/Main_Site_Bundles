"use client";

import { createClient } from "@supabase/supabase-js";

// This file is the single source of truth for the client-side Supabase instance.
export const supabase = createClient(
  "https://rqqvttdajsczwhjvrzve.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcXZ0dGRhanNjenFoanZyenZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE0ODE5NTAsImV4cCI6MjAzNzA1Nzk1MH0.3BHtW2E0y1j59-t5-dMtxKqgvyDAtinZlF9oH52c8Fw"
);
