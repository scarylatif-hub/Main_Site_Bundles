
import { NextResponse } from 'next/server';

// This endpoint is a proxy to the external API to protect the API key.
export async function GET() {
  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;

  if (!apiKey) {
    console.error('API key is not configured');
    return NextResponse.json({ error: 'Internal server error: API key missing' }, { status: 500 });
  }

  try {
    const response = await fetch('https://cheap-bundles-ghana.azurewebsites.net/api/external/packages/all-packages', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      // Adding revalidation to ensure we get fresh data periodically
      next: { revalidate: 3600 } // Revalidate every hour
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`External API error: ${response.status} ${response.statusText}`, errorBody);
      return NextResponse.json({ error: 'Failed to fetch packages from external source.' }, { status: response.status });
    }

    const data = await response.json();
    
    // The external API returns an object with a `packages` key.
    // We need to extract this array before sending it to the client.
    if (data && data.packages) {
        return NextResponse.json(data.packages);
    }

    console.error("Unexpected response structure from external API:", data);
    return NextResponse.json({ error: 'Unexpected response structure from external API.' }, { status: 500 });

  } catch (error: any) {
    console.error('Error fetching from /api/packages:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
