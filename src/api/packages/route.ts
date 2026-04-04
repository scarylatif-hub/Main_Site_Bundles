
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiKey = process.env.CHEAP_BUNDLES_API_KEY;
  const apiUrl = process.env.CHEAP_BUNDLES_API_URL;

  if (!apiKey || !apiUrl) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`${apiUrl}/api/external/packages/all-packages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) return new NextResponse(await response.text(), { status: response.status });

    const data = await response.json();
    return NextResponse.json(data.packages || data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
