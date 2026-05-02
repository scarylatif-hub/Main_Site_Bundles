"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import type { Profile } from "@/context/auth-context";

// Load Paystack script dynamically
declare global {
  interface Window {
    PaystackPop: any;
  }
}

type Package = {
  id: number;
  network_id: number;
  name: string;
  data_amount: string;
  cost_price: number;
  selling_price: number;
  validity?: string;
  volume?: string;
  bundle?: string;
};

type CustomerOrder = {
  id: string;
  package_id: number;
  network_id: number;
  phone_number: string;
  amount: number;
  status: string;
  created_at: string;
  package_name?: string;
  data_amount?: string;
};

interface StoreClientProps {
  storeOwner: Profile;
  packages: Package[];
}

// Network prefix mappings
const NETWORK_PREFIXES = {
  MTN: ["024", "025", "053", "054", "055", "059"],
  VODAFONE: ["020", "050"],
  AIRTELTIGO: ["026", "027", "056", "057"],
};

const NETWORK_NAME_MAP: Record<number, string> = {
  1: "AirtelTigo",
  2: "Telecel",
  3: "MTN",
  4: "AirtelTigo",
  5: "MTN AFA",
};

const ALLOWED_NETWORKS = [2, 3, 4]; // Telecel, MTN, AirtelTigo (DataKazina IDs)

export default function StoreClient({ storeOwner, packages }: StoreClientProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState<"buy" | "history">("buy");
  const [orderHistory, setOrderHistory] = useState<CustomerOrder[]>([]);
  const [detectedNetwork, setDetectedNetwork] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load customer info from cookies on mount
  useEffect(() => {
    const savedPhone = getCookie("store_phone");
    const savedNickname = getCookie("store_nickname");
    if (savedPhone) {
      setPhoneNumber(savedPhone);
      detectNetworkFromPhone(savedPhone);
    }
    if (savedNickname) setNickname(savedNickname);
    
    // Load order history if phone is saved
    if (savedPhone) {
      loadOrderHistory(savedPhone);
    }
  }, []);

  const networks = Array.from(new Set(packages.map((p) => p.network_id))).filter(n => ALLOWED_NETWORKS.includes(n));
  const filteredPackages = selectedNetwork
    ? packages.filter((p) => p.network_id === selectedNetwork)
    : packages.filter((p) => ALLOWED_NETWORKS.includes(p.network_id));

  const networkName = (networkId: number) => {
    return NETWORK_NAME_MAP[networkId] || `Network ${networkId}`;
  };

  const detectNetworkFromPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\s/g, "");
    if (cleanPhone.length >= 3) {
      const prefix = cleanPhone.substring(0, 3);
      if (NETWORK_PREFIXES.MTN.includes(prefix)) {
        setDetectedNetwork("MTN Ghana");
        setSelectedNetwork(3); // DataKazina ID for MTN
        return;
      }
      if (NETWORK_PREFIXES.VODAFONE.includes(prefix)) {
        setDetectedNetwork("Vodafone Ghana");
        setSelectedNetwork(2); // DataKazina ID for Telecel (formerly Vodafone)
        return;
      }
      if (NETWORK_PREFIXES.AIRTELTIGO.includes(prefix)) {
        setDetectedNetwork("AirtelTigo");
        setSelectedNetwork(4); // DataKazina ID for AirtelTigo
        return;
      }
    }
    setDetectedNetwork(null);
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all spaces and special characters except digits
    let cleaned = value.replace(/\s/g, "").replace(/[^\d+]/g, "");
    
    // Convert +233 to 0
    if (cleaned.startsWith("+233")) {
      cleaned = "0" + cleaned.substring(4);
    }
    
    // Remove any remaining + signs
    cleaned = cleaned.replace(/\+/g, "");
    
    // Ensure it starts with 0
    if (cleaned.length > 0 && !cleaned.startsWith("0")) {
      cleaned = "0" + cleaned;
    }
    
    // Limit to 10 digits
    return cleaned.substring(0, 10);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
    detectNetworkFromPhone(formatted);
  };

  const loadOrderHistory = async (phone: string) => {
    try {
      const res = await fetch(`/api/store/${storeOwner.reseller_slug}/orders?phone=${phone}`);
      const data = await res.json();
      if (data.success) {
        setOrderHistory(data.orders || []);
      }
    } catch (error) {
      console.error("Error loading order history:", error);
    }
  };

  const handlePurchase = () => {
    if (!selectedPackage || !phoneNumber) return;
    setShowConfirmation(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPackage || !phoneNumber) return;

    // Save customer info to cookies
    setCookie("store_phone", phoneNumber, 30);
    if (nickname) setCookie("store_nickname", nickname, 30);

    setShowConfirmation(false);
    setPurchasing(true);

    try {
      // Initialize Paystack payment - ensure valid email format
      const email = nickname && nickname.includes('@') ? nickname : `${phoneNumber}@ghana.com`;
      const reference = `store-${storeOwner.id}-${Date.now()}`;
      
      const initResponse = await fetch('/api/paystack/guest/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPackage.selling_price,
          email,
          reference,
          metadata: {
            store_id: storeOwner.id,
            package_id: selectedPackage.id,
            network_id: selectedPackage.network_id,
            phone_number: phoneNumber,
            customer_name: nickname,
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize payment');
      }

      const initData = await initResponse.json();
      
      // Open Paystack popup
      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (!paystackPublicKey) {
        throw new Error('Payment service not configured');
      }

      // Load Paystack script if not already loaded
      if (!window.PaystackPop) {
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Open Paystack popup using the inline method
      const paystackHandler = (window as any).PaystackPop.setup({
        key: paystackPublicKey,
        email: email,
        amount: Math.round(selectedPackage.selling_price * 100), // Convert to kobo
        ref: reference,
        currency: 'GHS',
        onClose: () => {
          setPurchasing(false);
          toast({
            title: 'Payment Cancelled',
            description: 'You cancelled the payment',
            variant: 'destructive',
          });
        },
        callback: function(response: any) {
          // Payment successful, now call the API to process the order
          fetch("/api/guest/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              store_id: storeOwner.id,
              package_id: selectedPackage.id,
              network_id: selectedPackage.network_id,
              phone_number: phoneNumber,
              email: nickname,
              amount: selectedPackage.selling_price,
              payment_reference: reference,
            }),
          })
          .then(res => {
            if (!res.ok) {
              return res.json().then(data => {
                throw new Error(data.error || "Purchase failed after payment");
              });
            }
            return res.json();
          })
          .then(data => {
            // Handle retry_pending status as success (order is being processed)
            if (data.retry_pending) {
              toast({
                title: "Successful Purchase",
                description: "Data will be sent shortly.",
                variant: "default",
              });
              setSelectedPackage(null);
              loadOrderHistory(phoneNumber);
              return;
            }
            
            // Handle actual errors
            if (data.error) {
              throw new Error(data.error || "Purchase failed after payment");
            }
            
            // Success case
            toast({
              title: "Purchase Successful",
              description: "Data will be sent shortly.",
              variant: "default",
            });
            setSelectedPackage(null);
            loadOrderHistory(phoneNumber);
          })
          .catch(error => {
            toast({
              title: "Purchase Failed",
              description: error instanceof Error ? error.message : "An error occurred",
              variant: "destructive",
            });
          })
          .finally(() => {
            setPurchasing(false);
          });
        },
      });

      paystackHandler.openIframe();
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
      setPurchasing(false);
    }
  };

  const handleTabChange = (tab: "buy" | "history") => {
    setActiveTab(tab);
    if (tab === "history" && phoneNumber) {
      loadOrderHistory(phoneNumber);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{storeOwner.store_name}</h1>
          <p className="text-muted-foreground">Data Bundle Store</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as "buy" | "history")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="buy">Buy Data</TabsTrigger>
            <TabsTrigger value="history">My Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              <div>
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle>Your Details</CardTitle>
                    <CardDescription>
                      Enter your phone number to get started
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="05XXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                      />
                      {detectedNetwork && (
                        <p className="text-sm text-green-600 mt-1">
                          📱 {detectedNetwork}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter number (e.g., 0595919802 or +233595919802)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="nickname">Your Name (Optional)</Label>
                      <Input
                        id="nickname"
                        type="text"
                        placeholder="Enter your name"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        We'll use this to track your orders
                      </p>
                    </div>

                    {selectedPackage && (
                      <>
                        <div className="border rounded-lg p-3 bg-muted/50">
                          <p className="font-medium">{selectedPackage.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedPackage.data_amount}
                          </p>
                          <p className="font-bold text-lg mt-2">
                            GHS {selectedPackage.selling_price.toFixed(2)}
                          </p>
                        </div>

                        <Button
                          className="w-full"
                          onClick={handlePurchase}
                          disabled={!phoneNumber || purchasing}
                        >
                          {purchasing ? "Processing..." : "Purchase"}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-2">
                {!phoneNumber ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-muted-foreground">
                        Enter your phone number to view available packages
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Packages</CardTitle>
                      <CardDescription>
                        Select a network to view available packages
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {networks.map((networkId) => (
                          <Button
                            key={networkId}
                            variant={selectedNetwork === networkId ? "default" : "outline"}
                            onClick={() => setSelectedNetwork(networkId)}
                          >
                            {networkName(networkId)}
                          </Button>
                        ))}
                      </div>

                      <div className="grid gap-4">
                        {filteredPackages.map((pkg) => (
                          <Card
                            key={pkg.id}
                            className={`cursor-pointer transition-colors ${
                              selectedPackage?.id === pkg.id ? "border-primary" : ""
                            }`}
                            onClick={() => setSelectedPackage(pkg)}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-medium text-lg">{pkg.data_amount || pkg.volume || pkg.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {networkName(pkg.network_id)} • {pkg.validity || "30 days"}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-bold text-lg">
                                    GHS {pkg.selling_price.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Your Order History</CardTitle>
                <CardDescription>
                  Track your past purchases from this store
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!phoneNumber ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Enter your phone number on the Buy Data tab to view your order history
                  </p>
                ) : orderHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No orders found for {phoneNumber}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {orderHistory.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{order.package_name || `Package ${order.package_id}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {networkName(order.network_id)} • {order.data_amount || "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">
                              GHS {order.amount.toFixed(2)}
                            </p>
                            <p className={`text-sm ${
                              order.status === "completed" ? "text-green-600" :
                              // order.status === "processing" ? "text-yellow-600" :
                              "text-red-600"
                            }`}>
                              {order.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Please review your order details before proceeding
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="font-medium text-lg">{selectedPackage.data_amount || selectedPackage.volume || selectedPackage.name}</p>
                <p className="text-muted-foreground">
                  {networkName(selectedPackage.network_id)} • {selectedPackage.validity || "30 days"}
                </p>
                <p className="text-2xl font-bold mt-2">
                  GHS {selectedPackage.selling_price.toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Phone Number</p>
                  <p className="text-sm text-muted-foreground">{phoneNumber}</p>
                </div>
                {nickname && (
                  <div>
                    <p className="text-sm font-medium">Your Name/Email</p>
                    <p className="text-sm text-muted-foreground">{nickname}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={purchasing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={purchasing}
            >
              {purchasing ? "Processing..." : "Buy Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}
