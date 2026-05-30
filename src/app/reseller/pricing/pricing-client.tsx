/**
 * src/app/reseller/pricing/pricing-client.tsx
 *
 * Pricing logic:
 *   floor_price   = MINIMUM_PRICES[network][gb]  (main site price — the floor)
 *   selling_price = floor_price × (1 + margin / 100)
 *   margin        ∈ [0, 50]
 *
 * At 0% margin  → store charges same as main site
 * At 50% margin → store charges floor × 1.5
 * Profit per sale = selling_price − floor_price
 */

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
import { getMinimumPrice } from "@/lib/minimum-prices";
import { Store, Globe, Save, RotateCcw } from "lucide-react";

// ── Types matching actual /api/packages response ──────────────────────────────

interface ApiPackage {
  id: string;           // e.g. "1" — string!
  network: {
    id: number;         // display network id: 1=MTN, 2=Telecel, 3=AirtelTigo
    name: string;       // "MTN" | "Telecel" | "AirtelTigo"
  };
  dataAmount: string;   // e.g. "1GB", "20GB"
  validity: string;     // e.g. "30 days"
  sharedBundle: number; // package volume in GB, not the DataKazina package ID
  price: number;        // provider cost price — NOT the floor, do not use as floor
}

interface StoredPrice {
  package_id: number;
  selling_price: number;
}

interface PricingClientProps {
  userId: string;
  currentMarkup: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NETWORK_ORDER = ["MTN", "Telecel", "AirtelTigo"];

/** Extract numeric GB value from label like "1GB", "20GB", "1.5GB" */
function parseGb(dataAmount: string): number | null {
  const m = String(dataAmount).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Normalise network name to the key used in MINIMUM_PRICES.
 * /api/packages returns "MTN", "Telecel", "AirtelTigo"
 * MINIMUM_PRICES keys are "MTN", "TELECEL", "AIRTELTIGO"
 * getMinimumPrice() calls toUpperCase() internally so pass name as-is.
 */
function getFloorPrice(pkg: ApiPackage): number | null {
  const gb = parseGb(pkg.dataAmount);
  if (gb == null) return null;
  return getMinimumPrice(pkg.network.name, gb);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PricingClient({ userId, currentMarkup }: PricingClientProps) {
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // margin keyed by pkg.id (string)
  const [margins, setMargins] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [globalMargin, setGlobalMargin] = useState<number>(
    Math.min(50, Math.max(0, (currentMarkup ?? 0) * 100)),
  );

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [pkgRes, priceRes] = await Promise.all([
          fetch("/api/packages"),
          fetch("/api/reseller/prices"),
        ]);

        if (!pkgRes.ok) throw new Error("Failed to load packages");
        const pkgData: ApiPackage[] = await pkgRes.json();
        const validPkgs = Array.isArray(pkgData) ? pkgData : [];
        setPackages(validPkgs);

        if (priceRes.ok) {
          const priceData: StoredPrice[] = await priceRes.json();
          const marginMap: Record<string, number> = {};

          for (const stored of Array.isArray(priceData) ? priceData : []) {
            const storedId = String(stored.package_id);
            const pkg = validPkgs.find((p) => p.id === storedId) ||
              validPkgs.find((p) => p.sharedBundle === Number(stored.package_id));
            if (!pkg) continue;

            const floor = getFloorPrice(pkg);
            if (floor == null || floor <= 0) continue;

            const storedPrice = Number(stored.selling_price);
            // Reconstruct margin from stored price and floor
            const margin = round2(
              Math.min(50, Math.max(0, ((storedPrice / floor) - 1) * 100)),
            );
            marginMap[pkg.id] = margin;
          }

          setMargins(marginMap);
        }
      } catch (err) {
        console.error("[PricingClient] Load error:", err);
        toast({
          title: "Failed to load packages",
          description: "Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  // ── Grouping + sorting ────────────────────────────────────────────────────
  const byNetwork = packages.reduce<Record<string, ApiPackage[]>>((acc, pkg) => {
    const key = pkg.network?.name ?? "Unknown";
    (acc[key] ??= []).push(pkg);
    return acc;
  }, {});

  const sortedNetworks = Object.keys(byNetwork).sort(
    (a, b) => {
      const ai = NETWORK_ORDER.indexOf(a);
      const bi = NETWORK_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
  );

  // ── Margin handlers ───────────────────────────────────────────────────────
  const handleMarginChange = (pkgId: string, raw: string) => {
    const val = parseFloat(raw);
    if (raw === "" || raw === "-") return; // still typing

    if (Number.isNaN(val) || val < 0 || val > 50) {
      toast({
        title: "Invalid margin",
        description: "Margin must be between 0% and 50%.",
        variant: "destructive",
      });
      return;
    }

    setMargins((prev) => ({ ...prev, [pkgId]: round2(val) }));
    setHasChanges(true);
  };

  const applyGlobalMargin = () => {
    const safe = round2(Math.min(50, Math.max(0, globalMargin)));
    setGlobalMargin(safe);
    const next: Record<string, number> = {};
    for (const pkg of packages) {
      if (getFloorPrice(pkg) != null) {
        next[pkg.id] = safe;
      }
    }
    setMargins(next);
    setHasChanges(true);
  };

  const resetAll = () => {
    setMargins({});
    setHasChanges(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const savePrices = async () => {
    setIsSaving(true);
    try {
      const payload = Object.entries(margins)
        .flatMap(([pkgId, margin]) => {
          const pkg = packages.find((p) => p.id === pkgId);
          if (!pkg) return [];
          if (getFloorPrice(pkg) == null) return [];
          return [{
            package_id: Number(pkg.id), // DataKazina package id → reseller_prices.package_id
            network_id: pkg.network.id,
            margin_percentage: margin,
          }];
        });

      if (payload.length === 0) {
        toast({ title: "Nothing to save", description: "Set at least one margin first." });
        return;
      }

      const res = await fetch("/api/reseller/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? err.message ?? "Failed to save");
      }

      toast({ title: "Prices saved", description: "Your store prices have been updated." });
      setHasChanges(false);
    } catch (err) {
      console.error("[PricingClient] Save error:", err);
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Per-package computed values ───────────────────────────────────────────
  const getDisplayPrice = (pkg: ApiPackage): number | null => {
    const floor = getFloorPrice(pkg);
    if (floor == null) return null;
    const margin = margins[pkg.id] ?? 0;
    return round2(floor * (1 + margin / 100));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Store Prices</h1>
          <p className="text-muted-foreground">
            Set profit margin above main website price.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetAll}
            disabled={!isEditing || Object.keys(margins).length === 0}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset All
          </Button>
          <Button
            variant={isEditing ? "default" : "outline"}
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? "Cancel" : "Edit Prices"}
          </Button>
        </div>
      </div>

      {/* Store pricing info card */}
      <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5" />
            Store Pricing
          </CardTitle>
          <CardDescription>
            Prices start at main site price (0% margin). Max 50% markup.
            Your profit = selling price − main site price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing && (
            <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
              <div className="flex-1">
                <Label htmlFor="global-margin" className="mb-2 block text-sm font-medium">
                  Apply margin to all packages (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="global-margin"
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={globalMargin}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setGlobalMargin(Number.isFinite(v) ? Math.min(50, Math.max(0, v)) : 0);
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% markup</span>
                  <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-600">
                    +{globalMargin}% profit
                  </span>
                </div>
              </div>
              <Button className="mt-6" onClick={applyGlobalMargin}>
                Apply to All
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>
                {Object.keys(margins).length} custom margin
                {Object.keys(margins).length !== 1 ? "s" : ""} set
              </span>
            </div>
            {hasChanges && (
              <Button onClick={savePrices} disabled={isSaving} size="sm">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Package grid */}
      <Card>
        <CardHeader>
          <CardTitle>Data Bundle Prices</CardTitle>
          <CardDescription>
            Prices your customers will see in your store.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No packages available.</p>
          ) : (
            <div className="space-y-6">
              {sortedNetworks.map((network) => (
                <div key={network}>
                  {/* Network badge */}
                  <div className="mb-3">
                    <Badge
                      variant="outline"
                      className={
                        network === "MTN"
                          ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                          : network === "AirtelTigo"
                            ? "border-blue-200 bg-blue-50 text-blue-800"
                            : "border-red-200 bg-red-50 text-red-800"
                      }
                    >
                      {network}
                    </Badge>
                  </div>

                  {/* Package cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {byNetwork[network]
                      .slice()
                      .sort((a, b) => (parseGb(a.dataAmount) ?? 0) - (parseGb(b.dataAmount) ?? 0))
                      .map((pkg) => {
                        const floor = getFloorPrice(pkg);
                        const displayPrice = getDisplayPrice(pkg);
                        const currentMargin = margins[pkg.id];
                        const hasCustom = currentMargin !== undefined;

                        // Skip packages with no floor price entry
                        if (floor == null) return null;

                        return (
                          <div
                            key={pkg.id}
                            className={`flex flex-col justify-between rounded-lg border p-3 ${
                              hasCustom
                                ? "border-blue-200 bg-blue-50"
                                : "bg-muted/30"
                            }`}
                          >
                            {/* Bundle size label */}
                            <div className="text-sm font-medium">{pkg.dataAmount}</div>

                            {isEditing ? (
                              /* Edit mode */
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="50"
                                    value={currentMargin ?? ""}
                                    placeholder="0"
                                    onChange={(e) => handleMarginChange(pkg.id, e.target.value)}
                                    className="h-8 w-16 text-sm"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Floor: GHS {floor.toFixed(2)}
                                </div>
                                {displayPrice != null && (
                                  <div className="text-xs font-medium text-blue-700">
                                    → GHS {displayPrice.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* View mode */
                              <div className="mt-2">
                                <div className="text-lg font-bold text-primary">
                                  GHS {(displayPrice ?? floor).toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Floor: GHS {floor.toFixed(2)}
                                </div>
                                {hasCustom && (
                                  <div className="text-xs text-blue-600">
                                    +{currentMargin}% margin
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