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
    const { storeName, storeSlug } = body;

    // Validate inputs
    if (!storeName || !storeSlug) {
      return NextResponse.json({ error: "Store name and slug are required" }, { status: 400 });
    }

    // Validate slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(storeSlug)) {
      return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if slug is already taken
    const { data: existingSlug } = await admin
      .from("profiles")
      .select("id")
      .eq("reseller_slug", storeSlug)
      .single();

    if (existingSlug) {
      return NextResponse.json({ error: "Store slug is already taken" }, { status: 400 });
    }

    // Update user profile with store details (pending approval)
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        store_name: storeName,
        reseller_slug: storeSlug,
        is_reseller: true,
        reseller_approved: false,
        store_active: true,
        profit_margin: 0.05,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Store creation error:", updateError);
      return NextResponse.json({ error: "Failed to create store" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Store created successfully. Waiting for admin approval.",
      storeName,
      storeSlug,
    });
  } catch (error) {
    console.error("Store creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
