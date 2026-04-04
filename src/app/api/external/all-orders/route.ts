import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-orders
 * Retrieve all orders from external provider
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.EXTERNAL_API_KEY;
    const apiUrl = process.env.EXTERNAL_API_URL;

    if (!apiKey || !apiUrl) {
      console.error('External API credentials not configured');
      return NextResponse.json([], { status: 200 }); // Return empty array on config error
    }

    const response = await fetch(`${apiUrl}/api/external/orders/all-orders`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status}`, await response.text());
      return NextResponse.json([], { status: 200 }); // Return empty array on error
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/external/all-orders:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error
  }
}
