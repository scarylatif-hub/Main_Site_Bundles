
import { NextResponse } from 'next/server';
import { datakazinaAPI } from '@/lib/datakazina';
import { NETWORKS } from '@/lib/networks';
import type { NetworkName } from '@/lib/definitions';
import {
  datakazinaNetworkIdToDisplay,
  displayNetworkIdFromProviderLabel,
} from '@/lib/network-id-map';
import {
  formatDataPackageLabel,
  isConsumerDataBundle,
  parseDataPackageVolumeGb,
} from '@/lib/package-display';

export const dynamic = 'force-dynamic';

function mapDataKazinaPackages(raw: unknown[]): unknown[] {
  const mapped: unknown[] = [];

  for (const rawPkg of raw) {
    if (!rawPkg || typeof rawPkg !== 'object') continue;
    const pkg = rawPkg as Record<string, unknown>;
    if (!isConsumerDataBundle(pkg)) continue;

    const volumeGb = parseDataPackageVolumeGb(pkg);
    if (volumeGb == null) continue;

    const packageId = Number(pkg.id);
    const providerLabel = pkg.network != null ? String(pkg.network) : '';
    const fromLabel = displayNetworkIdFromProviderLabel(providerLabel);
    const rawNetId = Number(pkg.network_id);
    const displayNetId =
      fromLabel ??
      (Number.isFinite(rawNetId)
        ? datakazinaNetworkIdToDisplay(Math.trunc(rawNetId))
        : 1);
    const netFromId = NETWORKS.find((n) => n.id === displayNetId);
    console.log("[packages] Package ID:", packageId, "providerLabel:", providerLabel, "rawNetId:", rawNetId, "displayNetId:", displayNetId);

    let networkName = (netFromId?.name || providerLabel || 'MTN') as NetworkName;
    if (
      providerLabel &&
      (providerLabel.includes('AT') ||
        providerLabel.includes('iSHare') ||
        providerLabel.includes('BigTime'))
    ) {
      networkName = 'AirtelTigo' as NetworkName;
    } else if (providerLabel && providerLabel.toLowerCase().includes('telecel')) {
      networkName = 'Telecel' as NetworkName;
    } else if (providerLabel && providerLabel.toLowerCase().includes('mtn')) {
      networkName = 'MTN' as NetworkName;
    }

    const dataAmount = formatDataPackageLabel(pkg, volumeGb);
    const validity = pkg.validity != null ? String(pkg.validity) : '30 days';
    const apiPrice = Number(pkg.price || pkg.console_price || 0);
    const profitMargin = volumeGb >= 10 ? 0.1 : 0.114;
    const priceWithAdminProfit = apiPrice * (1 + profitMargin);

    mapped.push({
  id: String(packageId),
  network: { id: displayNetId, name: networkName },
  providerNetworkId: Math.trunc(rawNetId),  // ✅ DataKazina network_id (1,2,3,4)
  dataAmount,
  validity,
  sharedBundle: volumeGb,                   // ✅ volume number e.g. 5 for 5GB
  price: priceWithAdminProfit,
});
  }

  return mapped;
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
      console.error('No packages returned from provider API');
      return NextResponse.json(
        { error: 'No packages available' },
        { status: 500 }
      );
    }

    const mappedPackages = mapDataKazinaPackages(pkgResult.data);

    // Sort packages by sharedBundle (smaller first, larger later)
    mappedPackages.sort((a: any, b: any) => {
      const parseGb = (label: string) =>
        parseFloat(String(label).replace(/[^\d.]/g, '')) || 0;
      return parseGb(a.dataAmount) - parseGb(b.dataAmount);
    });

    // Removed package count logging to prevent exposing API details in console

    return NextResponse.json(mappedPackages);
  } catch (error) {
    console.error('Error fetching packages from provider:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
