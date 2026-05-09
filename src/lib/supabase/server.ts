import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function withPersistentCookieOptions(options: CookieOptions): CookieOptions {
  if (options.maxAge === 0) {
    return options;
  }
  return {
    ...options,
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    path: options.path ?? "/",
    sameSite: options.sameSite ?? "lax",
  };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withPersistentCookieOptions(options))
            );
          } catch {
            // Server Component or non-mutable context — middleware refreshes session.
          }
        },
      },
    }
  );
}
