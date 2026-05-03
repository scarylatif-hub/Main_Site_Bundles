import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Margin limits based on pricing rules
// 1GB console price: GHS 3.85, admin markup 14% = GHS 4.39 base
// Min selling price GHS 4.80 → margin 9.3%
// Max selling price GHS 6.50 → margin 48%
const MIN_MARGIN = 0.093; // 9.3%
const MAX_MARGIN = 0.48;  // 48%

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { profit_margin } = body;

    if (typeof profit_margin !== "number" || profit_margin < MIN_MARGIN || profit_margin > MAX_MARGIN) {
      return NextResponse.json({ 
        error: `Profit margin must be between ${(MIN_MARGIN * 100).toFixed(1)}% and ${(MAX_MARGIN * 100).toFixed(1)}% to maintain fair pricing` 
      }, { status: 400 });
    }

    const admin = createAdminClient();

    // Clamp the value to ensure it stays within bounds
    const clampedMargin = Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, profit_margin));

    const { error } = await admin
      .from("profiles")
      .update({ profit_margin: clampedMargin, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Save markup error:", error);
      return NextResponse.json({ error: "Failed to save markup" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      profit_margin: clampedMargin,
      message: `Profit margin saved: ${(clampedMargin * 100).toFixed(1)}%`
    });
  } catch (error) {
    console.error("Save markup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
