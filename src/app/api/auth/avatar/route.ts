import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_AVATAR_URLS } from "@/lib/avatars";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const avatarUrl =
      body && typeof body.avatar_url === "string" ? body.avatar_url : "";

    if (!ALLOWED_AVATAR_URLS.includes(avatarUrl)) {
      return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", session.user.id);

    if (error) {
      console.error("Error updating avatar:", error);
      return NextResponse.json(
        { error: "Failed to update avatar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in PATCH /api/auth/avatar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
