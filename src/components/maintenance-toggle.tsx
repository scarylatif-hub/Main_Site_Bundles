"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export function MaintenanceToggle() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchMaintenanceStatus();
  }, []);

  const fetchMaintenanceStatus = async () => {
    try {
      const response = await fetch("/api/admin/maintenance");
      if (response.ok) {
        const data = await response.json();
        setIsEnabled(data.is_enabled || false);
        setMessage(data.message || "");
      }
    } catch (error) {
      console.error("Error fetching maintenance status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const newEnabled = !isEnabled;
    
    // If turning on (enabling maintenance), open dialog to get message
    if (newEnabled) {
      setOpen(true);
      return;
    }

    // If turning off, do it immediately
    await updateMaintenanceMode(newEnabled, message);
  };

  const updateMaintenanceMode = async (enabled: boolean, msg: string) => {
    setUpdating(true);
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: enabled, message: msg }),
      });

      if (response.ok) {
        setIsEnabled(enabled);
        setMessage(msg);
        setOpen(false);
      } else {
        alert("Failed to update maintenance mode");
      }
    } catch (error) {
      console.error("Error updating maintenance mode:", error);
      alert("Failed to update maintenance mode");
    } finally {
      setUpdating(false);
    }
  };

  const handleSave = () => {
    if (isEnabled && !message.trim()) {
      alert("Please provide a reason for enabling maintenance mode");
      return;
    }
    updateMaintenanceMode(true, message);
  };

  if (loading) {
    return <div className="h-6 w-12 bg-muted rounded animate-pulse" />;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`h-5 w-5 ${isEnabled ? "text-orange-500" : "text-muted-foreground"}`} />
          <div>
            <p className="font-medium">Maintenance Mode</p>
            <p className="text-sm text-muted-foreground">
              {isEnabled ? "Service is disabled" : "Service is active"}
            </p>
          </div>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={updating}
        />
      </div>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Maintenance Mode</DialogTitle>
          <DialogDescription>
            This will disable wallet deposits and data purchases on the main site and stores.
            Please provide a reason for users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Textarea
              id="maintenance-message"
              placeholder="e.g., Scheduled maintenance for system upgrade. We'll be back in 2 hours."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updating}>
            {updating ? "Enabling..." : "Enable Maintenance Mode"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
