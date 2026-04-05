import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Recent broadcasts for the signed-in user (dropdown). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("broadcast_notifications")
    .select("id,title,message,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items: data ?? [] });
}
