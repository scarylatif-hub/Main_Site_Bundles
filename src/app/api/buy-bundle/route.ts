import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recipientMsisdn, networkId, sharedBundle, price, dataAmount } = await req.json();

  if (!recipientMsisdn || !networkId || !sharedBundle || price === undefined || !dataAmount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // First, check user's balance
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Could not retrieve user profile.' }, { status: 500 });
  }

  if (profile.wallet_balance < price) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }


  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;

  if (!apiKey) {
    console.error('API key is not configured');
    return NextResponse.json({ error: 'Internal server error: API key missing' }, { status: 500 });
  }

  try {
    const response = await fetch('https://cheap-bundles-ghana.azurewebsites.net/api/external/packages/buy-other', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ recipientMsisdn, networkId, sharedBundle }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        console.error("External API error:", result);
        const transactionCode = result.transactionCode || `FAILED-${Date.now()}`;
        // Log the transaction with a failed status
        await supabase.rpc('purchase_bundle_and_log_transaction', {
            p_user_id: session.user.id,
            p_amount: price,
            p_transaction_code: transactionCode,
            p_status: 'failed',
            p_recipient_msisdn: recipientMsisdn,
            p_network_id: networkId,
            p_bundle_amount: dataAmount,
            p_description: `Failed purchase: ${result.message || 'Unknown error'}`
        });
        return NextResponse.json({ error: result.message || 'Failed to purchase bundle' }, { status: response.status });
    }

    // Log the successful transaction using the RPC function
    const { error: rpcError } = await supabase.rpc('purchase_bundle_and_log_transaction', {
        p_user_id: session.user.id,
        p_amount: price,
        p_transaction_code: result.transactionCode,
        p_status: 'success',
        p_recipient_msisdn: recipientMsisdn,
        p_network_id: networkId,
        p_bundle_amount: dataAmount,
        p_description: `Purchase of ${dataAmount} for ${recipientMsisdn}`
    });

    if (rpcError) {
        console.error("Error logging successful transaction via RPC:", rpcError);
        // This case is tricky. The purchase was successful with the external API
        // but logging and debiting failed in our DB. This can lead to inconsistency.
        // For now, we'll inform the user but the external purchase did go through.
        // A more robust solution might involve a reconciliation process.
        return NextResponse.json({ 
            error: 'Purchase succeeded but failed to update your account. Please contact support.',
            ...result 
        }, { status: 500 });
    }


    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Error in /api/buy-bundle:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
