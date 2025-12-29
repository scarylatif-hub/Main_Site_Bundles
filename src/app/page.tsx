"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { PhoneInputForm } from '@/components/phone-input-form';
import type { Package, NetworkName } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/hooks/use-cart';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const networks: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];

export default function Home() {
  const { user, userProfile } = useAuth();
  const { addToCart } = useCart();
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
        if (!response.ok) {
          throw new Error('Failed to fetch packages');
        }
        const data = await response.json();
        setAllPackages(data);
      } catch (error) {
        console.error(error);
        // Here you might want to set an error state and display a message to the user
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

  const handleNetworkToggle = (network: NetworkName) => {
    setSelectedNetwork(network);
  };

  const filteredPackages = useMemo(() => {
    if (!selectedNetwork) return [];
    return allPackages.filter((pkg: Package) => pkg.network.name === selectedNetwork)
      .sort((a, b) => a.price - b.price);
  }, [selectedNetwork, allPackages]);

  const handleBuyPackage = (pkg: Package) => {
    if (!user) {
      alert('Please login to purchase');
      return;
    }
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }
    
    addToCart({
      recipientMsisdn: phoneNumber,
      networkId: pkg.network.id,
      networkName: pkg.network.name,
      sharedBundle: pkg.sharedBundle,
      price: pkg.price,
      dataAmount: pkg.dataAmount,
    });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <h1 className="font-headline text-4xl font-bold tracking-tight md:text-5xl">
          Buy Data Bundle
        </h1>
        <p className="mt-2 text-muted-foreground">
          Fast, easy, and instant delivery
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="shadow-lg">
          <CardHeader className="space-y-4">
            {/* Balance Display */}
            {user && (
              <div className="flex items-center justify-between rounded-lg bg-accent/10 p-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-accent" />
                  <span className="font-semibold">Balance</span>
                </div>
                <span className="text-2xl font-bold text-accent">
                  GHS {userProfile?.wallet_balance?.toFixed(2) || '0.00'}
                </span>
              </div>
            )}

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <PhoneInputForm onPhoneNumberChange={handlePhoneNumberChange} />
            </div>

            {/* Network Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Network</label>
              <div className="flex gap-2">
                {networks.map((network) => (
                  <Button
                    key={network}
                    variant={selectedNetwork === network ? "default" : "outline"}
                    onClick={() => handleNetworkToggle(network)}
                    className={cn(
                      "flex-1 relative",
                      detectedNetwork === network && selectedNetwork !== network && "border-accent border-2"
                    )}
                  >
                    {network}
                    {detectedNetwork === network && selectedNetwork !== network && (
                      <Badge className="absolute -top-2 -right-2 h-5 px-1.5 text-xs" variant="secondary">
                        Detected
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              {detectedNetwork && (
                <p className="text-xs text-muted-foreground">
                  Detected network: {detectedNetwork}
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Package List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">
                  {selectedNetwork ? `${selectedNetwork} Packages` : 'Select a Network'}
                </h3>
                {selectedNetwork && !isLoading &&(
                  <span className="text-sm text-muted-foreground">
                    {filteredPackages.length} packages available
                  </span>
                )}
              </div>

              <AnimatePresence mode="wait">
                {isLoading ? (
                   <motion.div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                      ))}
                   </motion.div>
                ) : !selectedNetwork ? (
                  <motion.div
                    key="no-network"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center text-muted-foreground"
                  >
                    Please select a network to view packages
                  </motion.div>
                ) : filteredPackages.length === 0 ? (
                  <motion.div
                    key="no-packages"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No packages available for {selectedNetwork}
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedNetwork}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 max-h-[500px] overflow-y-auto pr-2"
                  >
                    {filteredPackages.map((pkg, index) => (
                      <motion.div
                        key={pkg.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-4 transition-all hover:border-accent hover:bg-accent/5",
                          "cursor-pointer group"
                        )}
                        onClick={() => handleBuyPackage(pkg)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent font-bold">
                            {pkg.dataAmount.split(' ')[0]}
                            <span className="text-xs ml-1">{pkg.dataAmount.split(' ')[1]}</span>
                          </div>
                          <div>
                            <p className="font-semibold">{pkg.dataAmount}</p>
                            <p className="text-xs text-muted-foreground">
                              {pkg.validity || 'Non-expiry'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold">GHS {pkg.price.toFixed(2)}</p>
                          </div>
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyPackage(pkg);
                            }}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Buy
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-8 grid gap-4 sm:grid-cols-3"
      >
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-2 text-3xl">⚡</div>
            <h3 className="font-semibold">Instant Delivery</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Data credited within seconds
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-2 text-3xl">💳</div>
            <h3 className="font-semibold">Secure Payment</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Safe and encrypted transactions
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="mb-2 text-3xl">📱</div>
            <h3 className="font-semibold">All Networks</h3>
            <p className="text-xs text-muted-foreground mt-1">
              MTN, Telecel & AirtelTigo supported
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
