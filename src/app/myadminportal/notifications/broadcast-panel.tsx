"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

export function BroadcastPanel({ initialItems }: { initialItems: BroadcastRow[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState<BroadcastRow[]>(initialItems);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) {
      toast({
        title: "Missing fields",
        description: "Enter a title and message.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t, message: m }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Send failed");
      if (j.item) setItems((prev) => [j.item as BroadcastRow, ...prev]);
      setTitle("");
      setMessage("");
      toast({ title: "Sent", description: "Users will see this in their notification dropdown." });
    } catch (e) {
      toast({
        title: "Could not send",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Push notifications and (optional) SMS planning. In-app delivery uses the header bell
          dropdown for all signed-in users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMS broadcast</CardTitle>
          <CardDescription>
            Outbound SMS is not connected in this codebase yet. Use your SMS provider or
            carrier tools for mass SMS; push notifications below reach users in the app.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push notifications</CardTitle>
          <CardDescription>
            Broadcast a message to all active users. It will appear in their notification dropdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="bc-title">Title</Label>
            <Input
              id="bc-title"
              placeholder="e.g., System Maintenance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-message">Message</Label>
            <Textarea
              id="bc-message"
              placeholder="e.g., We will be undergoing scheduled maintenance..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send push notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent push notifications</CardTitle>
          <CardDescription>
            A history of all push notifications you have sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No notifications sent. Use the form to send your first notification.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="border-b pb-4 last:border-0 space-y-1 text-sm"
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{n.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(n.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
