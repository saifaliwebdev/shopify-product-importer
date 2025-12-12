import { useState, useEffect, useCallback } from "react";
import useApi from "./useApi";

export function useSettings() {
  const { get, put, loading, error } = useApi();
  const [settings, setSettings] = useState(null);
  const [usage, setUsage] = useState(null);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const data = await get("/api/settings");
      setSettings(data);
      return data;
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, [get]);

  // Update settings
  const updateSettings = useCallback(async (updates) => {
    try {
      const data = await put("/api/settings", updates);
      setSettings(data);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [put]);

  // Load usage stats
  const loadUsage = useCallback(async () => {
    try {
      const data = await get("/api/settings/usage");
      setUsage(data);
      return data;
    } catch (err) {
      console.error("Failed to load usage:", err);
    }
  }, [get]);

  // Load on mount
  useEffect(() => {
    loadSettings();
    loadUsage();
  }, []);

  return {
    settings,
    usage,
    loading,
    error,
    loadSettings,
    updateSettings,
    loadUsage,
  };
}

export default useSettings;