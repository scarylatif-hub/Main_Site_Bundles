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
import { TrendingUp, Wallet } from "lucide-react";

export function MoveToWalletDialog({ availableEarnings }: { availableEarnings: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  const handleMove = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    if (Number(amount) > availableEarnings) {
      toast({ title: "Insufficient earnings", description: "You don't have enough available earnings", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reseller/move-to-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Transfer failed");
      }

      toast({ title: "Success", description: data.message });
      setOpen(false);
      setAmount("");
      
      // Refresh stats
      window.location.reload();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Transfer failed", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <TrendingUp className="h-4 w-4 mr-2" />
          Move to Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Earnings to Wallet</DialogTitle>
          <DialogDescription>
            Available earnings: ₵{availableEarnings.toFixed(2)}
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
              max={availableEarnings}
            />
          </div>

          <Button 
            onClick={handleMove} 
            disabled={loading} 
            className="w-full"
          >
            {loading ? "Processing..." : "Move to Wallet"}
          </Button>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• This moves your available earnings to your main wallet balance.</p>
            <p>• Once in main wallet, funds cannot be withdrawn again.</p>
            <p>• Main wallet balance can be used for purchases on the main site.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
