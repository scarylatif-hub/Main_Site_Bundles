
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { recipientMsisdn, networkId, sharedBundle, price, dataAmount } = await req.json();

  const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', session.user.id).single();
  if (!profile || profile.wallet_balance < price) {
    return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
  }

  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;
  const apiUrl = process.env.CHEAP_BUNDLES_API_URL;

  try {
    const externalResponse = await fetch(`${apiUrl}/api/external/packages/buy-other`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey!,
      },
      body: JSON.stringify({ recipientMsisdn, networkId, sharedBundle }),
    });

    const result = await externalResponse.json();

    if (!externalResponse.ok || !result.success) {
      await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount: -price,
        status: 'failed',
        transaction_type: 'purchase',
        recipient_msisdn: recipientMsisdn,
        network_id: networkId,
        bundle_amount: dataAmount,
        description: result.message || 'Provider error'
      });
      return NextResponse.json({ error: result.message || 'Purchase failed' }, { status: 400 });
    }

    await supabase.rpc('purchase_bundle_and_log_transaction', {
      p_user_id: session.user.id,
      p_amount: -price,
      p_transaction_code: result.transactionCode,
      p_status: 'success',
      p_recipient_msisdn: recipientMsisdn,
      p_network_id: networkId,
      p_bundle_amount: dataAmount,
      p_description: `Purchase of ${dataAmount} for ${recipientMsisdn}`
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
