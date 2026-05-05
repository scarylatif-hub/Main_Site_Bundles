import { NextRequest, NextResponse } from "next/server";
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
    console.error("[admin/withdrawals/complete] Failed to send ntfy notification:", error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();
  const withdrawalId = params.id;

  try {
    // Get withdrawal details
    const { data: withdrawal, error: fetchError } = await admin
      .from("earnings_to_wallet_transfers")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json({ error: "Withdrawal already processed" }, { status: 400 });
    }

    // Update withdrawal status to completed
    const { error: updateError } = await admin
      .from("earnings_to_wallet_transfers")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    if (updateError) {
      console.error("Error completing withdrawal:", updateError);
      return NextResponse.json({ error: "Failed to complete withdrawal" }, { status: 500 });
    }

    // Get user profile for notification
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number")
      .eq("id", withdrawal.user_id)
      .single();

    // Send ntfy notification for withdrawal completion
    const ntfyMessage = `
✅ WITHDRAWAL COMPLETED
========================================

📋 Withdrawal Details:
Withdrawal ID: ${withdrawalId}
Amount: GHS ${withdrawal.amount.toFixed(2)}
Reference: ${withdrawal.reference}
Status: COMPLETED

👤 User Information:
Name: ${profile?.full_name || "N/A"}
Email: ${profile?.email || "N/A"}
Phone: ${profile?.phone_number || "N/A"}

💳 Payment Details:
MoMo Number: ${withdrawal.momo_number}
Account Name: ${withdrawal.momo_name}
Method: ${withdrawal.method}

⏰ Completed: ${new Date().toISOString()}
    `.trim();

    await sendNtfyNotification(
      `✅ Withdrawal Completed: GHS ${withdrawal.amount.toFixed(2)} - ${profile?.full_name || "Unknown"}`,
      ntfyMessage
    );

    return NextResponse.json({
      success: true,
      message: "Withdrawal marked as completed successfully",
      withdrawal: {
        ...withdrawal,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Complete withdrawal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
