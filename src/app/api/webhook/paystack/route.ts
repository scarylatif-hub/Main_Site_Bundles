import { NextRequest, NextResponse } from "next/server";
import { handlePaystackWebhookPost } from "@/lib/paystack-webhook";

export const dynamic = "force-dynamic";

/** POST https://yourdomain.com/api/webhook/paystack — register in Paystack dashboard */
export async function POST(request: NextRequest) {
  return handlePaystackWebhookPost(request);
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
