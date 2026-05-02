"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { AdminBottomNav } from "@/components/admin-bottom-nav";

/**
 * Consumer chrome (header, footer, bottom nav) is hidden on `/myadminportal/*`.
 * Admins get a dedicated bottom nav (Dashboard, orders, users, notifications, storefront).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/myadminportal") ?? false;
  const isStoreRoute = pathname?.startsWith("/store/") ?? false;

  if (isAdminRoute) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <main className="flex-1 pb-20">{children}</main>
        <AdminBottomNav />
      </div>
    );
  }

  if (isStoreRoute) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
