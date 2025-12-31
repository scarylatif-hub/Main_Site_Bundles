"use client";

import { createBrowserClient } from "@supabase/ssr";

// This file is the single source of truth for the client-side Supabase instance.
// The values are hardcoded here to ensure the client can always connect,
// bypassing the persistent environment variable issues in this specific development setup.
export const supabase = createBrowserClient(
  "https://tbnqsmstmfpstfblcpfr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibnFzbXN0bWZwc3RmYmxjcGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE5MDU1NDgsImV4cCI6MjAzNzQ4MTU0OH0.Xb-iA3o-vfkq2ke2_rfp_sCUPw0C_3yN4xPZ7i0kFss"
);
