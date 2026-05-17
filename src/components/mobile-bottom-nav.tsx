"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Package, Wallet, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { Badge } from "./ui/badge";
import { useAuth } from "@/context/auth-context";

const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/cart", label: "Cart", icon: ShoppingBag },
    { href: "/store", label: "Store", icon: Store },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/wallet", label: "Wallet", icon: Wallet },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const { itemCount } = useCart();
    const { userProfile } = useAuth();
    const storeLink = userProfile?.is_reseller ? "/reseller/dashboard" : "/profile?createStore=1";

    return (
        <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t border-border/40 md:hidden">
            <div className="grid h-full max-w-lg grid-cols-5 mx-auto font-medium">
                {navLinks.map((link) => {
                    const href = link.href === "/store" ? storeLink : link.href;
                    const isActive =
                        pathname === href ||
                        (link.href === "/store" && pathname?.startsWith("/reseller"));

                    return (
                        <Link
                            key={link.href}
                            href={href}
                            className={cn(
                                "inline-flex flex-col items-center justify-center px-5 hover:bg-muted/50 transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <div className="relative">
                                <link.icon className="w-6 h-6 mb-1" />
                                {link.href === "/cart" && itemCount > 0 && (
                                    <Badge variant="destructive" className="absolute -top-2 -right-3 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
                                        {itemCount}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-xs">{link.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
