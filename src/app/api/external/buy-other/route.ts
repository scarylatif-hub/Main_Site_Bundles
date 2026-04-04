import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/external/buy-other
 * Execute a data bundle purchase with external provider
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

    const { recipientMsisdn, networkId, sharedBundle } = await request.json();

    if (!recipientMsisdn || !networkId || !sharedBundle) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const apiKey = process.env.EXTERNAL_API_KEY;
    const apiUrl = process.env.EXTERNAL_API_URL;

    if (!apiKey || !apiUrl) {
      console.error('External API credentials not configured');
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }

    // Call external API
    const response = await fetch(`${apiUrl}/api/external/packages/buy-other`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        recipient_msisdn: recipientMsisdn,
        network_id: networkId,
        shared_bundle: sharedBundle,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`External API error: ${response.status}`, errorBody);
      return NextResponse.json(
        { error: 'Purchase failed with provider' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/external/buy-other:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
