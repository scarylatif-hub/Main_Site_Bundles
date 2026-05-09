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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Phone normalisation helpers ──────────────────────────────────────────────

/**
 * Normalise a single phone token to the Arkesel E.164-ish format (no +).
 *
 * Ghana rules (extend for other countries as needed):
 *  - 0XXXXXXXXX  (10 digits)  → 233XXXXXXXXX
 *  - 233XXXXXXXXX (12 digits) → kept as-is
 *  - Any other string with ≥10 digits → kept as-is (other country codes)
 *  - Anything shorter / unrecognisable → null (invalid)
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0") && digits.length === 10) return "233" + digits.slice(1);
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.length >= 10) return digits; // other international numbers

  return null;
}

/**
 * Parse a freeform paste of phone numbers.
 * Accepts any separator: spaces, commas, newlines, semicolons, tabs.
 * Deduplicates automatically.
 * Returns { valid: string[], invalid: string[] }
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
    // duplicates silently dropped
  }
  return { valid, invalid };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BroadcastPanel({ initialItems }: { initialItems: BroadcastRow[] }) {
  const { toast } = useToast();

  const [items, setItems] = useState<BroadcastRow[]>(initialItems);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSms, setLastSms] = useState<SmsResult | null>(null);

  // Recipient mode
  const [mode, setMode] = useState<RecipientMode>("all");

  // Single customer phone
  // TODO: swap this plain <Input> for your own <CustomerCombobox> / customer-search
  // component. When a customer is selected, call setSinglePhone(customer.phone).
  const [singlePhone, setSinglePhone] = useState("");
  const singleNormalised = useMemo(() => normalisePhone(singlePhone), [singlePhone]);

  // Bulk/custom paste
  const [bulkRaw, setBulkRaw] = useState("");
  const bulkParsed = useMemo(() => parsePhonePaste(bulkRaw), [bulkRaw]);

  // Recipient summary shown in a badge
  const recipientPreview = useMemo(() => {
    if (mode === "all") return "All subscribed customers";
    if (mode === "single") {
      if (!singlePhone) return "Enter a phone number";
      return singleNormalised ? `1 recipient → ${singleNormalised}` : "⚠ Invalid number";
    }
    const { valid, invalid } = bulkParsed;
    if (!bulkRaw.trim()) return "Paste numbers below";
    return [
      `${valid.length} valid`,
      invalid.length ? `${invalid.length} invalid (skipped)` : null,
    ].filter(Boolean).join(" · ");
  }, [mode, singlePhone, singleNormalised, bulkRaw, bulkParsed]);

  // ── Send handler ──────────────────────────────────────────────────────────
  async function send() {
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) {
      toast({ title: "Missing fields", description: "Enter a title and message.", variant: "destructive" });
      return;
    }

    // Build explicit recipients list; null means "fetch all from DB on the server"
    let recipients: string[] | null = null;

    if (mode === "single") {
      if (!singleNormalised) {
        toast({ title: "Invalid phone", description: "Enter a valid phone number.", variant: "destructive" });
        return;
      }
      recipients = [singleNormalised];
    }

    if (mode === "custom") {
      if (bulkParsed.valid.length === 0) {
        toast({ title: "No valid numbers", description: "Check the numbers in the custom field.", variant: "destructive" });
        return;
      }
      recipients = bulkParsed.valid;
    }

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
      if (!res.ok) throw new Error(j.error || "Send failed");

      if (j.item) setItems((prev) => [j.item as BroadcastRow, ...prev]);
      if (j.sms) setLastSms(j.sms as SmsResult);

      // Reset form
      setTitle("");
      setMessage("");
      setSinglePhone("");
      setBulkRaw("");

      const smsNote =
        j.sms?.code === "skipped"
          ? " (SMS skipped — API key not set)"
          : j.sms?.ok
          ? ` SMS sent to ${j.sms.recipient_count ?? "?"} recipient(s).`
          : ` SMS error: ${j.sms?.message}`;

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

  const canSend =
    !sending &&
    (mode !== "single" || !!singleNormalised) &&
    (mode !== "custom" || bulkParsed.valid.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Send in-app push and SMS notifications — to one customer, all customers, or a
          custom list.
        </p>
      </div>

      {/* ── Compose ── */}
      <Card>
        <CardHeader>
          <CardTitle>Send notification</CardTitle>
          <CardDescription>
            Choose your audience, write your message, and send. SMS is delivered via Arkesel.
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
              {message.length}/459 chars · truncated to 3 SMS pages if longer
            </p>
          </div>

          {/* Recipient mode */}
          <div className="space-y-2">
            <Label>Send to</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as RecipientMode)}>
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

          {/* ── Single customer input ── */}
          {mode === "single" && (
            <div className="space-y-2">
              <Label htmlFor="bc-single">Customer phone number</Label>
              {/*
               * TODO: If you have a customer search/select component, replace this
               * <Input> with it. E.g.:
               *   <CustomerCombobox onSelect={(c) => setSinglePhone(c.phone)} />
               *
               * The only requirement is that you end up calling setSinglePhone(phone)
               * with the customer's phone number.
               */}
              <Input
                id="bc-single"
                placeholder="0595919802  or  233595919802"
                value={singlePhone}
                onChange={(e) => setSinglePhone(e.target.value)}
              />
              {singlePhone && !singleNormalised && (
                <p className="text-xs text-destructive">
                  Cannot normalise this number. Expected 0XXXXXXXXX (10 digits) or
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

          {/* ── Custom bulk list ── */}
          {mode === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="bc-bulk">Phone numbers</Label>
              <Textarea
                id="bc-bulk"
                placeholder={
                  "Paste any format — spaces, commas, newlines all work:\n" +
                  "0595919802 2335858838\n0203388298, 233383927748\n..."
                }
                rows={6}
                value={bulkRaw}
                onChange={(e) => setBulkRaw(e.target.value)}
                className="font-mono text-sm"
              />
              {/* Live parse feedback */}
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
                        {bulkParsed.invalid.join(", ")}
                      </span>
                    )}
                  </p>
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

          {/* Recipient summary */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Recipients:</span>
            <Badge variant="secondary">{recipientPreview}</Badge>
          </div>

          <Button onClick={send} disabled={!canSend}>
            {sending ? "Sending…" : "Send notification"}
          </Button>

          {/* SMS result badge */}
          {lastSms && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">SMS:</span>
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

      {/* ── History ── */}
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
                <li key={n.id} className="border-b pb-4 last:border-0 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{n.title}</p>
                    <Badge variant="outline" className="text-xs capitalize">
                      {n.recipients_mode === "all"
                        ? "All customers"
                        : n.recipients_mode === "single"
                        ? "1 customer"
                        : `${n.recipient_count} custom`}
                    </Badge>
                  </div>
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