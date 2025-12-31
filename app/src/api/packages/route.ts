
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;
  const apiUrl = process.env.CHEAP_BUNDLES_API_URL;

  if (!apiKey || !apiUrl) {
    console.error('Cheap Bundles API URL or Key is not configured in environment variables');
    return NextResponse.json(
      { error: 'Internal server error: API service not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${apiUrl}/api/external/packages/all-packages`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `External API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      // Return the actual error from the external API
      return new NextResponse(errorBody, { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();

    // The external API can return data in two shapes: { packages: [...] } or just [...]
    if (data && Array.isArray(data.packages)) {
      return NextResponse.json(data.packages);
    }
    
    if(Array.isArray(data)) {
        return NextResponse.json(data);
    }

    console.error('Unexpected response structure from external API:', data);
    return NextResponse.json(
      {
        error: 'Unexpected response structure from external provider.',
        details: data,
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching from /api/packages:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
