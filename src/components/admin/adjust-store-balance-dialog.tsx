"use client";

import { useState } from "react";
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
import { Edit3 } from "lucide-react";

interface AdjustStoreBalanceDialogProps {
  storeId: string;
  storeName: string;
  availableBalance: number;
}

export function AdjustStoreBalanceDialog({
  storeId,
  storeName,
  availableBalance,
}: AdjustStoreBalanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdjust = async () => {
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a positive amount to reduce the store balance.",
        variant: "destructive",
      });
      return;
    }

    if (parsedAmount > availableBalance) {
      toast({
        title: "Amount too large",
        description: "Cannot reduce more than the available store balance.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/stores/${storeId}/adjust-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to adjust store balance");
      }

      toast({
        title: "Store balance reduced",
        description: `Reduced ${storeName} store balance by GHS ${parsedAmount.toFixed(2)}.`,
      });
      setOpen(false);
      setAmount("");
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to adjust store balance.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={availableBalance <= 0} className="w-full justify-center gap-2">
          <Edit3 className="h-4 w-4" />
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reduce store balance</DialogTitle>
          <DialogDescription>
            Reduce <strong>{storeName}</strong> available earnings by up to GHS {availableBalance.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`adjust-amount-${storeId}`}>Amount (GHS)</Label>
            <Input
              id={`adjust-amount-${storeId}`}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              max={availableBalance}
            />
          </div>

          <Button onClick={handleAdjust} disabled={loading} className="w-full">
            {loading ? "Adjusting..." : "Reduce Balance"}
          </Button>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• This is an administrative reduction of the store's available earnings.</p>
            <p>• It will lower the displayed store balance immediately after processing.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
