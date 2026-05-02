
import { NextResponse } from 'next/server';
import { datakazinaAPI } from '@/lib/datakazina';
import { NETWORKS } from '@/lib/networks';
import type { NetworkName } from '@/lib/definitions';
import { apiNetworkIdToDisplay } from '@/lib/network-id-map';

export const dynamic = 'force-dynamic';

const ADMIN_MARKUP = 0.14; // 14% admin markup

function mapDataKazinaPackages(raw: unknown[]): unknown[] {
  return raw.map((pkg: any) => {
    const consolePrice = Number(pkg.console_price || pkg.price || 0);
    const retailPrice = consolePrice * (1 + ADMIN_MARKUP);
    
    const rawNetId = Number(pkg.network_id);
    const displayNetId = Number.isFinite(rawNetId)
      ? apiNetworkIdToDisplay(Math.trunc(rawNetId))
      : 1;
    const netFromId = NETWORKS.find((n) => n.id === displayNetId);
    const networkName = (pkg.network || netFromId?.name || 'MTN') as NetworkName;

    const vol = pkg.volume || pkg.shared_bundle;
    const sharedBundle = Number(vol);
    const dataAmount = pkg.volumeGB || pkg.volume || pkg.data_amount || `${sharedBundle}GB`;
    const validity = pkg.validity || '30 days';

    return {
      id: String(pkg.id),
      network: { id: displayNetId, name: networkName },
      dataAmount,
      validity,
      sharedBundle: Number.isFinite(sharedBundle) ? sharedBundle : 0,
      wholesalePrice: consolePrice,
      price: Math.round(retailPrice * 100) / 100,
    };
  });
}

export async function GET() {
  try {
    const pkgResult = await datakazinaAPI.fetchDataPackages();
    
    if (!pkgResult.ok || !pkgResult.data) {
      console.error('[packages] Failed to fetch from DataKazina:', pkgResult.rawText);
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
    console.log(`Returning ${mappedPackages.length} packages from DataKazina with 14% markup`);
    
    return NextResponse.json(mappedPackages);
  } catch (error) {
    console.error('Error fetching packages from DataKazina:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
