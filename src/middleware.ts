import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin-config";

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

/** Pages that should redirect AWAY if user is logged in */
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

/** Public pages that are always accessible */
function isPublicPath(pathname: string) {
  return (
    pathname === "/store" ||
    pathname.startsWith("/store/")
  );
}

/** Auth-only pages (login/signup/etc) */
function isAuthPath(pathname: string) {
  if (AUTH_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/") ||
    pathname.startsWith("/forgot-password/")
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              withPersistentCookieOptions(options)
            ),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. API routes — always pass through
  if (pathname.startsWith("/api")) {
    return supabaseResponse;
  }

  // 2. Auth pages — redirect logged-in users to home
  if (isAuthPath(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  // 3. Public pages (like /store) — ALWAYS accessible
  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  // 4. No session — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // 5. Admin routes
  if (pathname.startsWith("/myadminportal")) {
    if (!isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 6. ყველაფერი okay — continue
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};