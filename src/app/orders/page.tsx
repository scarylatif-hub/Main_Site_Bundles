"use client";

// src/app/orders/page.tsx

import { PageHeader } from "@/components/page-header";
import { OrdersTable } from "@/components/orders-table";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState, useCallback } from "react";
import type { Transaction } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // cache: "no-store" ensures every call hits the server fresh so the
      // 3-tier status resolution always runs:
      //   1) admin override  → provider_order_overrides table (wins if set)
      //   2) live API status → external provider all-orders endpoint
      //   3) DB fallback     → transactions.status column
      const res = await fetch("/api/orders/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Error fetching orders:", err);
        toast({
          variant: "destructive",
          title: "Could not load orders",
          description: "Please try refreshing the page.",
        });
        setTransactions([]);
        return;
      }

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchTransactions:", e);
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Could not reach the server. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchTransactions();
    }
  }, [authLoading, fetchTransactions]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12 text-center">
        <PageHeader
          title="My Orders"
          description="Please log in to view your orders."
        />
        <Button asChild className="mt-4">
          <Link href="/login">Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <PageHeader
        title="My Orders"
        description="View your recent data bundle purchases and their status."
      />
      <div className="mt-8">
        <Card>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <OrdersTable
                data={transactions}
                onRefresh={fetchTransactions}
                isAdmin={false}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}