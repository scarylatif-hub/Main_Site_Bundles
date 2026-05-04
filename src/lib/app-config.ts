/**
 * App configuration for dual deployment mode
 * 
 * APP_MODE determines which features are exposed:
 * - "main": Full website (bundle-ghana.vercel.app)
 * - "store": Store-only frontend (storebundles.vercel.app)
 */

export const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || "main";

export const isMainApp = APP_MODE === "main";
export const isStoreApp = APP_MODE === "store";

// Store domain configuration
export const STORE_DOMAIN = process.env.NEXT_PUBLIC_STORE_DOMAIN || "storebundles.vercel.app";

// Generate store URL based on app mode
export function getStoreUrl(resellerSlug: string): string {
  if (isMainApp) {
    // Main app uses relative path or same domain
    return `/store/${resellerSlug}`;
  } else {
    // Store app uses custom domain
    return `https://${STORE_DOMAIN}/${resellerSlug}`;
  }
}

// Check if current path should be accessible in current app mode
export function isPathAccessible(path: string): boolean {
  // Paths that should always be accessible
  const publicPaths = ["/", "/store/[slug]"];
  
  // Paths that should only be accessible in main app
  const mainOnlyPaths = [
    "/dashboard",
    "/admin", 
    "/myadminportal",
    "/reseller",
    "/checkout",
    "/api/admin",
    "/api/reseller",
    "/api/paystack",
  ];
  
  // Normalize path for comparison
  const normalizedPath = path.split("?")[0]; // Remove query params
  
  // Check if it's a public path
  if (publicPaths.some(p => normalizedPath.startsWith(p.replace("[slug]", "")))) {
    return true;
  }
  
  // Check if it's main-only path
  if (mainOnlyPaths.some(p => normalizedPath.startsWith(p))) {
    return isMainApp;
  }
  
  // Default: allow in main app, deny in store app
  return isMainApp;
}
