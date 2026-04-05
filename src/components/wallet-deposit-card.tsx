"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/use-paystack";

type WalletDepositCardProps = {
  id?: string;
  className?: string;
};

export function WalletDepositCard({ id, className }: WalletDepositCardProps) {
  const { user, userProfile, refreshUser } = useAuth();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");

  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  const { initializePayment, isInitializing } = usePaystack({
    publicKey: paystackPublicKey,
    action: "wallet_deposit",
    metadata: { description: "Wallet top-up" },
    onSuccess: () => {
      refreshUser?.();
      setDepositAmount("");
    },
  });

  const handleProceedToPayment = () => {
    const amount = parseFloat(depositAmount);
    if (!user?.email) {
      toast({
        title: "Error",
        description: "User email is not available.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(amount) || amount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount of at least GHS 1.",
        variant: "destructive",
      });
      return;
    }
    if (!paystackPublicKey?.startsWith("pk_")) {
      toast({
        title: "Configuration Error",
        description: "Payment gateway is not configured.",
        variant: "destructive",
      });
      return;
    }
    initializePayment({
      email: user.email,
      amount,
    });
  };

  if (!user) return null;

  return (
    <Card id={id} className={className}>
      <CardHeader>
        <CardTitle>
          Wallet Balance: GHS {userProfile?.wallet_balance?.toFixed(2) || "0.00"}
        </CardTitle>
        <CardDescription>
         Paystack charges 2% on top of the amount you enter.
          we absorb 0.5% so you pay 1.5% on top. Buying data from your wallet has no extra fee.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <Input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount (GHS)"
            min="1"
          />
        </div>
        <Button
          type="button"
          onClick={handleProceedToPayment}
          disabled={!user?.email || parseFloat(depositAmount) < 1 || isInitializing}
          className="shrink-0"
        >
          {isInitializing ? "Processing…" : "Deposit Funds"}
        </Button>
      </CardContent>
    </Card>
  );
}
