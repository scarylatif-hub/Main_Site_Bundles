"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "@/lib/definitions";
import { Store, Globe } from "lucide-react";

interface PricingClientProps {
  userId: string;
  currentMarkup: number;
}

export default function PricingClient({
  userId,
  currentMarkup,
}: PricingClientProps) {
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/packages");
        if (!response.ok) throw new Error("Failed to fetch packages");
        const data = await response.json();
        setAllPackages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setAllPackages([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPackages();
  }, []);

  // Group packages by network
  const packagesByNetwork = allPackages.reduce((acc, pkg) => {
    const network = pkg.network.name;
    if (!acc[network]) acc[network] = [];
    acc[network].push(pkg);
    return acc;
  }, {} as Record<string, Package[]>);

  // Sort networks: MTN, AirtelTigo, Telecel
  const networkOrder = ["MTN", "AirtelTigo", "Telecel"];
  const sortedNetworks = Object.keys(packagesByNetwork).sort(
    (a, b) => networkOrder.indexOf(a) - networkOrder.indexOf(b)
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Your Store Prices</h1>
        <p className="text-muted-foreground">
          Your customers will see the same prices as the main website. 
          All data bundles are sold at standard retail prices.
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Pricing
          </CardTitle>
          <CardDescription>
            Your store sells data bundles at the same prices as the main website.
            No markup or hidden fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Same prices as bundle-ghana.vercel.app</span>
          </div>
        </CardContent>
      </Card>

      {/* Price List */}
      <Card>
        <CardHeader>
          <CardTitle>Data Bundle Prices</CardTitle>
          <CardDescription>
            These are the prices your customers will see in your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-12 bg-muted rounded animate-pulse" />
              <div className="h-12 bg-muted rounded animate-pulse" />
              <div className="h-12 bg-muted rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-6">
              {sortedNetworks.map((network) => (
                <div key={network}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={
                      network === "MTN" ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
                      network === "AirtelTigo" ? "bg-blue-50 text-blue-800 border-blue-200" :
                      "bg-red-50 text-red-800 border-red-200"
                    }>
                      {network}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {packagesByNetwork[network]
                      .sort((a, b) => parseFloat(a.dataAmount) - parseFloat(b.dataAmount))
                      .map((pkg) => (
                        <div
                          key={pkg.id}
                          className="border rounded-lg p-3 bg-muted/30 flex flex-col justify-between"
                        >
                          <div className="text-sm font-medium">{pkg.dataAmount}</div>
                          <div className="text-lg font-bold text-primary">
                            GHS {parseFloat(pkg.price.toString()).toFixed(2)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
