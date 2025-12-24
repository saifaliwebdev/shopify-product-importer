import { useState, useCallback } from "react";
import useApi from "../src/hooks/useApi"; // Path sahi rakhein

export function useImport() {
  const { post } = useApi();
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setPreview(null);
    setImportResult(null);
    setError("");
    setLoading(false);
    setImporting(false);
  }, []);

  const previewProduct = useCallback(
    async (url, extraOptions = {}) => {
      setLoading(true);
      setError(null);
      try {
        const response = await post("/api/import/preview", {
          url,
          ...extraOptions,
        });
        if (response.success) {
          setPreview(response);
        } else {
          setError(response.error || "Failed to fetch product preview");
        }
      } catch (err) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [post]
  );

  const importSingle = useCallback(
    async (url, options, selections) => { // URL bhejna zaroori hai
      setImporting(true);
      setError("");
      try {
        // FIXED: URL change to /api/import/single and passing 'url'
        const data = await post("/api/import/single", {
          url, 
          options,
          selections,
          aiOptimizedData: preview?.aiOptimizedData // AI data bhi bhej rahe hain
        });
        
        if (data.success) {
          setImportResult(data);
        } else {
          setError(data.error || "Import failed");
        }
        return data;
      } catch (err) {
        const msg = err?.message || "Import failed";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setImporting(false);
      }
    },
    [post, preview]
  );

  return {
    preview,
    importResult,
    loading,
    importing,
    error,
    previewProduct,
    importSingle,
    reset,
  };
}

export default useImport;
