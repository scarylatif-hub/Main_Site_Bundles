
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiKey = "6C0gNLA90BmVVMaZOgOglMFF0mvR4uczlnSPj5beLY";
  const apiUrl = "https://cheap-bundles-ghana.azurewebsites.net";

  try {
    const response = await fetch(`${apiUrl}/api/external/packages/all-packages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Provider Error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data.packages || data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
