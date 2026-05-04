import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("reseller_prices")
      .select("*")
      .eq("reseller_id", user.id);

    if (error) {
      console.error("Fetch prices error:", error);
      return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
    }

    console.log("Fetched prices for user:", user.id, "data:", data);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Fetch prices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const prices = Array.isArray(body) ? body : [body];

    console.log("Saving prices for user:", user.id, "prices:", prices);

    const admin = createAdminClient();

    const { error } = await admin
      .from("reseller_prices")
      .upsert(prices, {
        onConflict: "reseller_id,package_id",
      });

    if (error) {
      console.error("Save prices error:", error);
      return NextResponse.json({ error: "Failed to save prices" }, { status: 500 });
    }

    console.log("Prices saved successfully for user:", user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save prices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
