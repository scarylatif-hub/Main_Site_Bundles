import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-config';
import { datakazinaAPI } from '@/lib/datakazina';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-orders-by-transaction?transactionId=
 * Admin: any transaction. User: only if that transaction_code belongs to them.
 * Uses DataKazina API to fetch transaction details.
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

  try {
    // Fetch all transactions from DataKazina and filter by reference
    const result = await datakazinaAPI.fetchTransactions();
    
    if (result.ok && result.data) {
      const transactions = Array.isArray(result.data) ? result.data : [result.data];
      const matchingTransaction = transactions.find(
        (t: any) => t.incoming_api_ref === transactionId || t.id === transactionId
      );

      if (matchingTransaction) {
        return NextResponse.json(matchingTransaction);
      }
    }

    // Provider may support single-transaction lookup when the bulk history endpoint is empty.
    const singleResult = await datakazinaAPI.fetchSingleTransaction(transactionId);
    if (singleResult.ok && singleResult.data) {
      return NextResponse.json(singleResult.data);
    }

    return NextResponse.json(null, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/external/all-orders-by-transaction:', error);
    return NextResponse.json(null, { status: 200 });
  }
}
