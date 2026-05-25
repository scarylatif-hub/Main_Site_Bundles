import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    console.log("Fetched prices for user:", user.id, "data:", data);
    return NextResponse.json(data || []);
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

    // Fetch main packages to get minimum allowed prices (API price + profit margin)
    const { data: mainPackages, error: packagesError } = await admin
      .from("packages")
      .select("id, price");

    if (packagesError) {
      console.error("Fetch packages error:", packagesError);
      return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
    }

    // Create a map of package_id to minimum allowed price
    const minPriceMap = new Map<number, number>();
    for (const pkg of mainPackages ?? []) {
      minPriceMap.set(pkg.id, Number(pkg.price));
    }

    // Validate each price
    for (const price of prices) {
      const packageId = Number(price.package_id);
      const storePrice = Number(price.price);
      const minPrice = minPriceMap.get(packageId);

      if (minPrice === undefined) {
        return NextResponse.json(
          { error: `Package ID ${packageId} not found` },
          { status: 400 }
        );
      }

      if (storePrice < minPrice) {
        return NextResponse.json(
          {
            error: `Price for package ${packageId} cannot be below ${minPrice.toFixed(2)} (main API price + profit margin)`,
            package_id: packageId,
            minimum_price: minPrice,
            provided_price: storePrice,
          },
          { status: 400 }
        );
      }
    }

    const { error } = await admin
      .from("reseller_prices")
      .upsert(prices, {
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
