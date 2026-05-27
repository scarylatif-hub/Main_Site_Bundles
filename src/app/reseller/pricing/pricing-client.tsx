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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Package } from "@/lib/definitions";
import { Store, Globe, Save, RotateCcw } from "lucide-react";

interface PricingClientProps {
  userId: string;
  currentMarkup: number;
}

interface ResellerPrice {
  package_id: number;
  selling_price: number;
}

export default function PricingClient({
  userId,
  currentMarkup,
}: PricingClientProps) {
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [profitMargin, setProfitMargin] = useState<number>(
    Math.max(0, currentMarkup * 100 || 20)
  );

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoading(true);
        const [packagesResponse, pricesResponse] = await Promise.all([
          fetch("/api/packages"),
          fetch("/api/reseller/prices")
        ]);
        
        if (!packagesResponse.ok) throw new Error("Failed to fetch packages");
        const packagesData = await packagesResponse.json();
        setAllPackages(Array.isArray(packagesData) ? packagesData : []);
        
        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json();
          const packageMap = new Map(
            (Array.isArray(packagesData) ? packagesData : []).map((pkg: Package) => [
              String(pkg.id),
              pkg,
            ])
          );
          const priceMap: Record<string, number> = {};
          (pricesData || []).forEach((price: ResellerPrice) => {
            const packageId = String(price.package_id);
            const pkg = packageMap.get(packageId);
            const minimumPrice = pkg ? Number(pkg.price) : 0;
            priceMap[packageId] = Math.max(
              Number(price.selling_price),
              minimumPrice
            );
          });
          setCustomPrices(priceMap);
        }
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

  const handlePriceChange = (packageId: string, newPrice: string) => {
    const pkg = allPackages.find((pkg) => pkg.id === packageId);
    if (!pkg) return;

    const minimumPrice = parseFloat(pkg.price.toString());
    const price = parseFloat(newPrice);
    if (!Number.isNaN(price) && price > 0) {
      const safePrice = Math.max(price, minimumPrice);
      setCustomPrices(prev => ({ ...prev, [packageId]: safePrice }));
      setHasChanges(true);

      if (price < minimumPrice) {
        toast({
          title: "Price too low",
          description: `Store price cannot be below GHS ${minimumPrice.toFixed(2)}.`,
          variant: "destructive",
        });
      }
    }
  };

  const resetToDefault = (packageId: string) => {
    setCustomPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[packageId];
      return newPrices;
    });
    setHasChanges(true);
  };

  const applyMarginToAllPackages = () => {
    const newPrices: Record<string, number> = {};
    const safeMargin = Math.max(0, profitMargin);
    if (safeMargin !== profitMargin) setProfitMargin(safeMargin);

    allPackages.forEach(pkg => {
      const basePrice = parseFloat(pkg.price.toString());
      const newPrice = basePrice * (1 + safeMargin / 100);
      newPrices[pkg.id] = Math.max(basePrice, Math.round(newPrice * 100) / 100);
    });
    setCustomPrices(newPrices);
    setHasChanges(true);
  };

  const resetAllToDefault = () => {
    setCustomPrices({});
    setHasChanges(true);
  };

  const savePrices = async () => {
    setIsSaving(true);
    try {
      const pricesToSave = Object.entries(customPrices).map(([packageId, sellingPrice]) => {
        const pkg = allPackages.find(pkg => pkg.id === packageId);
        if (!pkg) {
          console.warn(`Package not found for ID: ${packageId}`);
          return null;
        }
        const minimumPrice = parseFloat(pkg.price.toString());
        if (!Number.isFinite(sellingPrice) || sellingPrice < minimumPrice) {
          throw new Error(
            `${pkg.dataAmount} cannot be below GHS ${minimumPrice.toFixed(2)}.`
          );
        }
        return {
          reseller_id: userId,
          package_id: parseInt(packageId), // Convert to integer as expected by DB
          network_id: pkg.network?.id || 1, // Include network_id from package data with fallback
          selling_price: sellingPrice
        };
      }).filter(Boolean); // Filter out null entries

      const response = await fetch("/api/reseller/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricesToSave)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to save prices");
      }
      
      toast({
        title: "Prices saved",
        description: "Your custom prices have been updated successfully."
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Save prices error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save prices. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDisplayPrice = (pkg: Package) => {
    const defaultPrice = parseFloat(pkg.price.toString());
    const customPrice = customPrices[pkg.id];
    return customPrice == null ? defaultPrice : Math.max(customPrice, defaultPrice);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Your Store Prices</h1>
            <p className="text-muted-foreground">
              Set custom prices for your store or use default prices.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetAllToDefault}
              disabled={!isEditing || Object.keys(customPrices).length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
            <Button
              onClick={() => setIsEditing(!isEditing)}
              variant={isEditing ? "default" : "outline"}
            >
              {isEditing ? "Cancel Editing" : "Edit Prices"}
            </Button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Pricing
          </CardTitle>
          <CardDescription>
            {isEditing 
              ? "Set custom prices for your data bundles. Use profit margin for bulk changes or edit individually."
              : "Your store uses custom pricing. Click 'Edit Prices' to modify your prices."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing && (
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
              <div className="flex-1">
                <Label htmlFor="margin" className="text-sm font-medium mb-2 block">
                  Profit Margin (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="margin"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={profitMargin}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setProfitMargin(Number.isFinite(value) ? Math.max(0, value) : 0);
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% markup</span>
                  <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    +{profitMargin}% profit
                  </div>
                </div>
              </div>
              <Button
                onClick={applyMarginToAllPackages}
                className="mt-6"
              >
                Apply to All Packages
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>{Object.keys(customPrices).length} custom price{Object.keys(customPrices).length !== 1 ? 's' : ''} set</span>
            </div>
            {hasChanges && (
              <Button
                onClick={savePrices}
                disabled={isSaving}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            )}
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
                      .map((pkg) => {
                        const displayPrice = getDisplayPrice(pkg);
                        const isCustom = customPrices[pkg.id] !== undefined;
                        const defaultPrice = parseFloat(pkg.price.toString());
                        
                        return (
                          <div
                            key={pkg.id}
                            className={`border rounded-lg p-3 flex flex-col justify-between ${
                              isCustom ? 'bg-blue-50 border-blue-200' : 'bg-muted/30'
                            }`}
                          >
                            <div className="text-sm font-medium">{pkg.dataAmount}</div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">GHS</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={defaultPrice}
                                    value={displayPrice}
                                    onChange={(e) => handlePriceChange(pkg.id, e.target.value)}
                                    onBlur={(e) => handlePriceChange(pkg.id, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                {isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resetToDefault(pkg.id)}
                                    className="h-6 text-xs px-2"
                                  >
                                    Reset to GHS {defaultPrice.toFixed(2)}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="text-lg font-bold text-primary">
                                  GHS {displayPrice.toFixed(2)}
                                </div>
                                {isCustom && (
                                  <div className="text-xs text-blue-600">
                                    Custom (was GHS {defaultPrice.toFixed(2)})
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
