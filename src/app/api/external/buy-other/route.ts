import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  cheapBundlesPackagesUrl,
  getCheapBundlesApiKey,
} from '@/lib/cheap-bundles-config';
import { readFetchJson } from '@/lib/fetch-json';
import { normalizePhoneNumber } from '@/lib/networks';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external/buy-other
 * Proxies provider buy-other (snake_case body per API docs).
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

    const apiKey = getCheapBundlesApiKey();
    const buyUrl = cheapBundlesPackagesUrl('buy-other');

    if (!apiKey || !buyUrl) {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(buyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        recipient_msisdn,
        network_id: Number(network_id),
        shared_bundle: Number(shared_bundle),
      }),
    });

    const { status, data } = await readFetchJson(response);
    return NextResponse.json(data ?? {}, { status: status >= 200 && status < 600 ? status : 502 });
  } catch (error) {
    console.error('Error in POST /api/external/buy-other:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
