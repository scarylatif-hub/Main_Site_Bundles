
import { NextResponse } from 'next/server';
import { datakazinaAPI } from '@/lib/datakazina';
import { NETWORKS } from '@/lib/networks';
import type { NetworkName } from '@/lib/definitions';
import { datakazinaNetworkIdToDisplay } from '@/lib/network-id-map';
import { getRetailPriceGhs, ADMIN_PROFIT_MARGIN } from '@/lib/retail-prices';

export const dynamic = 'force-dynamic';

function mapDataKazinaPackages(raw: unknown[]): unknown[] {
  return raw.map((pkg: any) => {
    const rawNetId = Number(pkg.network_id);
    const displayNetId = Number.isFinite(rawNetId)
      ? datakazinaNetworkIdToDisplay(Math.trunc(rawNetId))
      : 1;
    const netFromId = NETWORKS.find((n) => n.id === displayNetId);
    
    // Normalize network name - DataKazina returns "AT - iSHare" and "AT - BigTime"
    // but we need "AirtelTigo" for the frontend to match
    let networkName = (pkg.network || netFromId?.name || 'MTN') as NetworkName;
    if (networkName.includes('AT') || networkName.includes('iSHare') || networkName.includes('BigTime')) {
      networkName = 'AirtelTigo' as NetworkName;
    }

    const vol = pkg.volume || pkg.shared_bundle;
    const sharedBundle = Number(vol);
    const dataAmount = pkg.volumeGB || pkg.volume || pkg.data_amount || `${sharedBundle}GB`;
    const validity = pkg.validity || '30 days';

    // Use DataKazina API price directly and apply tiered admin profit margin
    const apiPrice = Number(pkg.price || pkg.console_price || 0);
    
    // Apply tiered profit margin: 11.4% for 1-9GB, 10% for 10GB+
    let profitMargin;
    if (sharedBundle >= 1 && sharedBundle <= 9) {
      profitMargin = 0.114; // 11.4% for 1-9GB
    } else if (sharedBundle >= 10) {
      profitMargin = 0.10; // 10% for 10GB+
    } else {
      profitMargin = 0.114; // Default to 11.4% for safety
    }
    
    const priceWithAdminProfit = apiPrice * (1 + profitMargin);

    return {
      id: String(pkg.id), // Keep DataKazina package ID for purchase
      network: { id: displayNetId, name: networkName },
      dataAmount,
      validity,
      sharedBundle: Number.isFinite(sharedBundle) ? sharedBundle : 0,
      price: priceWithAdminProfit,
    };
  });
}

export async function GET() {
  try {
    const pkgResult = await datakazinaAPI.fetchDataPackages();
    
    if (!pkgResult.ok || !pkgResult.data) {
      console.error('[packages] Failed to fetch packages from provider');
      return NextResponse.json(
        { error: 'Failed to fetch packages from provider' },
        { status: pkgResult.status >= 400 ? pkgResult.status : 502 }
      );
    }

    if (pkgResult.data.length === 0) {
      console.error('No packages returned from DataKazina API');
      return NextResponse.json(
        { error: 'No packages available' },
        { status: 500 }
      );
    }

    const mappedPackages = mapDataKazinaPackages(pkgResult.data);

    // Sort packages by sharedBundle (smaller first, larger later)
    mappedPackages.sort((a: any, b: any) => {
      const aSize = a.sharedBundle || 0;
      const bSize = b.sharedBundle || 0;
      return aSize - bSize; // Ascending order - smaller first
    });

    // Removed package count logging to prevent exposing API details in console

    return NextResponse.json(mappedPackages);
  } catch (error) {
    console.error('Error fetching packages from DataKazina:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
