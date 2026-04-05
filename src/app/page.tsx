
"use client";

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

export default function Home() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkName | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/packages');
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
      .filter((pkg) => pkg.network?.name?.toLowerCase() === selectedNetwork.toLowerCase())
      .sort((a, b) => a.price - b.price);
  }, [selectedNetwork, allPackages]);

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
      sharedBundle: pkg.sharedBundle,
      price: pkg.price,
      dataAmount: pkg.dataAmount,
    });
  };

  const networks: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">Buy Data Bundle</h1>
        <p className="mt-2 text-muted-foreground">Fast, easy, and instant delivery to any network</p>
      </motion.div>

      {user && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <WalletDepositCard id="deposit" />
        </motion.div>
      )}

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
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {isLoading ? (
               <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
               </div>
            ) : !selectedNetwork ? (
              <div className="py-12 text-center text-muted-foreground">Choose a network to see available bundles</div>
            ) : filteredPackages.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No bundles found for {selectedNetwork}</div>
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
                    <div className="flex items-center gap-4">
                      <p className="font-bold">GHS {pkg.price.toFixed(2)}</p>
                      <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"><ShoppingCart className="h-4 w-4 mr-1" />Buy</Button>
                    </div>
                  </div>
                ))}
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
    </div>
  );
}
