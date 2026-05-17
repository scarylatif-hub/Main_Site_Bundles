import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin-config";
import { isMainSiteOnlyPath, isStoreDeployment } from "@/lib/app-config";

const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

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

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

function isPublicPath(pathname: string) {
  return pathname === "/store" || pathname.startsWith("/store/");
}

function isAuthPath(pathname: string) {
  if (AUTH_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith("/login/") ||
    pathname.startsWith("/signup/") ||
    pathname.startsWith("/forgot-password/") ||
    pathname.startsWith("/reset-password/")
  );
}

function safeNextPath(request: NextRequest): string {
  const raw = request.nextUrl.searchParams.get("next");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? request.nextUrl.hostname;

  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              withPersistentCookieOptions(options)
            )
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const storeDeployment = isStoreDeployment(host);

  if (storeDeployment && isMainSiteOnlyPath(pathname)) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/store";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthPath(pathname)) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = safeNextPath(request);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/myadminportal") && !isAdminEmail(user.email)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
