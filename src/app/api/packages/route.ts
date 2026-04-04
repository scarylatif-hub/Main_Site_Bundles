
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Fallback packages data when external API is not configured
const FALLBACK_PACKAGES = [
  // MTN Packages
  { id: 'mtn-1gb', network: { id: 1, name: 'MTN' }, dataAmount: '1GB', validity: '30 days', price: 4.57, sharedBundle: 1 },
  { id: 'mtn-2gb', network: { id: 1, name: 'MTN' }, dataAmount: '2GB', validity: '30 days', price: 8.57, sharedBundle: 2 },
  { id: 'mtn-5gb', network: { id: 1, name: 'MTN' }, dataAmount: '5GB', validity: '30 days', price: 22.86, sharedBundle: 5 },
  { id: 'mtn-10gb', network: { id: 1, name: 'MTN' }, dataAmount: '10GB', validity: '30 days', price: 42.86, sharedBundle: 10 },
  
  // Telecel Packages
  { id: 'tc-1gb', network: { id: 2, name: 'Telecel' }, dataAmount: '1GB', validity: '30 days', price: 4.29, sharedBundle: 1 },
  { id: 'tc-5gb', network: { id: 2, name: 'Telecel' }, dataAmount: '5GB', validity: '30 days', price: 21.50, sharedBundle: 5 },
  { id: 'tc-10gb', network: { id: 2, name: 'Telecel' }, dataAmount: '10GB', validity: '30 days', price: 40.00, sharedBundle: 10 },
  
  // AirtelTigo Packages
  { id: 'at-1gb', network: { id: 3, name: 'AirtelTigo' }, dataAmount: '1GB', validity: '30 days', price: 4.50, sharedBundle: 1 },
  { id: 'at-5gb', network: { id: 3, name: 'AirtelTigo' }, dataAmount: '5GB', validity: '30 days', price: 23.20, sharedBundle: 5 },
  { id: 'at-10gb', network: { id: 3, name: 'AirtelTigo' }, dataAmount: '10GB', validity: '30 days', price: 45.00, sharedBundle: 10 },
];

export async function GET(request: NextRequest) {
  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;
  const apiUrl = process.env.CHEAP_BUNDLES_API_URL;

  // If API is not configured, return fallback data
  if (!apiKey || !apiUrl) {
    console.warn('Cheap Bundles API not configured. Returning fallback packages.');
    return NextResponse.json(FALLBACK_PACKAGES);
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
      // Return fallback on API error
      console.warn('External API failed. Returning fallback packages.');
      return NextResponse.json(FALLBACK_PACKAGES);
    }

    const data = await response.json();

    // The external API can return data in two shapes: { packages: [...] } or just [...]
    if (data && Array.isArray(data.packages)) {
      return NextResponse.json(data.packages);
    }

    if (Array.isArray(data)) {
      return NextResponse.json(data);
    }

    console.error('Unexpected response structure from external API:', data);
    // Return fallback on unexpected structure
    return NextResponse.json(FALLBACK_PACKAGES);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching from /api/packages:', error);
    
    // Return fallback on any error
    console.warn('Error during package fetch. Returning fallback packages.');
    return NextResponse.json(FALLBACK_PACKAGES);
  }
}
