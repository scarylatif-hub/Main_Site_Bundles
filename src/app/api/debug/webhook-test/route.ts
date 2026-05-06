import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  
  const config = {
    webhookUrl: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/dakazina`
      : "https://sbbundles-main.vercel.app/api/webhooks/dakazina",
    hasSecret: !!process.env.DAKAZINA_WEBHOOK_SECRET,
    secretLength: process.env.DAKAZINA_WEBHOOK_SECRET?.length || 0,
  };

  // Test recent transactions
  const { data: recentTransactions, error: transError } = await admin
    .from("transactions")
    .select("id, reference, transaction_code, status, created_at")
    .eq("transaction_type", "purchase")
    .order("created_at", { ascending: false })
    .limit(5);

  // Test recent orders
  const { data: recentOrders, error: ordersError } = await admin
    .from("orders")
    .select("id, paystack_transaction_id, payment_reference, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    config,
    recentTransactions: recentTransactions || [],
    recentOrders: recentOrders || [],
    errors: {
      transError: transError?.message,
      ordersError: ordersError?.message,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reference, status } = body;
    
    if (!reference || !status) {
      return NextResponse.json({ error: "Missing reference or status" }, { status: 400 });
    }

    // Test webhook payload structure
    const testPayload = {
      id: Date.now(),
      type: "test_event",
      status: status,
      previous_status: "processing",
      order_code: reference,
      reference: reference,
      amount: 10,
      user_id: 1,
      occurred_at: new Date().toISOString(),
      test: true,
      metadata: {
        message: "Test webhook from debug endpoint"
      }
    };

    // Send test webhook to actual webhook endpoint
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/dakazina`
      : "https://sbbundles-main.vercel.app/api/webhooks/dakazina";

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      webhookResponse: result,
      testPayload,
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
