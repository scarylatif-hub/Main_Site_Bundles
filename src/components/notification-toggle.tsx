"use client";

import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Loader2 } from "lucide-react";

export function NotificationToggle() {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const success = await subscribe();
      if (success) {
        toast({
          title: "Notifications Enabled!",
          description: "You will now receive instant push updates on your device.",
          variant: "default",
        });
      } else {
        toast({
          title: "Failed to Enable",
          description: "Could not register push notifications. Please check your browser permissions.",
          variant: "destructive",
        });
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        toast({
          title: "Notifications Disabled",
          description: "You have unsubscribed from push notifications.",
          variant: "default",
        });
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="p-3 text-xs text-muted-foreground bg-muted/40 rounded-lg flex flex-col gap-1.5 border border-dashed">
        <span className="font-semibold flex items-center gap-1">
          <BellOff className="h-3.5 w-3.5 text-orange-500" />
          Push Notifications Unsupported
        </span>
        <span>
          To receive notifications on mobile (especially iOS/iPhones), please:
        </span>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Tap the Share button in Safari/Chrome</li>
          <li>Select <strong>"Add to Home Screen"</strong></li>
          <li>Open the saved app and look for notifications settings</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm gap-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 bg-primary/10 text-primary rounded-md shrink-0">
          {isSubscribed ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <Label htmlFor="push-notif" className="text-sm font-medium leading-none cursor-pointer">
            Push Notifications
          </Label>
          <span className="text-xs text-muted-foreground mt-1 truncate">
            {isSubscribed
              ? "Receiving instant order updates"
              : permission === "denied"
              ? "Blocked by system settings"
              : "Enable to receive updates"}
          </span>
        </div>
      </div>
      
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          id="push-notif"
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={permission === "denied" && !isSubscribed}
        />
      )}
    </div>
  );
}
