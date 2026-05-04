import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isStoreApp, isPathAccessible } from "@/lib/app-config";

export function middleware(req: NextRequest) {
  // Only apply restrictions in store app mode
  if (!isStoreApp) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  
  // Block root path in store mode - only allow /store/[slug]
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/store", req.url));
  }
  
  // Check if current path is accessible in store mode
  if (!isPathAccessible(pathname)) {
    // Redirect to store page for store app
    return NextResponse.redirect(new URL("/store", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
