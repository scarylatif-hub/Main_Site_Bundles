import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWebPushNotification } from "@/lib/server/notifications";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
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

    // Send a test push notification
    await sendWebPushNotification(user.id, {
      title: "🎉 Test Notification",
      body: "Push notifications are working! This is a test message.",
      url: "/orders",
    });

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("Error sending test push:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
