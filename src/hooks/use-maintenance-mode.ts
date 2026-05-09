"use client";

import { useState, useEffect } from "react";

export function useMaintenanceMode() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaintenanceStatus();
  }, []);

  const fetchMaintenanceStatus = async () => {
    try {
      const response = await fetch("/api/admin/maintenance");
      if (response.ok) {
        const data = await response.json();
        setIsMaintenance(data.is_enabled || false);
      }
    } catch (error) {
      console.error("Error fetching maintenance status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { isMaintenance, loading };
}
