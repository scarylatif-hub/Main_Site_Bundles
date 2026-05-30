import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { datakazinaAPI } from '@/lib/datakazina';
import { displayNetworkIdToDatakazina } from '@/lib/network-id-map';
import { normalizePhoneNumber } from '@/lib/networks';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external/buy-other
 * Purchase data bundle using DataKazina API
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: {
      recipientMsisdn?: string;
      recipient_msisdn?: string;
      networkId?: number;
      network_id?: number;
      sharedBundle?: number;
      shared_bundle?: number;
      providerNetworkId?: number;
      provider_network_id?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const recipient_raw =
      body.recipient_msisdn ?? body.recipientMsisdn;
    const network_id = body.network_id ?? body.networkId;
    const shared_bundle = body.shared_bundle ?? body.sharedBundle;

    if (!recipient_raw || network_id === undefined || shared_bundle === undefined) {
      return NextResponse.json(
        { error: 'Missing recipient_msisdn, network_id, or shared_bundle' },
        { status: 400 }
      );
    }

    const recipient_msisdn = normalizePhoneNumber(String(recipient_raw));

    const providerNetworkId = body.providerNetworkId ?? body.provider_network_id;

    // Convert display network ID to DataKazina network ID
    const datakazinaNetworkId = displayNetworkIdToDatakazina(
      Number(network_id),
      providerNetworkId != null ? Number(providerNetworkId) : undefined
    );

    // Generate unique reference
    const incoming_api_ref = `web-${Date.now()}-${user.id.slice(0, 8)}`;

    const result = await datakazinaAPI.purchaseDataPackage({
      recipient_msisdn,
      network_id: datakazinaNetworkId,
      shared_bundle: Number(shared_bundle),
      incoming_api_ref,
    });

    if (!result.ok) {
      console.error('[buy-other] Provider error occurred');
      return NextResponse.json(
        { error: 'Failed to purchase data bundle' },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    return NextResponse.json(result.data ?? {}, { status: result.status });
  } catch (error) {
    console.error('Error in POST /api/external/buy-other:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
