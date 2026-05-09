"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/use-paystack";
import { useMaintenanceMode } from "@/hooks/use-maintenance-mode";

type WalletDepositCardProps = {
  id?: string;
  className?: string;
};

export function WalletDepositCard({ id, className }: WalletDepositCardProps) {
  const { user, userProfile, refreshUser } = useAuth();
  const { toast } = useToast();
  const { isMaintenance } = useMaintenanceMode();
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
  <CardHeader className="pb-3">
    <CardTitle className="text-xl">
      Wallet Balance: GHS {userProfile?.wallet_balance?.toFixed(2) || "0.00"}
    </CardTitle>
    <CardDescription className="text-sm leading-tight">
      Paystack charges 2%. We absorb 0.5%, so you pay <strong>1.5% extra</strong>.
      <br className="hidden sm:block" />
    </CardDescription>
  </CardHeader>

  <CardContent className="pt-2">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
      <div className="flex-1">
        <Input
          type="number"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="Amount in GHS"
          min="1"
          className="h-11"
          disabled={isMaintenance}
        />
      </div>
      <Button
        type="button"
        onClick={handleProceedToPayment}
        disabled={!user?.email || parseFloat(depositAmount) < 1 || isInitializing || isMaintenance}
        className="shrink-0 h-11 px-8"
      >
        {isMaintenance ? "Maintenance Mode" : isInitializing ? "Processing…" : "Deposit Funds"}
      </Button>
    </div>
    {isMaintenance && (
      <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
        Deposits are currently disabled due to maintenance.
      </p>
    )}
  </CardContent>
</Card>
  );
}
