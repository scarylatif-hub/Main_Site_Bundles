"use client";

import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  recipients_mode: "single" | "all" | "custom";
  recipient_count: number;
  created_at: string;
};

type SmsResult = {
  ok: boolean;
  code: string;
  message: string;
  recipient_count?: number;
};

type RecipientMode = "all" | "single" | "custom";

// ─────────────────────────────────────────────────────────────────────────────
// Phone normalisation  (client-side, mirrors what the route does)
//
// Arkesel V2 wants numbers in international format WITHOUT the "+".
// Ghana:  0XXXXXXXXX  (10 digits) → 233XXXXXXXXX
//         233XXXXXXXXX (12 digits) → kept as-is
// Other:  any ≥10 digit string    → kept as-is (trust the user)
// ─────────────────────────────────────────────────────────────────────────────

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return "233" + digits.slice(1);
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.length >= 10) return digits;
  return null;
}

/**
 * Parse a freeform blob of phone numbers.
 * Accepts ANY separator — spaces, commas, newlines, semicolons, tabs.
 * Deduplicates silently.
 */
function parsePhonePaste(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw.split(/[\s,;\n\t]+/).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const n = normalisePhone(token);
    if (n && !seen.has(n)) {
      valid.push(n);
      seen.add(n);
    } else if (!n) {
      invalid.push(token);
    }
    // duplicates: silently dropped
  }
  return { valid, invalid };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BroadcastPanel({ initialItems }: { initialItems: BroadcastRow[] }) {
  const { toast } = useToast();

  // ── state ──
  const [items, setItems]     = useState<BroadcastRow[]>(initialItems);
  const [title, setTitle]     = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSms, setLastSms] = useState<SmsResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // recipient mode
  const [mode, setMode] = useState<RecipientMode>("all");

  // "single" mode — plain phone input
  // ▶ TODO: replace the <Input> below with your own <CustomerCombobox> or
  //   customer-search component. All you need is to call setSinglePhone(phone)
  //   when a customer is picked.
  const [singlePhone, setSinglePhone] = useState("");
  const singleNormalised = useMemo(() => normalisePhone(singlePhone), [singlePhone]);

  // "custom" mode — freeform paste
  const [bulkRaw, setBulkRaw] = useState("");
  const bulkParsed = useMemo(() => parsePhonePaste(bulkRaw), [bulkRaw]);

  // ── derived recipient preview badge ──
  const recipientPreview = useMemo(() => {
    if (mode === "all") return "All subscribed customers";
    if (mode === "single") {
      if (!singlePhone) return "Enter a phone number";
      return singleNormalised
        ? `1 recipient → ${singleNormalised}`
        : "⚠ Invalid number";
    }
    // custom
    const { valid, invalid } = bulkParsed;
    if (!bulkRaw.trim()) return "Paste numbers below";
    return [
      `${valid.length} valid`,
      invalid.length ? `${invalid.length} invalid (skipped)` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [mode, singlePhone, singleNormalised, bulkRaw, bulkParsed]);

  // ── gate: is the form ready to submit? ──
  const canSend =
    !sending &&
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (mode !== "single" || !!singleNormalised) &&
    (mode !== "custom" || bulkParsed.valid.length > 0);

  // ── send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const t = title.trim();
    const m = message.trim();

    // Build the recipients list to ship to the route.
    // null  → route calls getAllSubscribedPhones() (your DB) for "all" mode
    // array → route uses this list directly
    let recipients: string[] | null = null;

    if (mode === "single") recipients = [singleNormalised!];
    if (mode === "custom") recipients = bulkParsed.valid;

    setSending(true);
    setLastSms(null);

    try {
      const res = await fetch("/api/admin/broadcast-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t, message: m, recipients, mode }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Send failed");

      if (j.item) setItems((prev) => [j.item as BroadcastRow, ...prev]);
      if (j.sms)  setLastSms(j.sms as SmsResult);

      // reset
      setTitle("");
      setMessage("");
      setSinglePhone("");
      setBulkRaw("");

      const smsNote =
        j.sms?.code === "skipped"
          ? " (SMS skipped — ARKESEL_SMS_API_KEY not set)"
          : j.sms?.ok
          ? ` SMS sent to ${j.sms.recipient_count ?? "?"} recipient(s).`
          : ` SMS error: ${j.sms?.message ?? "unknown error"}`;

      toast({
        title: "Notification sent",
        description: smsNote,
        variant: j.sms?.ok === false ? "destructive" : "default",
      });
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

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/admin/broadcast-notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      setItems((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Deleted", description: "Notification removed" });
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  function startEdit(item: BroadcastRow) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditMessage(item.message);
    setLastSms(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/admin/broadcast-notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: editingId, title: editTitle, message: editMessage }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Update failed");
      if (j.item) {
        setItems((prev) => prev.map((it) => (it.id === editingId ? (j.item as BroadcastRow) : it)));
      }
      setEditingId(null);
      toast({ title: "Updated", description: "Notification updated" });
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Send in-app push and SMS notifications — to one customer, all customers, or a
          custom list. SMS delivered via Arkesel V2.
        </p>
      </div>

      {/* ── compose card ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Send notification</CardTitle>
          <CardDescription>
            Choose your audience, write your message, and hit send.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 max-w-2xl">

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="bc-title">Title</Label>
            <Input
              id="bc-title"
              placeholder="e.g., New bundle available"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="bc-message">Message</Label>
            <Textarea
              id="bc-message"
              placeholder="e.g., Get 10 GB for GHS 15 — limited time only."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/459 chars · capped at 3 SMS pages on send
            </p>
          </div>

          {/* Recipient mode */}
          <div className="space-y-2">
            <Label>Send to</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as RecipientMode);
                setSinglePhone("");
                setBulkRaw("");
                setLastSms(null);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="single">One customer</SelectItem>
                <SelectItem value="custom">Custom list</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── single customer ─────────────────────────────────────────── */}
          {mode === "single" && (
            <div className="space-y-2">
              <Label htmlFor="bc-single">Customer phone number</Label>
              {/*
               * ▶ TODO: swap this <Input> with your own customer search/combobox.
               *   E.g.  <CustomerCombobox onSelect={(c) => setSinglePhone(c.phone)} />
               *   The only contract: call setSinglePhone(phoneString) on selection.
               */}
              <Input
                id="bc-single"
                placeholder="0595919802  or  233595919802"
                value={singlePhone}
                onChange={(e) => setSinglePhone(e.target.value)}
              />

              {/* validation hint */}
              {singlePhone && !singleNormalised && (
                <p className="text-xs text-destructive">
                  Can't normalise this number. Use 0XXXXXXXXX (10 digits) or
                  233XXXXXXXXX (12 digits).
                </p>
              )}
              {singleNormalised && (
                <p className="text-xs text-muted-foreground">
                  Will send to:{" "}
                  <span className="font-mono font-medium">{singleNormalised}</span>
                </p>
              )}
            </div>
          )}

          {/* ── custom bulk list ─────────────────────────────────────────── */}
          {mode === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="bc-bulk">Phone numbers</Label>
              <Textarea
                id="bc-bulk"
                placeholder={
                  "Paste in any format — spaces, commas, newlines all work:\n" +
                  "0595919802 2335858838\n0203388298, 233383927748\n..."
                }
                rows={6}
                value={bulkRaw}
                onChange={(e) => setBulkRaw(e.target.value)}
                className="font-mono text-sm"
              />

              {/* live parse feedback */}
              {bulkRaw.trim() && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
                  <p>
                    <span className="font-medium text-foreground">
                      {bulkParsed.valid.length}
                    </span>{" "}
                    valid number{bulkParsed.valid.length !== 1 ? "s" : ""}

                    {bulkParsed.invalid.length > 0 && (
                      <span className="text-destructive ml-2">
                        · {bulkParsed.invalid.length} invalid (will be skipped):{" "}
                        <span className="font-mono">
                          {bulkParsed.invalid.join(", ")}
                        </span>
                      </span>
                    )}
                  </p>

                  {/* normalised preview (first 5) */}
                  {bulkParsed.valid.length > 0 && (
                    <p className="font-mono text-muted-foreground">
                      {bulkParsed.valid.slice(0, 5).join(", ")}
                      {bulkParsed.valid.length > 5 &&
                        ` … +${bulkParsed.valid.length - 5} more`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* recipient summary pill */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Recipients:</span>
            <Badge variant="secondary">{recipientPreview}</Badge>
          </div>

          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? "Sending…" : "Send notification"}
          </Button>

          {/* SMS delivery result */}
          {lastSms && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">SMS result:</span>
              <Badge variant={lastSms.ok ? "default" : "destructive"}>
                {lastSms.code.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">{lastSms.message}</span>
              {lastSms.recipient_count != null && (
                <span className="text-sm text-muted-foreground">
                  · {lastSms.recipient_count} sent
                </span>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── history card ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Sent notifications</CardTitle>
          <CardDescription>History of all notifications sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No notifications sent yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="border-b pb-4 last:border-0 space-y-1 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{n.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {n.recipients_mode === "all"
                          ? "All customers"
                          : n.recipients_mode === "single"
                          ? "1 customer"
                          : `${n.recipient_count} recipients`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId === n.id ? (
                        <>
                          <Button size="sm" onClick={() => saveEdit()}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(n)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(n.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === n.id ? (
                    <div className="space-y-2 pt-2">
                      <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={3} />
                    </div>
                  ) : (
                    <>
                      <p className="text-muted-foreground whitespace-pre-wrap">{n.message}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), "MMM d, yyyy h:mm a")}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(v) => { if (!v) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notification</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected notification. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDeleteId) { handleDelete(pendingDeleteId); setPendingDeleteId(null); } }}>
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}