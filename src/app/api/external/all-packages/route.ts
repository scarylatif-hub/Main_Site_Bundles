import { NextResponse } from 'next/server';
import { datakazinaAPI } from '@/lib/datakazina';

export const dynamic = 'force-dynamic';

/**
 * GET /api/external/all-packages
 * Fetch all available data packages from DataKazina
 */
export async function GET() {
  try {
    const result = await datakazinaAPI.fetchDataPackages();
    
    if (!result.ok || !result.data) {
      console.error('[all-packages] Failed to fetch packages from provider');
      return NextResponse.json(
        { error: 'Failed to fetch packages from provider' },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error in GET /api/external/all-packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
