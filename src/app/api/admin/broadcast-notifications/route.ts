// app/api/admin/broadcast-notifications/route.ts
//
// Arkesel V2  →  POST https://sms.arkesel.com/api/v2/sms/send
// Key passed as header:  "api-key": "<your key>"
// recipients  is a JSON array of strings, NOT comma-separated.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RecipientMode = "all" | "single" | "custom";

interface RequestBody {
  title:      string;
  message:    string;
  mode:       RecipientMode;
  /** null  → fetch all from DB (mode === "all")
   *  array → use directly        (mode === "single" | "custom") */
  recipients: string[] | null;
}

interface BroadcastRow {
  id:              string;
  title:           string;
  message:         string;
  recipients_mode: RecipientMode;
  recipient_count: number;
  created_at:      string;
}

interface SmsResult {
  ok:              boolean;
  code:            string;
  message:         string;
  recipient_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB stubs  ── replace both with your real queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return every subscribed phone number from your DB.
 * Numbers must already be in Arkesel format (no "+"), e.g. "233544919953".
 *
 * ▶ TODO — Drizzle example:
 *   const rows = await db
 *     .select({ phone: users.phone })
 *     .from(users)
 *     .where(and(isNotNull(users.phone), eq(users.sms_opted_in, true)));
 *   return rows.map((r) => r.phone).filter(Boolean) as string[];
 */
async function getAllSubscribedPhones(): Promise<string[]> {
  return []; // ← replace
}

/**
 * Persist the notification record and return the saved row.
 *
 * ▶ TODO — Drizzle example:
 *   const [row] = await db
 *     .insert(broadcastNotifications)
 *     .values({ title, message, recipients_mode: mode, recipient_count: count })
 *     .returning();
 *   return row;
 */
async function saveNotification(
  title:          string,
  message:        string,
  mode:           RecipientMode,
  recipientCount: number,
): Promise<BroadcastRow> {
  return {                               // ← replace
    id:              crypto.randomUUID(),
    title,
    message,
    recipients_mode: mode,
    recipient_count: recipientCount,
    created_at:      new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Arkesel V2 sender
//
// V2 differences vs V1:
//   • endpoint  : POST /api/v2/sms/send  (not /sms/api)
//   • auth      : header "api-key"       (not query param / body)
//   • recipients: JSON array             (not comma-separated string)
//   • success   : { status: "success" }  (not { code: "ok" })
//
// We batch at 1 000 numbers per request (Arkesel soft limit).
// ─────────────────────────────────────────────────────────────────────────────

async function sendArkeselV2(
  recipients: string[],
  smsBody:    string,
  apiKey:     string,
  senderID:   string,
): Promise<SmsResult> {
  if (recipients.length === 0) {
    return {
      ok:              true,
      code:            "skipped",
      message:         "No recipients — SMS skipped.",
      recipient_count: 0,
    };
  }

  const url   = "https://sms.arkesel.com/api/v2/sms/send";
  const BATCH = 1_000;

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key":      apiKey,            // V2 auth: header, not body
      },
      body: JSON.stringify({
        sender:     senderID,              // max 11 chars
        message:    smsBody.slice(0, 459), // 3 SMS pages max
        recipients: batch,                 // V2: array of strings
      }),
    });

    const json = await res.json().catch(() => ({
      status:  "error",
      message: "Invalid JSON from Arkesel",
    }));

    // V2 success shape: { status: "success", data: [...] }
    if (json.status !== "success") {
      return {
        ok:              false,
        code:            String(res.status),
        message:         json.message ?? "Arkesel V2 error",
        recipient_count: 0,
      };
    }
  }

  return {
    ok:              true,
    code:            "success",
    message:         "SMS sent successfully.",
    recipient_count: recipients.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body: Partial<RequestBody> = await req.json().catch(() => ({}));

    const title   = (body.title   ?? "").trim();
    const message = (body.message ?? "").trim();
    const mode    = (["all", "single", "custom"].includes(body.mode ?? "")
      ? body.mode
      : "all") as RecipientMode;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title and message are required." },
        { status: 400 },
      );
    }

    // 2. Resolve recipients
    let recipients: string[];

    if (Array.isArray(body.recipients) && body.recipients.length > 0) {
      // single / custom — list already normalised by the panel
      recipients = body.recipients;
    } else {
      // all — pull from DB
      recipients = await getAllSubscribedPhones();
    }

    // 3. Persist to DB
    const item = await saveNotification(title, message, mode, recipients.length);

    // 4. Arkesel config from env
    const apiKey   = process.env.ARKESEL_SMS_API_KEY;
    const senderID = (process.env.ARKESEL_SENDER_ID ?? "NOTIFY").slice(0, 11);
    // Note: ARKESEL_SMS_API_URL is ignored for V2 — endpoint is fixed above.
    // Remove the V1 env var or leave it; it won't be used here.

    // 5. Send SMS
    let smsResult: SmsResult;

    if (!apiKey) {
      smsResult = {
        ok:              true,
        code:            "skipped",
        message:         "ARKESEL_SMS_API_KEY not set — SMS skipped.",
        recipient_count: 0,
      };
    } else {
      const smsBody = `${title}\n${message}`;
      smsResult     = await sendArkeselV2(recipients, smsBody, apiKey, senderID);
    }

    return NextResponse.json({ item, sms: smsResult }, { status: 200 });

  } catch (err) {
    console.error("[broadcast-notifications]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[broadcast-notifications][delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: data }, { status: 200 });
  } catch (err) {
    console.error("[broadcast-notifications][delete]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body: Partial<{ id: string; title: string; message: string }> = await req.json().catch(() => ({}));
    const { id, title, message } = body;
    if (!id || !title || !message) {
      return NextResponse.json({ error: "id, title and message required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("broadcast_notifications")
      .update({ title: title.trim(), message: message.trim() })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[broadcast-notifications][patch]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 200 });
  } catch (err) {
    console.error("[broadcast-notifications][patch]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal" }, { status: 500 });
  }
}