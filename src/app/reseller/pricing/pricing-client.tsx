"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Package } from "@/lib/definitions";

interface PricingClientProps {
  userId: string;
  currentMarkup: number;
}

// Example package prices from DataKazina
const EXAMPLE_PACKAGES = [
  { name: "1GB Data Bundle", cost: 5.0 },
  { name: "2GB Data Bundle", cost: 10.0 },
  { name: "5GB Data Bundle", cost: 20.0 },
];

export default function PricingClient({
  userId,
  currentMarkup,
}: PricingClientProps) {
  const [markup, setMarkup] = useState(currentMarkup * 100);
  const [saving, setSaving] = useState(false);
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

  const handleSaveMarkup = async () => {
    const markupPercent = Number(markup);
    if (markupPercent < 5 || markupPercent > 20) {
      toast({
        title: "Invalid Markup",
        description: "Markup must be between 5% and 20%",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/reseller/markup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profit_margin: markupPercent / 100 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save markup");
      }

      toast({
        title: "Success",
        description: "Markup saved successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving markup:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save markup",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const calculateSellingPrice = (cost: number) => {
    return cost * (1 + markup / 100);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Manage Store Prices</h1>
        <p className="text-muted-foreground">
          Set your profit margin. This percentage markup will apply to all
          packages.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit Margin</CardTitle>
          <CardDescription>
            Set your markup percentage (5% - 20%). This will be applied to all
            package prices. Example: If a package costs GHS 10 and you set 10%
            markup, customers will pay GHS 11.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="markup">Markup Percentage</Label>
              <div className="flex items-center gap-4 mt-2">
                <Input
                  id="markup"
                  type="number"
                  step="0.1"
                  min={5}
                  max={20}
                  value={markup}
                  onChange={(e) => setMarkup(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Current markup: {currentMarkup * 100}%
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm font-medium mb-3">Live Price Examples</p>
              <div className="space-y-2">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading packages...
                  </p>
                ) : allPackages.length !== 0 ? (
                  allPackages.map((pkg, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-muted-foreground">
                        {pkg.network.name} {pkg.dataAmount}
                      </span>
                      <div className="text-right grid ">
                        <div className="text-muted-foreground flex justify-end">
                          Cost: GHS{" "}
                          {parseFloat(pkg.price.toString()).toFixed(2)}
                        </div>
                        <div className="font-semibold">
                          Selling: GHS{" "}
                          {calculateSellingPrice(
                            parseFloat(pkg.price.toString()),
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="">
                    <p className="text-sm text-muted-foreground">
                      No packages available to show examples.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveMarkup} disabled={saving}>
              {saving ? "Saving..." : "Save Markup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
