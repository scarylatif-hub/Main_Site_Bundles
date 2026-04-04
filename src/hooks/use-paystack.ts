'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from './use-toast';

/**
 * Hook to handle Paystack payment initialization and processing
 */
export function usePaystack({
  publicKey,
  onSuccess,
  action,
  metadata = {},
}: {
  publicKey?: string;
  onSuccess?: () => void;
  action: 'wallet_deposit' | 'cart_purchase';
  metadata?: Record<string, unknown>;
}) {
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);

  // Load Paystack script
  useEffect(() => {
    if (!publicKey) return;

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;

    script.onload = () => {
      setIsScriptLoading(false);
    };

    script.onerror = () => {
      console.error('Failed to load Paystack script');
      toast({
        title: 'Error',
        description: 'Failed to load payment gateway',
        variant: 'destructive',
      });
      setIsScriptLoading(false);
    };

    setIsScriptLoading(true);
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [publicKey, toast]);

  const initializePayment = useCallback(
    async (config: {
      amount: number;
      email: string;
      reference?: string;
      onSuccess?: () => void;
      onClose?: () => void;
    }) => {
      if (!publicKey || !window.PaystackPop) {
        toast({
          title: 'Error',
          description: 'Payment gateway is not ready',
          variant: 'destructive',
        });
        return;
      }

      setIsInitializing(true);

      try {
        // Call our backend to initialize the payment
        const initResponse = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: config.amount,
            type: action,
            description: metadata?.description || `${action} payment`,
          }),
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize payment');
        }

        const { reference, accessCode } = await initResponse.json();

        // Show Paystack payment modal using the public key
        (window as any).PaystackPop.setup({
          key: publicKey,
          email: config.email,
          amount: config.amount * 100, // Convert to kobo/cents
          ref: reference,
          currency: 'GHS',
          onClose: () => {
            config.onClose?.();
            setIsInitializing(false);
          },
          onSuccess: (response: any) => {
            // Verify the payment with our backend
            verifyPayment(reference)
              .then(() => {
                toast({
                  title: 'Success',
                  description: 'Payment completed successfully',
                });
                config.onSuccess?.();
                onSuccess?.();
              })
              .catch((error) => {
                toast({
                  title: 'Error',
                  description: 'Payment verification failed',
                  variant: 'destructive',
                });
                console.error('Verification error:', error);
              })
              .finally(() => {
                setIsInitializing(false);
              });
          },
        });

        (window as any).PaystackPop.pay();
      } catch (error) {
        console.error('Payment initialization error:', error);
        toast({
          title: 'Error',
          description: 'Failed to process payment',
          variant: 'destructive',
        });
        setIsInitializing(false);
      }
    },
    [publicKey, action, metadata, toast, onSuccess]
  );

  return {
    initializePayment,
    isInitializing,
    isScriptLoading,
  };
}

/**
 * Verify payment on backend
 */
async function verifyPayment(reference: string): Promise<void> {
  const response = await fetch(`/api/paystack/verify?reference=${reference}`);

  if (!response.ok) {
    throw new Error('Payment verification failed');
  }

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error('Payment was not successful');
  }

  return;
}

// Extend window type for Paystack
declare global {
  interface Window {
    PaystackPop: any;
  }
}
