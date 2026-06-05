import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { subscription, action } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription object" },
        { status: 400 }
      );
    }

    if (action === "unsubscribe") {
      const { error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint)
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error deleting push subscription:", deleteError);
        return NextResponse.json(
          { error: "Failed to unsubscribe" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Unsubscribed successfully" });
    } else {
      // Subscribe / Register
      const p256dh = subscription.keys?.p256dh;
      const auth = subscription.keys?.auth;

      if (!p256dh || !auth) {
        return NextResponse.json(
          { error: "Missing cryptographic keys in subscription" },
          { status: 400 }
        );
      }

      const { error: upsertError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: p256dh,
            auth: auth,
          },
          { onConflict: "endpoint" }
        );

      if (upsertError) {
        console.error("Error saving push subscription:", upsertError);
        return NextResponse.json(
          { error: "Failed to subscribe" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Subscribed successfully" });
    }
  } catch (error) {
    console.error("Error in POST /api/notifications/subscribe:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
