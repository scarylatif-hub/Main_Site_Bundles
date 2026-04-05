import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-config';
import {
  cheapBundlesPackagesUrl,
  getCheapBundlesApiKey,
} from '@/lib/cheap-bundles-config';
import { readFetchJson } from '@/lib/fetch-json';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-orders-by-transaction?transactionId=
 * Admin: any transaction. User: only if that transaction_code belongs to them.
 */
export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get('transactionId');

  if (!transactionId) {
    return NextResponse.json(
      { error: 'transactionId query parameter is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    const { data: row } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_code', transactionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const apiKey = getCheapBundlesApiKey();
  const base = cheapBundlesPackagesUrl('all-orders-by-transaction');

  if (!apiKey || !base) {
    return NextResponse.json(null, { status: 200 });
  }

  try {
    const url = `${base}?transactionId=${encodeURIComponent(transactionId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      cache: 'no-store',
    });

    const { ok, data } = await readFetchJson(response);

    if (!ok) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/external/all-orders-by-transaction:', error);
    return NextResponse.json(null, { status: 200 });
  }
}
