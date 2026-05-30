"use client";

import type { Package } from "@/lib/definitions";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { NetworkLogo } from "./network-logo";
import { PlusCircle } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { validatePhoneNumber } from "@/lib/networks";
import { useToast } from "@/hooks/use-toast";

interface PackageCardProps {
    packageInfo: Package;
    phoneNumber: string;
}

export function PackageCard({ packageInfo, phoneNumber }: PackageCardProps) {
    const { addToCart } = useCart();
    const { toast } = useToast();

    const handleAddToCart = () => {
        if (!validatePhoneNumber(phoneNumber)) {
            toast({
                title: "Invalid Phone Number",
                description: "Please enter a valid phone number before adding to cart.",
                variant: "destructive",
            });
            return;
        }
        addToCart({
            recipientMsisdn: phoneNumber,
            networkId: packageInfo.network.id,
            networkName: packageInfo.network.name,
            providerNetworkId: packageInfo.providerNetworkId,
            sharedBundle: packageInfo.sharedBundle,
            price: packageInfo.price,
            dataAmount: packageInfo.dataAmount,
        });
    };

    return (
        <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-headline text-2xl">{packageInfo.dataAmount}</CardTitle>
                <NetworkLogo network={packageInfo.network.name} size={32} />
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="text-sm text-muted-foreground">
                    <p>Validity: {packageInfo.validity}</p>
                </div>
                <p className="mt-4 text-3xl font-bold text-primary">
                    GHS {packageInfo.price.toFixed(2)}
                </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full rounded-full" onClick={handleAddToCart}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add to Cart
                </Button>
            </CardFooter>
        </Card>
    );
}
