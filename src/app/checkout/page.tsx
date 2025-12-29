"use client";

import { useCart } from "@/hooks/use-cart";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wallet, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useState } from "react";

export default function CheckoutPage() {
    const { cartItems, totalPrice, clearCart } = useCart();
    const { user, userProfile, loading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [isProcessing, setIsProcessing] = useState(false);

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

        const purchasePromises = cartItems.map(item =>
            fetch('/api/buy-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            }).then(async response => {
                if (!response.ok) {
                    const result = await response.json().catch(() => ({ error: 'An unexpected error occurred.' }));
                    // Use a more specific error from the API response if available
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
        );

        const results = await Promise.allSettled(purchasePromises);

        let successCount = 0;
        let failureCount = 0;

        results.forEach((result, index) => {
            const item = cartItems[index];
            if (result.status === 'fulfilled') {
                successCount++;
                 toast({
                    title: `Purchase Successful`,
                    description: `${item.dataAmount} for ${item.recipientMsisdn} was successful.`,
                });
            } else {
                failureCount++;
                console.error("Purchase error for item:", item.cartId, result.reason);
                toast({
                    title: `Purchase Failed for ${item.dataAmount}`,
                    description: result.reason.message || 'An unknown error occurred.',
                    variant: "destructive",
                });
            }
        });

        setIsProcessing(false);
        
        // Refresh user balance regardless of outcome
        if (refreshUser) refreshUser();

        if (failureCount === 0) {
            toast({
                title: "All Purchases Successful!",
                description: "Your data bundles have been sent.",
            });
            clearCart();
            router.push('/orders');
        } else {
             toast({
                title: "Some Purchases Failed",
                description: `${failureCount} out of ${cartItems.length} bundles could not be purchased. Please check your orders for details.`,
                variant: "destructive"
            });
            // A more complex logic could be to remove only successful items.
            // For simplicity, we clear the cart and navigate to orders to see what went through.
            clearCart(); 
            router.push('/orders');
        }
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

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <PageHeader
                title="Checkout"
                description="Review your order and complete your purchase."
            />

            {cartItems.length === 0 ? (
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
                                <Button className="w-full" onClick={handlePayWithWallet} disabled={!isSufficient || isProcessing}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    {isProcessing ? 'Processing...' : `Pay with Wallet (GHS ${walletBalance.toFixed(2)})`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
