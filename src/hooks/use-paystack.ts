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
          credentials: 'include',
          body: JSON.stringify({
            amount: config.amount,
            type: action,
            description: metadata?.description || `${action} payment`,
          }),
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize payment');
        }

        const initJson = await initResponse.json();
        const reference = initJson.reference as string;
        const chargeGhs = Number(
          initJson.chargeAmountGhs ?? config.amount
        );

        const PS = (window as any).PaystackPop;
        let verifyStarted = false;
        const finishVerify = () => {
          if (verifyStarted) return;
          verifyStarted = true;
          verifyPaymentWithPolling(reference)
            .then(() => {
              toast({
                title: 'Success',
                description: 'Wallet credited successfully.',
              });
              config.onSuccess?.();
              onSuccess?.();
            })
            .catch((error) => {
              toast({
                title: 'Confirmation pending',
                description:
                  error instanceof Error
                    ? error.message
                    : 'We could not confirm immediately; your webhook may still credit you.',
                variant: 'destructive',
              });
              console.error('Verification error:', error);
            })
            .finally(() => {
              setIsInitializing(false);
            });
        };

        // Inline JS v1: setup() returns a handle with openIframe(); use `callback` (not onSuccess).
        let popup = PS.setup({
          key: publicKey,
          email: config.email,
          amount: Math.round(chargeGhs * 100),
          ref: reference,
          currency: 'GHS',
          callback: () => {
            finishVerify();
          },
          onClose: () => {
            config.onClose?.();
            setIsInitializing(false);
          },
        });

        if (popup && typeof (popup as Promise<unknown>).then === 'function') {
          popup = await (popup as Promise<{ openIframe?: () => void }>);
        }

        if (popup && typeof popup.openIframe === 'function') {
          popup.openIframe();
        } else if (PS && typeof PS.openIframe === 'function') {
          PS.openIframe();
        } else {
          throw new Error('Paystack Inline JS is outdated or blocked. Try another browser or disable extensions.');
        }
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

/** One in-flight verify per reference (prevents double callback + parallel polls). */
const verifyInFlight = new Map<string, Promise<void>>();

/**
 * Poll verify+credit every 2s (webhook may also credit; idempotent).
 */
async function verifyPaymentWithPolling(reference: string): Promise<void> {
  const existing = verifyInFlight.get(reference);
  if (existing) return existing;

  const run = verifyPaymentWithPollingImpl(reference).finally(() => {
    verifyInFlight.delete(reference);
  });
  verifyInFlight.set(reference, run);
  return run;
}

async function verifyPaymentWithPollingImpl(reference: string): Promise<void> {
  const maxAttempts = 45;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `/api/paystack/verify?reference=${encodeURIComponent(reference)}`,
      { credentials: 'include' }
    );

    const data = await response.json();

    if (response.status === 403) {
      throw new Error('Please stay logged in while we confirm your payment.');
    }

    if (!response.ok && response.status !== 200) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const credited =
      data.credited === true ||
      data.reason === 'already_processed' ||
      data.source === 'existing' ||
      data.source === 'webhook_won_race' ||
      data.source === 'legacy_ledger';

    if (credited) {
      return;
    }

    if (data.reason === 'no_user') {
      throw new Error(
        'Payment succeeded but user metadata is missing. Contact support with your Paystack reference.'
      );
    }

    if (data.reason === 'rpc_error') {
      throw new Error('Payment verified but wallet update failed. Contact support with your reference.');
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(
    'Still confirming with Paystack. If you were charged, wait a moment and refresh your wallet.'
  );
}

// Extend window type for Paystack
declare global {
  interface Window {
    PaystackPop: any;
  }
}
