"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Store,
  Package,
  DollarSign,
  TrendingUp,
  Edit,
  Eye,
} from "lucide-react";

type StoreStats = {
  totalEarnings: number;
  totalPackages: number;
  activePackages: number;
  totalOrders: number;
};

export default function ResellerDashboard() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StoreStats>({
    totalEarnings: 0,
    totalPackages: 0,
    activePackages: 0,
    totalOrders: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile?.is_reseller) {
      fetchStats();
    }
  }, [userProfile]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/reseller/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const copyStoreUrl = () => {
    const url = `${window.location.origin}/store/${userProfile?.reseller_slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied to clipboard",
      description: "Store URL has been copied to your clipboard.",
    });
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!userProfile?.is_reseller) {
    router.push("/profile");
    return null;
  }

  const storeUrl = `${window.location.origin}/store/${userProfile?.reseller_slug}`;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Store Dashboard"
        description="Manage your store and track your earnings"
      />

      {/* Store Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{userProfile?.store_name}</CardTitle>
              <CardDescription>
                {userProfile?.reseller_approved ? "Active Store" : "Pending Approval"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Manage your store settings and view detailed reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 h-16 flex-col gap-1 sm:flex-row sm:gap-2 sm:h-12"
              onClick={() => router.push("/reseller/edit-store")}
            >
              <Edit className="h-4 w-4" />
              <span className="text-sm">Edit Store</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-16 flex-col gap-1 sm:flex-row sm:gap-2 sm:h-12"
              onClick={() => router.push("/reseller/pricing")}
            >
              <Package className="h-4 w-4" />
              <span className="text-sm">Manage Packages</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-16 flex-col gap-1 sm:flex-row sm:gap-2 sm:h-12"
              onClick={() => window.open(`/store/${userProfile?.reseller_slug}`, '_blank')}
            >
              <Eye className="h-4 w-4" />
              <span className="text-sm">View Store</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Total Earnings</p>
              </div>
              <p className="text-xl font-bold">
                ₵{loadingStats ? "..." : stats.totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Total Packages</p>
              </div>
              <p className="text-xl font-bold">
                {loadingStats ? "..." : stats.totalPackages}
              </p>
              <p className="text-xs text-muted-foreground">
                Available packages
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Active Packages</p>
              </div>
              <p className="text-xl font-bold">
                {loadingStats ? "..." : stats.activePackages}
              </p>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Total Orders</p>
              </div>
              <p className="text-xl font-bold">
                {loadingStats ? "..." : stats.totalOrders}
              </p>
              <p className="text-xs text-muted-foreground">
                Orders processed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store URL Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Store URL</CardTitle>
          <CardDescription>
            Share this link with customers to direct them to your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={storeUrl}
              className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
            />
            <Button onClick={copyStoreUrl} variant="outline" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
