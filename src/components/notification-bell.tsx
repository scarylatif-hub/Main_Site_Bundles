"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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

const BROADCAST_STORAGE_KEY = "broadcast-notification-last-shown-id";

function formatNotificationMessage(message: string) {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  const normalized = message.replace(/\r\n/g, "\n");
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(normalized))) {
    const url = match[0];
    const href = url.startsWith("www.") ? `https://${url}` : url;

    if (match.index > lastIndex) {
      parts.push(normalized.slice(lastIndex, match.index));
    }

    parts.push(
      <a
        key={`${url}-${match.index}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline"
      >
        {url}
      </a>
    );

    lastIndex = match.index + url.length;
  }

  if (lastIndex < normalized.length) {
    parts.push(normalized.slice(lastIndex));
  }

  return parts.length > 0 ? parts : message;
}

export function NotificationBell() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [popupShown, setPopupShown] = useState(false);
  const { toast } = useToast();

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

  useEffect(() => {
    if (popupShown || items.length === 0) return;

    const latest = items[0];
    if (!latest?.id) return;

    const lastShownId = typeof window !== "undefined"
      ? window.localStorage.getItem(BROADCAST_STORAGE_KEY)
      : null;

    if (latest.id === lastShownId) {
      setPopupShown(true);
      return;
    }

    toast({
      title: latest.title,
      description: (
        <div className="whitespace-pre-wrap break-words">
          {formatNotificationMessage(latest.message)}
        </div>
      ),
      variant: "default",
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BROADCAST_STORAGE_KEY, latest.id);
    }

    setPopupShown(true);
  }, [items, popupShown, toast]);

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
