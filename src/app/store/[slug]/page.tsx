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
  const adminMarkup = 0.14; // 14% admin markup for main website

  const packages = pkgResult.data
    ? pkgResult.data.map((pkg: any) => {
        const consolePrice = Number(pkg.console_price || pkg.price || 0);
        const resellerCost = consolePrice * (1 + adminMarkup);
        
        // Use custom price if available, otherwise calculate with profit margin
        const sellingPrice = customPriceMap.get(Number(pkg.id)) || (resellerCost * (1 + profitMargin));

        // Convert DataKazina network ID to display network ID
        const displayNetworkId = datakazinaNetworkIdToDisplay(Number(pkg.network_id));

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
          cost_price: resellerCost,
          selling_price: sellingPrice,
          validity: pkg.validity || "30 days",
        };
      })
    : [];

  return <StoreClient storeOwner={storeOwner} packages={packages} />;
}
