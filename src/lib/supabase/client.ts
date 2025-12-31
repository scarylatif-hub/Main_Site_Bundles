"use client";

import { createBrowserClient } from "@supabase/ssr";

// This file is the single source of truth for the client-side Supabase instance.
// The values are hardcoded to ensure connectivity in the development environment.
export const supabase = createBrowserClient(
  "https://rqqvttdajsczwhjvrzve.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcXZ0dGRhanNjd3doanZyennZSIsImlhdCI6MTcyMjIzODgyNiwiZXhwIjoyMDM3ODE0ODI2fQ.O2Zq7sQpNHM32PAv1f_M2C_dJ2sYg3vL56e_c3aE2M4"
);
