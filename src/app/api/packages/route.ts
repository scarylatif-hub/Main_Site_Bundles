
import { NextResponse, type NextRequest } from 'next/server';
import { applyRetailPrice } from '@/lib/pricing';
import {
  cheapBundlesPackagesUrl,
  getCheapBundlesApiKey,
} from '@/lib/cheap-bundles-config';
import { NETWORKS } from '@/lib/networks';
import type { NetworkName } from '@/lib/definitions';
import { apiNetworkIdToDisplay } from '@/lib/network-id-map';
import { getRetailPriceGhs, buildFallbackPackagesList } from '@/lib/retail-prices';

export const dynamic = 'force-dynamic';

function mapPackagesWithRetailPricing(raw: unknown[]): unknown[] {
  return raw.map((pkg: any) => {
    const wholesale =
      typeof pkg.price === 'number'
        ? pkg.price
        : parseFloat(String(pkg.price ?? 0));
    const rawNetId = Number(pkg.network?.id ?? pkg.network_id);
    const displayNetId = Number.isFinite(rawNetId)
      ? apiNetworkIdToDisplay(Math.trunc(rawNetId))
      : 1;
    const netFromId = NETWORKS.find((n) => n.id === displayNetId);
    const networkName = (pkg.network?.name ?? netFromId?.name ?? 'MTN') as NetworkName;

    const vol =
      pkg.sharedBundle ??
      pkg.shared_bundle ??
      pkg.SharedBundle ??
      pkg.sharedBundleId ??
      pkg.volume;
    const sharedBundle = Number(vol);
    const dataAmount =
      pkg.dataAmount ??
      pkg.data_amount ??
      (Number.isFinite(sharedBundle) && sharedBundle > 0
        ? `${sharedBundle} GB`
        : 'Bundle');
    const validity = pkg.validity ?? pkg.validity_days ?? '30 days';

    const tablePrice = getRetailPriceGhs(displayNetId, sharedBundle);
    const retail =
      tablePrice ??
      applyRetailPrice(Number.isFinite(wholesale) ? wholesale : 0);

    return {
      ...pkg,
      id:
        pkg.id != null
          ? String(pkg.id)
          : `pkg-${displayNetId}-${sharedBundle}`,
      network: { id: displayNetId, name: networkName },
      dataAmount,
      validity,
      sharedBundle: Number.isFinite(sharedBundle) ? sharedBundle : 0,
      wholesalePrice: wholesale,
      price: retail,
    };
  });
}

export async function GET(request: NextRequest) {
  const apiKey = getCheapBundlesApiKey();
  const packagesUrl = cheapBundlesPackagesUrl('all-packages');

  const fallback = buildFallbackPackagesList();

  if (!apiKey || !packagesUrl) {
    console.warn('Cheap Bundles API not configured. Returning catalog prices.');
    return NextResponse.json(mapPackagesWithRetailPricing(fallback as unknown[]));
  }

  try {
    const response = await fetch(packagesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `External API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      console.warn('External API failed. Returning catalog prices.');
      return NextResponse.json(mapPackagesWithRetailPricing(fallback as unknown[]));
    }

    const data = await response.json();

    if (data && Array.isArray(data.packages)) {
      return NextResponse.json(mapPackagesWithRetailPricing(data.packages));
    }

    if (Array.isArray(data)) {
      return NextResponse.json(mapPackagesWithRetailPricing(data));
    }

    console.error('Unexpected response structure from external API:', data);
    return NextResponse.json(mapPackagesWithRetailPricing(fallback as unknown[]));
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching from /api/packages:', error);
    console.warn('Error during package fetch. Returning catalog prices.');
    return NextResponse.json(mapPackagesWithRetailPricing(fallback as unknown[]));
  }
}
