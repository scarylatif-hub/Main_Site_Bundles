"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState<{
    is_enabled: boolean;
    message: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaintenanceStatus();
  }, []);

  const fetchMaintenanceStatus = async () => {
    try {
      const response = await fetch("/api/admin/maintenance");
      if (response.ok) {
        const data = await response.json();
        setMaintenance(data);
      }
    } catch (error) {
      console.error("Error fetching maintenance status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !maintenance?.is_enabled) {
    return null;
  }

  return (
    <Alert className="bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950 dark:border-orange-900 dark:text-orange-100">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="font-medium">
        {maintenance.message || "Service is temporarily unavailable. Please check back later."}
      </AlertDescription>
    </Alert>
  );
}
