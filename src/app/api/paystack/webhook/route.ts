import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { creditWalletFromPaystackSuccess } from '@/lib/paystack-credit';

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
      const { reference, amount, metadata, status } = eventData;

      if (status !== 'success') {
        console.warn(`Payment not successful: ${status}`);
        return NextResponse.json({ ok: true });
      }

      const userId = metadata?.userId;
      if (!userId) {
        console.error('No user ID found in webhook data');
        return NextResponse.json({ ok: true });
      }

      const result = await creditWalletFromPaystackSuccess({
        status: 'success',
        reference,
        amount,
        metadata: {
          userId,
          type: metadata?.type,
          description:
            metadata?.description || `Payment via Paystack: ${reference}`,
        },
      });

      console.log(
        `Paystack webhook ${reference}: credited=${result.credited} reason=${result.reason ?? 'ok'}`
      );
      return NextResponse.json({ ok: true });
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
