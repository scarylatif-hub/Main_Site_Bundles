
    'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { usePaystack } from '@/hooks/use-paystack';
import { formatPrice } from '@/lib/normalize-types';
import type { CartItem } from '@/lib/types';
import {
  MIN_WALLET_DEPOSIT_BASE_GHS,
  cartPaystackChargeFromBaseGhs,
  walletDepositChargeFromBaseGhs,
} from '@/lib/paystack-config';

export type PaystackButtonProps = {
  email: string;
  /** Base amount in GHS (cart subtotal or wallet credit before platform fee). */
  amount: number;
  action: 'wallet_deposit' | 'cart_purchase';
  metadata?: {
    items?: CartItem[];
    total?: number;
    [key: string]: unknown;
  };
  onSuccess?: () => void;
  className?: string;
  disabled?: boolean;
};

export default function PaystackButton({
  email,
  amount,
  action,
  metadata = {},
  onSuccess,
  className,
  disabled = false,
}: PaystackButtonProps) {
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  const { initializePayment, isInitializing, isScriptLoading } = usePaystack({
    publicKey,
    onSuccess,
    action,
    metadata,
  });

  const hasValidKey = publicKey?.startsWith('pk_');
  const hasValidEmail = Boolean(email?.includes('@'));
  const baseAmount = Number(amount || 0);
  const hasValidAmount = baseAmount > 0;

  const chargeSplit =
    action === 'wallet_deposit'
      ? walletDepositChargeFromBaseGhs(baseAmount)
      : cartPaystackChargeFromBaseGhs(baseAmount);
  const totalCharge = chargeSplit.chargeGhs;

  const meetsMinimum =
    action !== 'wallet_deposit' || baseAmount >= MIN_WALLET_DEPOSIT_BASE_GHS;

  const canPay =
    hasValidKey &&
    hasValidEmail &&
    hasValidAmount &&
    meetsMinimum &&
    !disabled &&
    !isInitializing &&
    !isScriptLoading;

  if (!publicKey) {
    console.error('NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set in environment variables.');
    return (
      <Button type="button" className={className} disabled>
        Payment Configuration Error
      </Button>
    );
  }

  if (!hasValidKey) {
    return (
      <Button type="button" className={className} disabled>
        Invalid Payment Key
      </Button>
    );
  }

  const handleClick = () => {
    if (!hasValidEmail || !hasValidAmount) return;
    initializePayment(email, baseAmount);
  };

  const buttonText =
    isInitializing || isScriptLoading ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
        Processing...
      </>
    ) : (
      <>
        Pay MoMo GH₵{formatPrice(totalCharge)}
        <br />
        <span className="text-xs opacity-75">
          {/* (includes 1.5% fee • Base: GH₵{formatPrice(baseAmount)}) */}
        </span>
      </>
    );

  return (
    <Button type="button" onClick={handleClick} disabled={!canPay} className={className}>
      {buttonText}
    </Button>
  );
}
