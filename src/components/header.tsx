"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { CartIcon } from "@/components/cart-icon";
import { Button } from "@/components/ui/button";
import { LogOut, User, Wallet } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AuthComponents } from "./auth-components";
import { isAdminEmail } from "@/lib/admin-config";

const navLinks = [
  { href: "/", label: "Buy Data" },
  { href: "/orders", label: "My Orders" },
  { href: "/wallet", label: "Wallet" },
];

function UserNav() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign Up</Link>
        </Button>
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || "User";
  const userInitials =
    displayName
      ?.split(" ")
      .map((n: string) => n[0])
      .join("") || user.email?.[0].toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.user_metadata.avatar_url || ""} alt={displayName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdminEmail(user.email) && (
          <DropdownMenuItem asChild>
            <Link href="/myadminportal/dashboard">
              <User className="mr-2 h-4 w-4" />
              <span>Admin</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wallet">
            <Wallet className="mr-2 h-4 w-4" />
            <span>Wallet</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WalletBalance() {
    const { user, userProfile } = useAuth();
    
    if (!user) return null;

    return (
         <Button variant="ghost" className="p-0 h-auto" asChild>
            <Link href="/wallet" className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-sm">
                    GHS {userProfile?.wallet_balance?.toFixed(2) ?? '0.00'}
                </span>
            </Link>
        </Button>
    )
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-6xl items-center">
        <div className="mr-auto md:mr-4 hidden md:flex">
          <Logo />
        </div>

        <div className="flex flex-1 items-center justify-between md:justify-end gap-2 min-w-0">
          <div className="md:hidden shrink-0 min-w-0">
            <Logo />
          </div>
          {/* Mobile: no top nav links — use bottom nav + profile menu */}
          <nav className="hidden md:flex items-center gap-6 text-sm mr-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4 ml-auto md:ml-0 flex-none shrink-0">
            <AuthComponents>
              <NotificationBell />
              <WalletBalance />
              <CartIcon />
            </AuthComponents>
            <UserNav />
          </div>
        </div>
      </div>
    </header>
  );
}
