
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; 

export async function GET() {
  const apiKey = 'FMKEqXONsfQxcE5I6MAkUboGHxTQQbUDNi2sucGIARc';

  if (!apiKey) {
    console.error('API key is not configured.');
    return NextResponse.json(
      { error: 'Internal server error: Service not configured' }, 
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
      return NextResponse.json(
        { 
          error: 'Failed to fetch packages from external source.',
          statusCode: response.status,
          details: errorBody
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // The external API might return the array directly, or nested under a "packages" key.
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
