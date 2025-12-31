
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
    return NextResponse.json({ error: 'Missing required fields for purchase' }, { status: 400 });
  }
  
  // First, verify user's balance is sufficient
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile fetch error:", profileError);
    return NextResponse.json({ error: 'Could not retrieve user profile.' }, { status: 500 });
  }

  if (profile.wallet_balance < price) {
    return NextResponse.json({ error: 'Insufficient funds. Please top up your wallet.' }, { status: 400 });
  }

  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;
  if (!apiKey) {
    console.error('API key (CHEAP_BUNDLES_API_KEY) is not configured in environment variables.');
    return NextResponse.json({ error: 'Internal server error: Service not configured' }, { status: 500 });
  }

  // Attempt to purchase the bundle from the external API
  try {
    const externalApiResponse = await fetch('https://cheap-bundles-ghana.azurewebsites.net/api/external/packages/buy-other', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ recipientMsisdn, networkId, sharedBundle }),
    });

    const result = await externalApiResponse.json();

    if (!externalApiResponse.ok || !result.success) {
        console.error("External API purchase failed:", result);
        const transactionCode = result.transactionCode || `FAILED-${Date.now()}`;
        // Log the FAILED transaction, but DO NOT deduct from wallet
        const { error: logError } = await supabase
        .from('transactions')
        .insert({
            user_id: session.user.id,
            amount: price,
            transaction_code: transactionCode,
            status: 'failed',
            transaction_type: 'purchase',
            recipient_msisdn: recipientMsisdn,
            network_id: networkId,
            bundle_amount: dataAmount,
            description: `Failed purchase: ${result.message || 'Unknown external API error'}`
        });
        if(logError) console.error("Error logging failed transaction:", logError);

        return NextResponse.json({ error: result.message || 'Failed to purchase bundle from provider' }, { status: externalApiResponse.status });
    }

    // If external purchase was successful, now debit user wallet and log the transaction atomically.
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
        console.error("CRITICAL: RPC 'purchase_bundle_and_log_transaction' failed after successful external purchase.", rpcError);
        return NextResponse.json({ 
            success: true, 
            message: 'Purchase successful. There was a slight delay in updating your balance, please refresh.',
            ...result 
        });
    }

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Unhandled error in /api/buy-bundle:', error);
     await supabase
        .from('transactions')
        .insert({
            user_id: session.user.id,
            amount: price,
            transaction_code: `ERROR-${Date.now()}`,
            status: 'failed',
            transaction_type: 'purchase',
            recipient_msisdn: recipientMsisdn,
            network_id: networkId,
            bundle_amount: dataAmount,
            description: `Internal Server Error: ${error.message}`
        });
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
