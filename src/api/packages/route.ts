
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CHEAP_BUNDLES_API_KEY = 'FMKEqXONsfQxcE5I6MAkUboGHxTQQbUDNi2sucGIARc';

export async function GET() {
  if (!CHEAP_BUNDLES_API_KEY) {
    console.error('API key is not configured');
    return NextResponse.json(
      { error: 'Internal server error: API key missing' }, 
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      'https://cheap-bundles-ghana.azurewebsites.net/api/external/packages/all-packages',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': CHEAP_BUNDLES_API_KEY,
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
      return new NextResponse(errorBody, { status: response.status });
    }
    
    const data = await response.json();

    if (data && Array.isArray(data.packages)) {
      return NextResponse.json(data.packages);
    }
    
    if (Array.isArray(data)) {
        return NextResponse.json(data);
    }

    console.error("Unexpected response structure from external API:", data);
    return NextResponse.json(
        { error: 'Unexpected response structure from external API.' },
        { status: 500 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching from /api/packages:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
