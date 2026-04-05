import { createAdminClient } from "@/lib/supabase/admin";
import { BroadcastPanel, type BroadcastRow } from "./broadcast-panel";

export const dynamic = "force-dynamic";

export default async function MyAdminNotificationsPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("broadcast_notifications")
    .select("id,title,message,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("broadcast_notifications list:", error);
  }

  return <BroadcastPanel initialItems={(data ?? []) as BroadcastRow[]} />;
}
