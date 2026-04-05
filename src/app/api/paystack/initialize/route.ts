import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePaystackReference, toPaystackAmount } from '@/lib/paystack-config';
import { chargeGhsForWalletCredit } from '@/lib/wallet-deposit-fee';

export const dynamic = 'force-dynamic';

function normalizePaystackType(
  type: string
): { refKind: 'wallet' | 'purchase'; metadataType: string } {
  if (type === 'deposit' || type === 'wallet_deposit') {
    return { refKind: 'wallet', metadataType: 'deposit' };
  }
  return { refKind: 'purchase', metadataType: 'purchase' };
}

/**
 * POST /api/paystack/initialize
 * Initialize a Paystack payment for wallet deposit or cart purchase
 * 
 * This endpoint creates a payment session with Paystack
 * Returns the authorization URL for the user to complete payment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, type, description } = await request.json();

    const allowed =
      type === 'deposit' ||
      type === 'purchase' ||
      type === 'wallet_deposit' ||
      type === 'cart_purchase';

    if (!amount || !type || !allowed) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    const { refKind, metadataType } = normalizePaystackType(type);

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecretKey) {
      console.error('Paystack secret key not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 500 }
      );
    }

    const reference = generatePaystackReference(user.id, refKind);
    const baseGhs = Number(amount);
    const isDeposit = metadataType === 'deposit';
    const chargeGhs = isDeposit ? chargeGhsForWalletCredit(baseGhs) : baseGhs;
    const amountInKobo = toPaystackAmount(chargeGhs);

    // Prepare Paystack request
    const paystackUrl = 'https://api.paystack.co/transaction/initialize';
    const paystackData = {
      email: user.email,
      amount: amountInKobo,
      reference,
      metadata: {
        userId: user.id,
        type: metadataType,
        description,
        timestamp: new Date().toISOString(),
        ...(isDeposit
          ? {
              creditAmountGhs: String(baseGhs),
              chargeAmountGhs: String(chargeGhs),
            }
          : {}),
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
      creditAmountGhs: baseGhs,
      chargeAmountGhs: chargeGhs,
    });
  } catch (error) {
    console.error('Error in POST /api/paystack/initialize:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
