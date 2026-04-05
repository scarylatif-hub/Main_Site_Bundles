"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type Broadcast = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Broadcast[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications", { credentials: "include" });
        const j = await res.json();
        if (!cancelled && Array.isArray(j.items)) setItems(j.items);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          {items.length > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[min(70vh,420px)] overflow-y-auto">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 whitespace-normal">
              <span className="font-semibold text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground leading-snug">
                {n.message}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(n.created_at), "MMM d, yyyy h:mm a")}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
