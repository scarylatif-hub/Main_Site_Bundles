import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paystack/webhook
 * Handle Paystack payment verification and webhook callbacks
 * 
 * Paystack sends webhook data to this endpoint after a payment is completed
 * We verify the signature and update the wallet/transaction accordingly
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    // Verify the webhook signature
    if (!paystackSecret || !signature) {
      console.error('Paystack secret or signature missing');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.warn('Invalid Paystack signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the webhook data
    const data = JSON.parse(body);
    const { event, data: eventData } = data;

    // Handle different event types
    if (event === 'charge.success') {
      const { reference, amount, metadata, customer, status } = eventData;

      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);

      // Extract user ID from metadata or reference
      const userId = metadata?.userId || reference.split('_')[1];

      if (!userId) {
        console.error('No user ID found in webhook data');
        return NextResponse.json({ ok: true }); // Still return 200 to acknowledge
      }

      // Verify the payment was successful
      if (status !== 'success') {
        console.warn(`Payment not successful: ${status}`);
        return NextResponse.json({ ok: true });
      }

      const amountGhs = amount / 100; // Convert from kobo to GHS
      const transactionType = metadata?.type || 'deposit';

      try {
        // Call the RPC function to add funds to wallet
        const { error: rpcError } = await supabase.rpc(
          'add_to_wallet_and_log_transaction',
          {
            p_user_id: userId,
            p_amount: amountGhs,
            p_transaction_type: transactionType,
            p_status: 'success',
            p_transaction_code: reference,
            p_description: metadata?.description || `Payment via Paystack: ${reference}`,
          }
        );

        if (rpcError) {
          console.error('RPC error:', rpcError);
          return NextResponse.json(
            { error: 'Failed to process payment' },
            { status: 500 }
          );
        }

        console.log(`✅ Payment processed: ${amount} kobo for user ${userId}`);
        return NextResponse.json({ ok: true });
      } catch (error) {
        console.error('Error processing payment:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    }

    // For other events, just acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to prevent retry loops
    return NextResponse.json({ ok: true });
  }
}

/**
 * GET /api/paystack/webhook
 * Paystack verification endpoint (returns 200 OK for connectivity test)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok' });
}
