import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-packages
 * Fetch all available data packages from external provider
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.EXTERNAL_API_KEY;
    const apiUrl = process.env.EXTERNAL_API_URL;

    if (!apiKey || !apiUrl) {
      console.error('External API credentials not configured');
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${apiUrl}/api/external/packages/all-packages`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status}`, await response.text());
      return NextResponse.json(
        { error: 'Failed to fetch packages from provider' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/external/all-packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
