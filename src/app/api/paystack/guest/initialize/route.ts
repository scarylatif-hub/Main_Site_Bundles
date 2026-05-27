import { NextRequest, NextResponse } from 'next/server';
import { toPaystackAmount } from '@/lib/paystack-config';

export const dynamic = 'force-dynamic';

/**
 * Generate unique transaction reference for store purchases
 * Similar pattern to main site but for guest/store purchases
 */
function generateStoreReference(phoneNumber: string, storeId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const phoneSuffix = phoneNumber.replace(/\D/g, '').slice(-6); // Last 6 digits of phone
  const storeSuffix = storeId.slice(-6); // Last 6 chars of store ID
  return `STORE_${phoneSuffix}_${storeSuffix}_${timestamp}_${random}`;
}

/**
 * POST /api/paystack/guest/initialize
 * Initialize a Paystack payment for guest store purchases (no authentication required)
 */
export async function POST(request: NextRequest) {
  try {
    const { amount, email, metadata, callbackUrl } = await request.json();

    if (!amount || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Extract phone number and store ID from metadata for unique reference generation
    const phoneNumber = metadata?.phone_number || '';
    const storeId = metadata?.store_id || '';

    // Generate unique reference using phone number and store ID
    const reference = generateStoreReference(phoneNumber, storeId);

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
      ...(typeof callbackUrl === 'string' && callbackUrl.startsWith('http')
        ? { callback_url: callbackUrl }
        : {}),
      metadata: {
        ...metadata,
        type: 'store_purchase',
        timestamp: new Date().toISOString(),
        original_amount: originalAmount,
        paystack_fee: paystackFee,
        total_amount: totalAmount,
        customer_phone: phoneNumber,
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
        { error: 'Failed to initialize payment with Paystack', details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!result.status) {
      console.error('Paystack returned non-success status:', result);
      return NextResponse.json(
        { error: 'Payment initialization failed', details: result },
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
