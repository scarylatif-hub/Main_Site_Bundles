
import { NextResponse } from 'next/server';

// This endpoint is a proxy to the external API to protect the API key.
export const dynamic = 'force-dynamic'; // Prevents caching issues

export async function GET() {
  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;

  if (!apiKey) {
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
          'X-API-KEY': apiKey,
        },
        cache: 'no-store', // Changed from next.revalidate for better compatibility
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
          statusCode: response.status 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // The external API returns an object with a `packages` key.
    // We need to extract this array before sending it to the client.
    if (data && Array.isArray(data.packages)) {
      return NextResponse.json(data.packages, { status: 200 });
    }

    // If no packages key exists, log and return appropriate error
    console.error('Unexpected response structure from external API:', data);
    return NextResponse.json(
      { 
        error: 'Unexpected response structure from external API.',
        receivedData: data 
      },
      { status: 500 }
    );

  } catch (error: unknown) {
    // Better error handling with type safety
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
