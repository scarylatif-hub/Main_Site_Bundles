"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/hooks/use-toast";
import { getStoreUrl } from "@/lib/app-config";
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
  Wallet,
} from "lucide-react";
import { WithdrawalDialog } from "@/components/reseller/withdrawal-dialog";
import { MoveToWalletDialog } from "@/components/reseller/move-to-wallet-dialog";
import { ResellerOrdersTable } from "@/components/reseller/reseller-orders-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Profile } from "@/lib/definitions";

type StoreStats = {
  totalEarnings: number;
  walletBalance: number;
  totalPackages: number;
  activePackages: number;
  totalOrders: number;
};

export default function ResellerDashboard() {
  const { user, userProfile, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StoreStats>({
    totalEarnings: 0,
    walletBalance: 0,
    totalPackages: 0,
    activePackages: 0,
    totalOrders: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [loading]);

  const [localProfile, setLocalProfile] = useState<Profile | null>(null);

  
  // Orders state
  const [ordersTab, setOrdersTab] = useState<"personal" | "store">("personal");
  const [personalOrders, setPersonalOrders] = useState<any[]>([]);
  const [storeOrders, setStoreOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile?.is_reseller) {
      fetchStats();
      fetchOrders("personal"); // Load personal orders initially
    }
  }, [userProfile]);

  useEffect(() => {
    if (ordersTab === "store" && storeOrders.length === 0) {
      fetchOrders("store");
    }
  }, [ordersTab]);

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

  const fetchOrders = async (type: "personal" | "store") => {
    if (!userProfile?.is_reseller) return;
    
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/reseller/orders?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (type === "personal") {
          setPersonalOrders(data.orders || []);
        } else {
          setStoreOrders(data.orders || []);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} orders:`, error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const copyStoreUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app";
    const storePath = userProfile?.reseller_slug ? `/store/${userProfile.reseller_slug}` : "";
    const fullUrl = `https://${baseUrl}${storePath}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Copied to clipboard",
      description: "Store URL has been copied to your clipboard.",
    });
  };

  if ((loading && !loadingTimeout) || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>{loadingTimeout ? "Taking longer than expected..." : "Loading..."}</div>
      </div>
    );
  }

  if (!userProfile?.is_reseller) {
    // Use useEffect to navigate during render, not during component render
    useEffect(() => {
      router.push("/profile");
    }, []);
    return null;
  }

  const storeUrl = userProfile?.reseller_slug ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${userProfile.reseller_slug}` : "";

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
              <CardTitle className="text-2xl">
                {userProfile?.store_name}
              </CardTitle>
              <CardDescription>
                {userProfile?.reseller_approved
                  ? "Active Store"
                  : "Pending Approval"}
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
              onClick={() => {
                const storeUrl = userProfile?.reseller_slug 
                  ? `https://${process.env.NEXT_PUBLIC_STORE_DOMAIN || "bundles-store.vercel.app"}/store/${userProfile.reseller_slug}`
                  : "#";
                window.open(storeUrl, "_blank");
              }}
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
                <p className="text-sm font-medium">Available Earnings</p>
              </div>
              <p className="text-xl font-bold">
                ₵{loadingStats ? "..." : stats.totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Available for withdrawal (from store profits)
              </p>
              {!loadingStats && (
                <WithdrawalDialog walletBalance={stats.totalEarnings} />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Total Earnings</p>
              </div>
              <p className="text-xl font-bold">
                ₵{loadingStats ? "..." : stats.totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Lifetime earnings from store</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Wallet Balance</p>
              </div>
              <p className="text-xl font-bold">
                ₵{loadingStats ? "..." : stats.walletBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Main site balance (for purchases)
              </p>
              {!loadingStats && stats.totalEarnings > 0 && (
                <MoveToWalletDialog availableEarnings={stats.totalEarnings} />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Total Orders</p>
              </div>
              <p className="text-xl font-bold">
                {loadingStats ? "..." : stats.totalOrders}
              </p>
              <p className="text-xs text-muted-foreground">Orders processed</p>
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

      {/* Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your Orders</CardTitle>
          <CardDescription>
            View your personal purchases and orders from your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={ordersTab} onValueChange={(v) => setOrdersTab(v as "personal" | "store")}>
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="personal">
                My Purchases ({personalOrders.length})
              </TabsTrigger>
              <TabsTrigger value="store">
                Store Orders ({storeOrders.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="personal">
              <ResellerOrdersTable
                orders={personalOrders}
                type="personal"
                onRefresh={() => fetchOrders("personal")}
                loading={loadingOrders && ordersTab === "personal"}
              />
            </TabsContent>
            
            <TabsContent value="store">
              <ResellerOrdersTable
                orders={storeOrders}
                type="store"
                onRefresh={() => fetchOrders("store")}
                loading={loadingOrders && ordersTab === "store"}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
