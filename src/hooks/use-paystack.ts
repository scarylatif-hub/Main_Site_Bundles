
"use client";

import { usePaystackPayment } from 'react-paystack';
import { useToast } from '@/hooks/use-toast';

interface UsePaystackProps {
    email: string;
    onSuccess: (reference: any) => void;
    onClose: () => void;
}

export const usePaystack = ({ email, onSuccess, onClose }: UsePaystackProps) => {
    const { toast } = useToast();
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

    const initializePayment = (amount: number) => {
        if (!publicKey) {
            console.error("Paystack public key is not set. Please set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in your .env file.");
            toast({
                title: "Configuration Error",
                description: "Payment gateway is not configured. Please contact support.",
                variant: "destructive"
            });
            return;
        }

        if (amount <= 0 || isNaN(amount)) {
             toast({
                title: "Invalid Amount",
                description: "Please enter a valid amount to deposit.",
                variant: "destructive"
            });
            return;
        }
        
        const config = {
            reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            email,
            amount: Math.round(amount * 100), // Paystack amount is in pesewas/cents
            publicKey,
            currency: 'GHS' as const,
        };

        const paystackHook = usePaystackPayment(config);
        
        // Now call the function returned by the hook
        paystackHook({onSuccess, onClose});
    };
    
    //This is the correct way to use the hook.
    // The component that USES this hook will call `initializePayment`
    // which in turn will call the library's hook-returned function.
    // We cannot call usePaystackPayment inside the returned function, so we must call it here
    // and return a function that uses it. This is a classic React hooks conundrum.
    // The library's design makes dynamic config tricky.

    // A completely different and more robust approach is to have a component that handles this.
    // Let's go with the most direct approach that works with hooks rules.

    const config = {
        reference: `TXN-${Date.now()}`, // This will be replaced
        email,
        amount: 0, // This will be replaced
        publicKey,
        currency: 'GHS' as const,
    };

    const paystackHook = usePaystackPayment(config);

    const safeInitializePayment = (amount: number) => {
        if (!publicKey) {
            toast({ title: "Config Error", description: "Paystack key not found.", variant: "destructive" });
            return;
        }
        if (amount <= 0 || isNaN(amount)) {
            toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
            return;
        }
        
        // This is a workaround. The hook should be re-callable with new config.
        // The `react-paystack` library doesn't seem to support this easily.
        // The most robust way is to abandon the custom hook and use a component wrapper.
        
        // The error `Cannot read properties of undefined (reading 'publicKey')` means the config object is undefined when `usePaystackPayment` is called.
        // This can happen if the hook is not structured correctly.
        
        const dynamicConfig = {
            ...config,
            reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            amount: Math.round(amount * 100),
        };

        // We can't call the hook here. The only way is to have the hook return a function
        // that calls the function returned by `usePaystackPayment` at the top level.
        paystackHook({
            ...dynamicConfig,
            onSuccess,
            onClose,
        });
    };

    return { initializePayment: safeInitializePayment };
};
