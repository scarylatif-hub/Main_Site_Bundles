import { NextRequest, NextResponse } from 'next/server';
import { toPaystackAmount } from '@/lib/paystack-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paystack/guest/initialize
 * Initialize a Paystack payment for guest store purchases (no authentication required)
 */
export async function POST(request: NextRequest) {
  try {
    const { amount, email, reference, metadata } = await request.json();

    if (!amount || !email || !reference) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecretKey) {
      console.error('Paystack secret key not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    // Calculate Paystack fee (1.5% of the amount)
    const originalAmount = Number(amount);
    const paystackFee = originalAmount * 0.015;
    const totalAmount = originalAmount + paystackFee;

    const amountInKobo = toPaystackAmount(totalAmount);

    // Prepare Paystack request
    const paystackUrl = 'https://api.paystack.co/transaction/initialize';
    const paystackData = {
      email,
      amount: amountInKobo,
      reference,
      currency: 'GHS',
      metadata: {
        ...metadata,
        type: 'store_purchase',
        timestamp: new Date().toISOString(),
        original_amount: originalAmount,
        paystack_fee: paystackFee,
        total_amount: totalAmount,
      },
    };

    // Initialize Paystack transaction
    const response = await fetch(paystackUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Paystack error:', errorData);
      return NextResponse.json(
        { error: 'Failed to initialize payment with Paystack' },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!result.status) {
      console.error('Paystack returned non-success status:', result);
      return NextResponse.json(
        { error: 'Payment initialization failed' },
        { status: 400 }
      );
    }

    // Return authorization details to client along with fee information
    return NextResponse.json({
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference,
      originalAmount: originalAmount,
      paystackFee: paystackFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    });
  } catch (error) {
    console.error('Error in POST /api/paystack/guest/initialize:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
