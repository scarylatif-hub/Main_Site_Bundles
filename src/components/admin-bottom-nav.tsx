"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListOrdered,
  Users,
  Bell,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/myadminportal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/myadminportal/orders", label: "All orders", icon: ListOrdered },
  { href: "/myadminportal/users", label: "Users", icon: Users },
  { href: "/myadminportal/notifications", label: "Notifications", icon: Bell },
  { href: "/", label: "← Storefront", icon: Store },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminBottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
      aria-label="Admin navigation"
    >
      <div className="mx-auto flex h-16 max-w-4xl items-stretch justify-around gap-0 px-1 font-medium sm:px-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] transition-colors sm:gap-1 sm:text-xs",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
              <span className="max-w-full truncate text-center leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
