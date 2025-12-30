"use client";

import { createBrowserClient } from "@supabase/ssr";

// This file is now being bypassed by direct initialization in login/signup pages
// to troubleshoot a persistent fetch error.
export const supabase = createBrowserClient(
  "https://tbnqsmstmfpstfblcpfr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibnFzbXN0bWZwc3RmYmxjcGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE5MDU1NDgsImV4cCI6MjAzNzQ4MTU0OH0.Xb-iA3o-vfkq2ke2_rfp_sCUPw0C_3yN4xPZ7i0kFss",
);
