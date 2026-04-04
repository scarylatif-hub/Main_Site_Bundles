import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-orders-by-transaction
 * Retrieve a specific order by transaction ID from external provider
 */
export async function GET(request: NextRequest) {
  try {
    const transactionId = request.nextUrl.searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.EXTERNAL_API_KEY;
    const apiUrl = process.env.EXTERNAL_API_URL;

    if (!apiKey || !apiUrl) {
      console.error('External API credentials not configured');
      return NextResponse.json(null, { status: 200 }); // Return null on config error
    }

    const response = await fetch(
      `${apiUrl}/api/external/orders/all-orders-by-transaction?transactionId=${transactionId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error(`External API error: ${response.status}`, await response.text());
      return NextResponse.json(null, { status: 200 }); // Return null on error
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/external/all-orders-by-transaction:', error);
    return NextResponse.json(null, { status: 200 }); // Return null on error
  }
}
