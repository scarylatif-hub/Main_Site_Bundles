"use client";

import { notFound } from "next/navigation";
import { isStoreApp } from "@/lib/app-config";
import React, { useState, useMemo, useEffect } from 'react';
import { PhoneInputForm } from '@/components/phone-input-form';
import type { NetworkName, Package } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Info, Zap, Shield, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/hooks/use-cart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { validatePhoneNumber } from '@/lib/networks';
import { WalletDepositCard } from '@/components/wallet-deposit-card';
import FloatingWhatsApp from '@/components/floating-whatsapp';

export default function Home() {
  if (isStoreApp) {
    notFound();
  }

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkName | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mtnSubType, setMtnSubType] = useState<'regular' | 'express'>('regular');

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/packages', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to fetch packages');
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

  const handlePhoneNumberChange = (number: string, network: NetworkName | null) => {
    setPhoneNumber(number);
    setDetectedNetwork(network);
    if (network && !selectedNetwork) {
      setSelectedNetwork(network);
    }
  };

  const filteredPackages = useMemo(() => {
    if (!selectedNetwork) return [];
    return allPackages
      .filter((pkg) => {
        const matchesNetwork = pkg.network?.name?.toLowerCase() === selectedNetwork.toLowerCase();
        if (!matchesNetwork) return false;

        // If MTN, filter by active sub-type
        if (selectedNetwork === 'MTN') {
          if (mtnSubType === 'express') {
            return pkg.network.id === 6;
          } else {
            return pkg.network.id === 1;
          }
        }

        return true;
      })
      .sort((a, b) => a.price - b.price);
  }, [selectedNetwork, mtnSubType, allPackages]);

  const handleBuyPackage = (pkg: Package) => {
    if (!user) {
      toast({ title: "Please Login", description: "You need to be logged in to purchase a package.", variant: "destructive" });
      return;
    }
    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number.", variant: "destructive" });
      return;
    }
    addToCart({
      recipientMsisdn: phoneNumber,
      networkId: pkg.network.id,
      networkName: pkg.network.name as NetworkName,
      providerNetworkId: pkg.providerNetworkId,
      sharedBundle: pkg.sharedBundle,
      price: pkg.price,
      dataAmount: pkg.dataAmount,
    });
  };

  const networks: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];

  return (
    <div className="container mx-auto max-w-4xl px-4 pt-2 pb-8 sm:pt-4 sm:pb-12">
      <div className="mb-4 space-y-3 sm:space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">
            Buy Data Bundle
          </h1>
        </motion.div>

        {user && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <WalletDepositCard id="deposit" />
          </motion.div>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient Phone Number</label>
            <PhoneInputForm onPhoneNumberChange={handlePhoneNumberChange} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Network</label>
            <div className="flex gap-2">
              {networks.map((network) => (
                <Button key={network} variant={selectedNetwork === network ? "default" : "outline"} onClick={() => setSelectedNetwork(network)} className="flex-1">
                  {network}
                </Button>
              ))}
            </div>
            {/* Thhh */}
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {isLoading ? (
               <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
               </div>
            ) : (
              <div className="space-y-4">
                {selectedNetwork === 'MTN' && (
                  <div className="flex justify-center gap-2 p-1 bg-muted rounded-lg max-w-xs mx-auto mb-2">
                    <button
                      onClick={() => setMtnSubType('regular')}
                      className={cn(
                        "flex-1 px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                        mtnSubType === 'regular'
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Regular
                    </button>
                    <button
                      onClick={() => setMtnSubType('express')}
                      className={cn(
                        "flex-1 px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                        mtnSubType === 'express'
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Express
                    </button>
                  </div>
                )}

                {filteredPackages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No bundles found for {selectedNetwork} {selectedNetwork === 'MTN' && `(${mtnSubType})`}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {filteredPackages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between rounded-lg border p-4 hover:border-accent hover:bg-accent/5 cursor-pointer group" onClick={() => handleBuyPackage(pkg)}>
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent font-bold text-sm">
                            {pkg.dataAmount.replace(/[^0-9.]/g, '')}
                          </div>
                          <div>
                            <p className="font-semibold">{pkg.dataAmount}</p>
                            <p className="text-xs text-muted-foreground">{pkg.validity || 'Non-expiry'}</p>
                          </div>
                        </div>
                        {/* hh */}
                        <div className="flex items-center gap-4">
                          <p className="font-bold">GHS {pkg.price.toFixed(2)}</p>
                          <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"><ShoppingCart className="h-4 w-4 mr-1" />Buy</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          { icon: Zap, title: "Instant", desc: "Credits in seconds" },
          { icon: Shield, title: "Secure", desc: "Bank-level safety" },
          { icon: Smartphone, title: "Universal", desc: "All GH networks" }
        ].map((feat, i) => (
          <div key={i} className="flex flex-col items-center text-center p-4 border rounded-xl bg-card">
            <feat.icon className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-bold">{feat.title}</h3>
            <p className="text-sm text-muted-foreground">{feat.desc}</p>
          </div>
        ))}
      </div>

      <FloatingWhatsApp />
    </div>
  );
}
