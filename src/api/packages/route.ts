
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Prevents caching issues

export async function GET() {
  const apiKey = 'FMKEqXONsfQxcE5I6MAkUboGHxTQQbUDNi2sucGIARc';

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
        cache: 'no-store', 
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `External API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      // Forward the external API's error response details
      return new NextResponse(errorBody, { status: response.status, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    return NextResponse.json(data);

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
