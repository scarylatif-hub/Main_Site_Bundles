import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ntfy configuration
const NTFY_TOPIC = process.env.NTFY_TOPIC || "bundle-ghana";
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

async function sendNtfyNotification(title: string, message: string) {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        "Title": title,
        "Priority": "high",
      },
      body: message,
    });
  } catch (error) {
    console.error("[create-store] Failed to send ntfy notification:", error);
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

    // Get user details for notification
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", user.id)
      .single();

    // Send ntfy notification for new store creation
    const ntfyMessage = `
🏪 NEW STORE CREATION REQUEST - APPROVAL REQUIRED
===================================================

📋 Store Details:
Store Name: ${storeName}
Store Slug: ${storeSlug}
Store URL: https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${storeSlug}

👤 Reseller Details:
Name: ${profile?.full_name || "N/A"}
Email: ${profile?.email || "N/A"}
Phone: ${profile?.phone_number || "N/A"}
User ID: ${user.id}

📊 Configuration:
Profit Margin: 5%
Status: Pending Approval
Created: ${new Date().toISOString()}

🔴 ACTION REQUIRED:
Please review and approve this store in the admin panel.
    `.trim();

    await sendNtfyNotification(
      `🏪 New Store: ${storeName} - ${profile?.full_name || "Unknown"}`,
      ntfyMessage
    );

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
