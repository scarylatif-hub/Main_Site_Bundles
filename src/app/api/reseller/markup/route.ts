import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { profit_margin } = body;

    if (typeof profit_margin !== "number" || profit_margin < 0.05 || profit_margin > 0.20) {
      return NextResponse.json({ error: "Markup must be between 5% and 20%" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({ profit_margin, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Save markup error:", error);
      return NextResponse.json({ error: "Failed to save markup" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save markup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
