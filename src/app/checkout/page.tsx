"use client";

import { useCart } from "@/hooks/use-cart";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wallet, ShoppingBag, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useState } from "react";
import { CartItem } from "@/lib/definitions";

type PurchaseResult = {
    item: CartItem;
    success: boolean;
    message: string;
};

export default function CheckoutPage() {
    const { cartItems, totalPrice, clearCart, removeFromCart } = useCart();
    const { user, userProfile, loading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [purchaseResults, setPurchaseResults] = useState<PurchaseResult[]>([]);

    const walletBalance = userProfile?.wallet_balance ?? 0;
    const isSufficient = walletBalance >= totalPrice;

    const handlePayWithWallet = async () => {
        if (!user) {
             toast({
                title: "Authentication Error",
                description: "You must be logged in to make a purchase.",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);
        setPurchaseResults([]);

        // Process each item sequentially to avoid race conditions with balance updates
        const results: PurchaseResult[] = [];
        for (const item of cartItems) {
            try {
                const response = await fetch('/api/buy-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item),
                });
                
                const resultData = await response.json();

                if (!response.ok) {
                    throw new Error(resultData.error || `Purchase failed with status ${response.status}`);
                }
                
                results.push({ item, success: true, message: 'Purchase successful!' });
                
                // Optimistically remove from cart UI and refresh user balance
                removeFromCart(item.cartId);
                if (refreshUser) await refreshUser();

            } catch (error: any) {
                results.push({ item, success: false, message: error.message || 'An unknown error occurred.' });
            }
        }
        
        setPurchaseResults(results);
        setIsProcessing(false);

        const successfulPurchases = results.filter(r => r.success);
        const failedPurchases = results.filter(r => !r.success);

        if (failedPurchases.length === 0) {
            toast({
                title: "All Purchases Successful!",
                description: "Your data bundles have been sent. Redirecting to orders...",
            });
            setTimeout(() => router.push('/orders'), 2000);
        } else if (successfulPurchases.length > 0) {
            toast({
                title: "Some Purchases Completed",
                description: `${successfulPurchases.length} bundles purchased. ${failedPurchases.length} failed.`,
                variant: "default"
            });
        } else {
             toast({
                title: "All Purchases Failed",
                description: "Could not purchase any bundles. Please check errors below.",
                variant: "destructive"
            });
        }
        
        // Refresh final balance state
        if (refreshUser) await refreshUser();
    }

    if (authLoading) {
         return <div className="text-center p-12">Loading...</div>
    }

    if (!user) {
        return (
             <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12 text-center">
                <PageHeader
                    title="Checkout"
                    description="Please log in to complete your purchase."
                />
                 <Button asChild className="mt-4">
                        <Link href="/login">Login</Link>
                </Button>
            </div>
        )
    }
    
    // After processing, if cart becomes empty, show results and redirect.
    if (cartItems.length === 0 && purchaseResults.length > 0) {
        return (
            <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
                 <PageHeader
                    title="Purchase Complete"
                    description="Review the status of your purchases below."
                />
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Purchase Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {purchaseResults.map(res => (
                            <Alert key={res.item.cartId} variant={res.success ? "default" : "destructive"} className={res.success ? 'bg-success/10 border-success/30' : ''}>
                                {res.success ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <AlertTitle>{res.item.dataAmount} for {res.item.recipientMsisdn}</AlertTitle>
                                <AlertDescription>
                                   Status: <span className="font-semibold">{res.success ? "Success" : "Failed"}</span>
                                   {!res.success && <p>Reason: {res.message}</p>}
                                </AlertDescription>
                            </Alert>
                        ))}
                    </CardContent>
                    <CardFooter className='flex-col gap-4'>
                        <Button onClick={() => router.push('/orders')} className="w-full">
                            View All My Orders
                        </Button>
                        <Button onClick={() => router.push('/')} className="w-full" variant='outline'>
                            Buy More Data
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <PageHeader
                title="Checkout"
                description="Review your order and complete your purchase."
            />

            {cartItems.length === 0 && purchaseResults.length === 0 ? (
                <div className="mt-16 text-center">
                    <ShoppingBag className="mx-auto h-24 w-24 text-muted-foreground/30" />
                    <p className="mt-4 text-xl font-semibold">Your cart is empty.</p>
                    <Button asChild className="mt-4">
                        <Link href="/">Go Shopping</Link>
                    </Button>
                </div>
            ) : (
                <div className="mt-8 grid gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {cartItems.map(item => (
                                <div key={item.cartId} className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{item.dataAmount} for {item.recipientMsisdn}</p>
                                        <p className="text-sm text-muted-foreground">{item.networkName}</p>
                                    </div>
                                    <p>GHS {item.price.toFixed(2)}</p>
                                </div>
                            ))}
                            <hr />
                            <div className="flex justify-between text-lg font-bold">
                                <p>Total</p>
                                <p>GHS {totalPrice.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Method</CardTitle>
                            <CardDescription>Choose how you want to pay for your order.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isSufficient && (
                                <Alert variant="destructive">
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Insufficient Balance</AlertTitle>
                                    <AlertDescription>
                                        Your wallet balance (GHS {walletBalance.toFixed(2)}) is not enough to cover this purchase. Please deposit funds first.
                                        <Button variant="link" className="p-0 h-auto ml-1" asChild>
                                            <Link href="/wallet">Go to Wallet</Link>
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <Button className="w-full" onClick={handlePayWithWallet} disabled={!isSufficient || isProcessing || cartItems.length === 0}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    {isProcessing ? 'Processing...' : `Pay with Wallet (Balance: GHS ${walletBalance.toFixed(2)})`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
