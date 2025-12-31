"use client";

import { createClient } from "@supabase/supabase-js";

// This file is the single source of truth for the client-side Supabase instance.
export const supabase = createClient(
  "https://ieqrdlbdqilzwibtyyqy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcXJkbGJkcWlsemVpYnR5eXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE5MDUzMDMsImV4cCI6MjAzNzQ4MTMwM30.7Q_uNMDcQ_W-B2pI-enirA-HtozYtWp7oYxPjWfD8-8"
);