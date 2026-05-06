import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStoreCreationRequested } from "@/lib/server/notifications";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storeName, storeSlug } = body;

    if (!storeName || !storeSlug) {
      return NextResponse.json(
        { error: "Store name and slug are required" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(storeSlug)) {
      return NextResponse.json(
        {
          error:
            "Slug can only contain lowercase letters, numbers, and hyphens",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existingSlug } = await admin
      .from("profiles")
      .select("id")
      .eq("reseller_slug", storeSlug)
      .single();

    if (existingSlug) {
      return NextResponse.json(
        { error: "Store slug is already taken" },
        { status: 400 }
      );
    }

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

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", user.id)
      .single();

    await notifyStoreCreationRequested({
      userId: user.id,
      storeName,
      storeSlug,
      resellerName: profile?.full_name,
      email: profile?.email,
      phoneNumber: profile?.phone_number,
    });

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
