"use client";

import { createBrowserClient } from "@supabase/ssr";

// This is not best practice, but is a temporary workaround to ensure the client
// can connect to Supabase in this development environment.
// The credentials should be moved to environment variables in a production setup.
export const supabase = createBrowserClient(
  "https://tbnqsmstmfpstfblcpfr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibnFzbXN0bWZwc3RmYmxjcGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE5MDU1NDgsImV4cCI6MjAzNzQ4MTU0OH0.Xb-iA3o-vfkq2ke2_rfp_sCUPw0C_3yN4xPZ7i0kFss",
);