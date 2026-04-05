import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminContext =
  | { ok: true; admin: SupabaseClient; actorId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    admin: createAdminClient(),
    actorId: user!.id,
  };
}
