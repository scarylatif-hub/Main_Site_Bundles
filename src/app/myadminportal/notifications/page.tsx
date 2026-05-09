import { createAdminClient } from "@/lib/supabase/admin";
import { BroadcastPanel, type BroadcastRow } from "./broadcast-panel";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: unknown;
  title: unknown;
  message: unknown;
  created_at: unknown;
  recipients_mode?: unknown;
  recipient_count?: unknown;
};

export default async function MyAdminNotificationsPage() {
  const admin = createAdminClient();
  const withMeta = await admin
    .from("broadcast_notifications")
    .select("id,title,message,created_at,recipients_mode,recipient_count")
    .order("created_at", { ascending: false })
    .limit(100);

  const fallback =
    withMeta.error == null
      ? null
      : await admin
          .from("broadcast_notifications")
          .select("id,title,message,created_at")
          .order("created_at", { ascending: false })
          .limit(100);

  if (withMeta.error && fallback?.error) {
    console.error("broadcast_notifications list:", fallback.error);
  }

  const rows: NotificationRow[] = withMeta.error
    ? ((fallback?.data ?? []) as NotificationRow[])
    : ((withMeta.data ?? []) as NotificationRow[]);
  const items: BroadcastRow[] = rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    recipients_mode:
      row.recipients_mode === "single" ||
      row.recipients_mode === "custom" ||
      row.recipients_mode === "all"
        ? row.recipients_mode
        : "all",
    recipient_count:
      typeof row.recipient_count === "number"
        ? row.recipient_count
        : row.recipients_mode === "single"
        ? 1
        : 0,
  }));

  return <BroadcastPanel initialItems={items} />;
}
