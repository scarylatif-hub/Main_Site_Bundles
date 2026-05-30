
"use client";

import { useCart } from "@/hooks/use-cart";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wallet, ShoppingBag, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useRef, useState } from "react";
import type { CartItem } from "@/lib/definitions";
import { normalizePhoneNumber } from "@/lib/networks";

type PurchaseResult = {
    item: CartItem;
    success: boolean;
    message: string;
    code?: string;
};

export default function CheckoutPage() {
    const { cartItems, totalPrice, clearCart, removeFromCart } = useCart();
    const { user, userProfile, loading: authLoading, refreshUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [purchaseResults, setPurchaseResults] = useState<PurchaseResult[]>([]);
    const payLockRef = useRef(false);

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

        if (payLockRef.current || isProcessing) return;
        payLockRef.current = true;

        const lineKey = (i: CartItem) =>
            `${normalizePhoneNumber(i.recipientMsisdn)}|${i.networkId}|${i.sharedBundle}`;
        const seen = new Set<string>();
        for (const item of cartItems) {
            const k = lineKey(item);
            if (seen.has(k)) {
                toast({
                    title: "Duplicate lines in cart",
                    description:
                        "You have the same phone number, network, and bundle size twice. Remove the duplicate or pay for one line at a time — otherwise the second request returns 409 (conflict) from the provider.",
                    variant: "destructive",
                });
                payLockRef.current = false;
                return;
            }
            seen.add(k);
        }

        setIsProcessing(true);
        setPurchaseResults([]);

        const results: PurchaseResult[] = [];
        let runningBalance = walletBalance;

        try {
            for (const item of cartItems) {
            try {
                if (runningBalance < item.price) {
                    results.push({
                        item,
                        success: false,
                        message: 'Insufficient wallet balance for this item.',
                    });
                    continue;
                }

                const response = await fetch('/api/buy-bundle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        recipientMsisdn: item.recipientMsisdn,
                        networkId: item.networkId,
                        providerNetworkId: item.providerNetworkId,
                        networkName: item.networkName,
                        sharedBundle: item.sharedBundle,
                        price: item.price,
                        dataAmount: item.dataAmount,
                    }),
                });

                let resultData: {
                    success?: boolean;
                    error?: string;
                    code?: string;
                    transaction_code?: string;
                } = {};
                try {
                    resultData = await response.json();
                } catch {
                    resultData = { error: `Purchase failed (HTTP ${response.status})` };
                }

                const apiSuccess =
                    response.ok &&
                    (resultData.success === true || Boolean(resultData.transaction_code));

                if (!apiSuccess) {
                    results.push({
                        item,
                        success: false,
                        message:
                            resultData.error ||
                            `Purchase failed with status ${response.status}`,
                        code: resultData.code,
                    });
                    continue;
                }
                
                results.push({ item, success: true, message: 'Purchase successful!' });
                runningBalance -= item.price;
                
                removeFromCart(item.cartId, false); // Don't show toast for each item

            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'An unknown error occurred.';
                results.push({ item, success: false, message: msg });
            }
            }
        } finally {
            setPurchaseResults(results);
            setIsProcessing(false);
            payLockRef.current = false;
        }

        if(refreshUser) await refreshUser();

        const successfulPurchases = results.filter(r => r.success);
        const failedPurchases = results.filter(r => !r.success);
        const has409 = failedPurchases.some(
            (r) => r.code === 'ORDER_IN_PROGRESS' || r.message.includes('already in progress')
        );

        if (failedPurchases.length === 0 && successfulPurchases.length > 0) {
            toast({
                title: "All Purchases Successful!",
                description: "Your data bundles have been sent.",
            });
        } else if (successfulPurchases.length > 0) {
            toast({
                title: "Some Purchases Completed",
                description: `${successfulPurchases.length} bundles purchased. ${failedPurchases.length} failed.`,
                variant: "default"
            });
        } else if (failedPurchases.length > 0) {
             if (has409) {
                toast({
                    title: "Order already in progress (409)",
                    description:
                        "The provider reports a duplicate or conflicting transaction for this number and bundle. Wait a few minutes, then check My Orders — or remove duplicate cart lines.",
                    variant: "default",
                });
             } else {
                toast({
                    title: "Purchase could not complete",
                    description: "See the details below each line item.",
                    variant: "destructive"
                });
             }
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
    
    if (cartItems.length === 0) {
        if (purchaseResults.length > 0) {
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
                            {purchaseResults.map((res, index) => (
                                <Alert key={index} variant={res.success ? "default" : "destructive"} className={res.success ? 'bg-success/10 border-success/30' : ''}>
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
            <div className="mt-16 text-center container mx-auto max-w-3xl px-4 py-8 sm:py-12">
                <ShoppingBag className="mx-auto h-24 w-24 text-muted-foreground/30" />
                <p className="mt-4 text-xl font-semibold">Your cart is empty.</p>
                <Button asChild className="mt-4">
                    <Link href="/">Go Shopping</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <PageHeader
                title="Checkout"
                description="Review your order and complete your purchase."
            />

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
        </div>
    );
}
