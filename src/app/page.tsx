
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { PhoneInputForm } from '@/components/phone-input-form';
import type { NetworkName, Package } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ShoppingCart, Info, Zap, Shield, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/hooks/use-cart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { validatePhoneNumber } from '@/lib/networks';

export default function Home() {
  const { user, userProfile, refreshUser } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [detectedNetwork, setDetectedNetwork] = useState<NetworkName | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName | null>(null);
  const [allPackages, setAllPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');

  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

  const handleDepositSuccess = async (reference: any) => {
    if (!user) return;
    const amount = parseFloat(depositAmount);

    const { error } = await supabase.rpc('add_to_wallet_and_log_transaction', {
        p_user_id: user.id,
        p_amount: amount,
        p_transaction_type: 'deposit',
        p_status: 'success',
        p_transaction_code: reference.reference,
        p_description: `Paystack Deposit: ${reference.reference}`
    });

    if (error) {
        toast({ title: 'Error', description: 'Failed to update wallet balance.', variant: 'destructive'});
    } else {
        toast({ title: "Deposit Successful!", description: `GHS ${amount.toFixed(2)} has been added to your wallet.` });
        if(refreshUser) refreshUser();
        setDepositAmount('');
    }
  };

  const paystackConfig = {
      reference: `TXN-${Date.now()}`,
      email: user?.email || '',
      amount: Math.round(parseFloat(depositAmount || '0') * 100),
      publicKey: paystackPublicKey,
      currency: 'GHS' as const,
  };
  const initializePayment = usePaystackPayment(paystackConfig);

  const handleProceedToPayment = () => {
      const amount = parseFloat(depositAmount);
      if (!user?.email) {
          toast({ title: 'Error', description: 'User email is not available.', variant: 'destructive'});
          return;
      }
      if (isNaN(amount) || amount < 1) {
          toast({ title: 'Invalid Amount', description: 'Please enter an amount of at least GHS 1.', variant: 'destructive'});
          return;
      }
      if (!paystackPublicKey) {
          toast({ title: 'Configuration Error', description: 'Payment gateway is not configured.', variant: 'destructive'});
          return;
      }
      initializePayment({
        ...paystackConfig,
        amount: Math.round(amount * 100),
        onSuccess: handleDepositSuccess,
        onClose: () => {},
      });
  };

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8" id="deposit">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balance: GHS {userProfile?.wallet_balance?.toFixed(2) || '0.00'}</CardTitle>
              <CardDescription>Top up your wallet via Paystack</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-1">
                <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Amount (GHS)" min="1" />
              </div>
              <Button onClick={handleProceedToPayment} disabled={!user?.email || parseFloat(depositAmount) < 1}>
                Deposit Funds
              </Button>
            </CardContent>
          </Card>
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
