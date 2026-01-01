
"use client";

import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingBag } from "lucide-react";
import { NetworkLogo } from "@/components/network-logo";
import { PageHeader } from "@/components/page-header";

export default function CartPage() {
    const { cartItems, removeFromCart, itemCount, totalPrice } = useCart();

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12">
            <PageHeader
                title="Your Shopping Cart"
                description={`You have ${itemCount} item(s) in your cart.`}
            />

            {itemCount > 0 ? (
                <div className="mt-8 grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <div className="space-y-4">
                            {cartItems.map((item) => (
                                <Card key={item.cartId} className="flex items-center p-4">
                                    <div className="flex-shrink-0">
                                        <NetworkLogo network={item.networkName} size={40} />
                                    </div>
                                    <div className="ml-4 flex-grow">
                                        <p className="font-bold">{item.dataAmount}</p>
                                        <p className="text-sm text-muted-foreground">{item.recipientMsisdn}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">GHS {item.price.toFixed(2)}</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeFromCart(item.cartId)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Remove item</span>
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>GHS {totalPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span>Total</span>
                                    <span>GHS {totalPrice.toFixed(2)}</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href="/checkout">Proceed to Checkout</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="mt-16 text-center">
                    <ShoppingBag className="mx-auto h-24 w-24 text-muted-foreground/30" />
                    <p className="mt-4 text-xl font-semibold">Your cart is empty</p>
                    <p className="mt-2 text-muted-foreground">Looks like you haven't added any data bundles yet.</p>
                    <Button asChild className="mt-6">
                        <Link href="/">Start Shopping</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
