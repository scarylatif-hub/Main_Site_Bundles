import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { datakazinaAPI } from "@/lib/datakazina";
import { datakazinaNetworkIdToDisplay } from "@/lib/network-id-map";
import { getMinimumPrice } from "@/lib/minimum-prices";

async function buildMinimumPriceMap(): Promise<Map<number, number>> {
  const pkgResult = await datakazinaAPI.fetchDataPackages();
  if (!pkgResult.ok || !pkgResult.data) {
    throw new Error("Failed to fetch packages from provider");
  }

  const minPriceMap = new Map<number, number>();
  for (const pkg of pkgResult.data) {
    const packageId = Number(pkg.id);
    const displayNetworkId = datakazinaNetworkIdToDisplay(Number(pkg.network_id));
    const bundleSize = Number(pkg.volume || pkg.shared_bundle || 0);
    const networkName =
      displayNetworkId === 2
        ? "TELECEL"
        : displayNetworkId === 3
          ? "AIRTELTIGO"
          : "MTN";
    const minPrice = getMinimumPrice(networkName, bundleSize);
    if (minPrice !== null) {
      minPriceMap.set(packageId, minPrice);
    }
  }
  return minPriceMap;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("reseller_prices")
      .select("*")
      .eq("reseller_id", user.id);

    if (error) {
      console.error("Fetch prices error:", error);
      return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
    }

    const minPriceMap = await buildMinimumPriceMap();
    const safePrices = (data || []).map((price) => {
      const minPrice = minPriceMap.get(Number(price.package_id));
      return {
        ...price,
        selling_price:
          minPrice == null
            ? Number(price.selling_price)
            : Math.max(Number(price.selling_price), minPrice),
      };
    });

    console.log("Fetched prices for user:", user.id, "data:", safePrices);
    return NextResponse.json(safePrices);
  } catch (error) {
    console.error("Fetch prices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const prices = Array.isArray(body) ? body : [body];

    console.log("Saving prices for user:", user.id, "prices:", prices);

    const admin = createAdminClient();

    const minPriceMap = await buildMinimumPriceMap();

    // Validate each price. The client sends `selling_price`; keep `price`
    // as a backward-compatible fallback for older callers.
    const sanitizedPrices = [];
    for (const price of prices) {
      const packageId = Number(price.package_id);
      const storePrice = Number(price.selling_price ?? price.price);
      const minPrice = minPriceMap.get(packageId);

      if (
        !Number.isInteger(packageId) ||
        packageId <= 0 ||
        !Number.isFinite(storePrice) ||
        storePrice <= 0
      ) {
        return NextResponse.json(
          { error: "Invalid package or selling price" },
          { status: 400 }
        );
      }

      if (minPrice === undefined) {
        return NextResponse.json(
          { error: `Package ID ${packageId} not found or minimum price not defined` },
          { status: 400 }
        );
      }

      if (storePrice < minPrice) {
        return NextResponse.json(
          {
            error: `Price for package ${packageId} cannot be below GHS ${minPrice.toFixed(2)} (main site price)`,
            package_id: packageId,
            minimum_price: minPrice,
            provided_price: storePrice,
          },
          { status: 400 }
        );
      }

      sanitizedPrices.push({
        reseller_id: user.id,
        package_id: packageId,
        network_id: Number(price.network_id) || null,
        selling_price: Math.round(storePrice * 100) / 100,
      });
    }

    const { error } = await admin
      .from("reseller_prices")
      .upsert(sanitizedPrices, {
        onConflict: "reseller_id,package_id",
      });

    if (error) {
      console.error("Save prices error:", error);
      return NextResponse.json({ error: "Failed to save prices" }, { status: 500 });
    }

    console.log("Prices saved successfully for user:", user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save prices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
