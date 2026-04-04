import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { generatePaystackReference, toPaystackAmount } from '@/lib/paystack-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/paystack/initialize
 * Initialize a Paystack payment for wallet deposit or cart purchase
 * 
 * This endpoint creates a payment session with Paystack
 * Returns the authorization URL for the user to complete payment
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, type, description } = await request.json();

    if (!amount || !type || (type !== 'deposit' && type !== 'purchase')) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
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

    const reference = generatePaystackReference(session.user.id, type as 'wallet' | 'purchase');
    const amountInKobo = toPaystackAmount(amount);

    // Prepare Paystack request
    const paystackUrl = 'https://api.paystack.co/transaction/initialize';
    const paystackData = {
      email: session.user.email,
      amount: amountInKobo,
      reference,
      metadata: {
        userId: session.user.id,
        type,
        description,
        timestamp: new Date().toISOString(),
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

    // Return authorization details to client
    return NextResponse.json({
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference,
    });
  } catch (error) {
    console.error('Error in POST /api/paystack/initialize:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/paystack/verify
 * Verify a Paystack payment after the user returns from the gateway
 */
export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get('reference');

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference parameter is required' },
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

    // Verify with Paystack
    const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Paystack verification error:', errorData);
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error in GET /api/paystack/verify:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
