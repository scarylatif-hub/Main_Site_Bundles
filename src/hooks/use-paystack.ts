
"use client";

import { usePaystackPayment } from 'react-paystack';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';

interface UsePaystackProps {
    email: string;
    amount: number; // in GHS
    onSuccess: (reference: any) => void;
    onClose: () => void;
}

export const usePaystack = ({ email, amount, onSuccess, onClose }: UsePaystackProps) => {
    const { toast } = useToast();
    
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

    const config = useMemo(() => ({
        reference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email,
        amount: Math.round(amount * 100), // Paystack amount is in pesewas
        publicKey,
        currency: 'GHS',
    }), [email, amount, publicKey]);

    const initializePayment = usePaystackPayment(config);

    const safeInitializePayment = () => {
        if (!publicKey) {
            console.error("Paystack public key is not set. Please set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in your .env file.");
            toast({
                title: "Configuration Error",
                description: "Payment gateway is not configured. Please contact support.",
                variant: "destructive"
            });
            return;
        }

        if (amount <= 0) {
             toast({
                title: "Invalid Amount",
                description: "Please enter a valid amount to deposit.",
                variant: "destructive"
            });
            return;
        }
        
        initializePayment({ onSuccess, onClose });
    };

    return { initializePayment: safeInitializePayment };
};

    