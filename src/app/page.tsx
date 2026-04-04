
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { PhoneInputForm } from '@/components/phone-input-form';
import type { NetworkName, Package } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ShoppingCart, Info } from 'lucide-react';
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
        console.error('Error updating balance:', error);
        toast({ title: 'Error', description: 'Failed to update wallet balance.', variant: 'destructive'});
    } else {
        toast({
            title: "Deposit Successful!",
            description: `GHS ${amount.toFixed(2)} has been added to your wallet.`
        });
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
      
      const config = {
        ...paystackConfig,
        amount: Math.round(amount * 100),
        reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        onSuccess: handleDepositSuccess,
        onClose: () => {},
      };

      initializePayment(config);
  };

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/packages');
        if (!response.ok) throw new Error('Failed to fetch packages');
        const data = await response.json();
        setAllPackages(Array.isArray(data) ? data : data.packages || []);
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
      toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number before buying.", variant: "destructive" });
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
        <p className="mt-2 text-muted-foreground">Fast, easy, and instant delivery</p>
      </motion.div>

       {user && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8" id="deposit">
          <Card>
              <CardHeader>
                  <CardTitle>Add Money to Wallet</CardTitle>
                  <CardDescription>Enter an amount to deposit via Paystack.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                  {!paystackPublicKey ? (
                      <Alert variant="destructive">
                          <Info className="h-4 w-4" />
                          <AlertTitle>Configuration Error</AlertTitle>
                          <AlertDescription>Payment gateway is not configured.</AlertDescription>
                      </Alert>
                  ) : (
                      <div className="grid gap-2">
                          <Label htmlFor="amount">Amount (GHS)</Label>
                          <Input id="amount" type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Min: 1 GHS" min="1" step="0.01" />
                      </div>
                  )}
              </CardContent>
              <CardFooter>
                 <Button onClick={handleProceedToPayment} disabled={!user?.email || parseFloat(depositAmount) < 1 || !paystackPublicKey} className="w-full">Proceed to Payment</Button>
              </CardFooter>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            {user && (
              <div className="flex items-center justify-between rounded-lg bg-accent/10 p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-accent" />
                  <span className="font-semibold">Balance</span>
                </div>
                <span className="text-2xl font-bold text-accent">GHS {userProfile?.wallet_balance?.toFixed(2) || '0.00'}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
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
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {isLoading ? (
                   <motion.div className="space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
                   </motion.div>
                ) : !selectedNetwork ? (
                  <div className="py-12 text-center text-muted-foreground">Please select a network</div>
                ) : filteredPackages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No packages available for {selectedNetwork}</div>
                ) : (
                  <motion.div key={selectedNetwork} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {filteredPackages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between rounded-lg border p-4 hover:border-accent hover:bg-accent/5 cursor-pointer group" onClick={() => handleBuyPackage(pkg)}>
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent font-bold">
                            {pkg.dataAmount.replace(/[^0-9.]/g, '')}<span className="text-xs ml-1">{pkg.dataAmount.replace(/[0-9.]/g, '').trim()}</span>
                          </div>
                          <div>
                            <p className="font-semibold">{pkg.dataAmount}</p>
                            <p className="text-xs text-muted-foreground">{pkg.validity || 'Non-expiry'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold">GHS {pkg.price.toFixed(2)}</p>
                          <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"><ShoppingCart className="h-4 w-4 mr-1" />Buy</Button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
