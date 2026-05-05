import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { redirect } from "next/navigation";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";
import StoreClient from "./store-client";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable caching

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();


  // Fetch store owner profile by slug
  const { data: storeOwner, error: storeError } = await admin
    .from("profiles")
    .select("*")
    .eq("reseller_slug", slug)
    .single();

  if (storeError || !storeOwner) {
    redirect("/");
  }

  // Check if store is active and approved
  if (
    !storeOwner.is_reseller ||
    !storeOwner.reseller_approved ||
    !storeOwner.store_active
  ) {
    redirect("/");
  }

  // Fetch packages from DataKazina
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok || !pkgResult.data) {
   redirect("/");
  }

  // Fetch custom reseller prices
  const { data: resellerPrices } = await admin
    .from("reseller_prices")
    .select("package_id, selling_price")
    .eq("reseller_id", storeOwner.id);

  // Create a map of package_id to custom selling price
  const customPriceMap = new Map<number, number>();
  if (resellerPrices) {
    resellerPrices.forEach((price) => {
      customPriceMap.set(price.package_id, price.selling_price);
    });
  }

  // Apply profit margin to calculate selling prices
  const profitMargin = Number(storeOwner.profit_margin || 0.05);

  let packages = pkgResult.data
    ? pkgResult.data.map((pkg: any) => {
        // Use retail price from retail-prices.ts and apply tiered admin profit margin
        const displayNetworkId = datakazinaNetworkIdToDisplay(Number(pkg.network_id));
        const sharedBundle = Number(pkg.volume || pkg.shared_bundle);
        
        // Import retail prices function
        const retailPrices = require("@/lib/retail-prices");
        const retailPrice = retailPrices.getRetailPriceGhs(displayNetworkId, sharedBundle) || Number(pkg.price || 0);
        
        // Apply tiered profit margin: 11.4% for 1-9GB, 10% for 10GB+
        let adminProfitMargin;
        if (sharedBundle >= 1 && sharedBundle <= 9) {
          adminProfitMargin = 0.114; // 11.4% for 1-9GB
        } else if (sharedBundle >= 10) {
          adminProfitMargin = 0.10; // 10% for 10GB+
        } else {
          adminProfitMargin = 0.114; // Default to 11.4% for safety
        }
        
        const adminPrice = retailPrice * (1 + adminProfitMargin);

        // Use custom price if available, otherwise calculate with store owner profit margin on top of admin price
        const sellingPrice = customPriceMap.get(Number(pkg.id)) || (adminPrice * (1 + profitMargin));

        // Use volumeGB field for display (e.g., "2GB", "3GB")
        const displayName =
          pkg.volumeGB ||
          `${pkg.volume}GB` ||
          pkg.name ||
          pkg.description ||
          `Package ${pkg.id}`;

        return {
          id: pkg.id,
          network_id: displayNetworkId,
          name: displayName,
          data_amount: displayName,
          cost_price: adminPrice,
          selling_price: sellingPrice,
          validity: pkg.validity || "30 days",
          sharedBundle: sharedBundle,
        };
      })
    : [];

  // Sort packages by size (smaller first, larger later)
  packages.sort((a: any, b: any) => {
    const aSize = a.sharedBundle || 0;
    const bSize = b.sharedBundle || 0;
    return aSize - bSize;
  });

  return <StoreClient storeOwner={storeOwner} packages={packages} />;
}
