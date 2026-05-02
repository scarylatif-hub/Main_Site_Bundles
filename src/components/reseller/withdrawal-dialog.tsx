"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Smartphone } from "lucide-react";

export function WithdrawalDialog({ walletBalance }: { walletBalance: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    if (Number(amount) > walletBalance) {
      toast({ title: "Insufficient balance", description: "You don't have enough balance", variant: "destructive" });
      return;
    }

    if (!momoNumber) {
      toast({ title: "Missing number", description: "Please enter your Mobile Money number", variant: "destructive" });
      return;
    }

    if (!momoName || momoName.trim().length < 2) {
      toast({ title: "Missing name", description: "Please enter your Mobile Money account name", variant: "destructive" });
      return;
    }

    // Validate Ghana phone number
    const phoneRegex = /^(0|233)\d{9}$/;
    if (!phoneRegex.test(momoNumber.replace(/\s/g, ""))) {
      toast({ title: "Invalid number", description: "Please enter a valid Ghana phone number", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reseller/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          momoNumber,
          momoName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      toast({ title: "Success", description: data.message });
      setOpen(false);
      setAmount("");
      setMomoNumber("");
      setMomoName("");
      
      // Refresh stats
      window.location.reload();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Withdrawal failed", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Wallet className="h-4 w-4 mr-2" />
          Withdraw Funds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            Available balance: ₵{walletBalance.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Amount (GHS)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={walletBalance}
            />
          </div>

          <div className="space-y-2">
            <Label>MTN MoMo Account Name *</Label>
            <Input
              type="text"
              placeholder="Enter your MTN Mobile Money account name"
              value={momoName}
              onChange={(e) => setMomoName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The name registered on your MTN Mobile Money account
            </p>
          </div>

          <div className="space-y-2">
            <Label>MTN MoMo Number *</Label>
            <Input
              type="tel"
              placeholder="0241234567 or 233241234567"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your Ghana MTN Mobile Money number
            </p>
          </div>

          <Button 
            onClick={handleWithdraw} 
            disabled={loading} 
            className="w-full"
          >
            {loading ? "Processing..." : "Withdraw"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            The amount will be deducted from your total earnings immediately. 
            You will receive the money manually to your MTN Mobile Money after approval.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
