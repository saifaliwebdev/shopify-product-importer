import { useState, useCallback } from "react";
import useApi from "../src/hooks/useApi";

export const useImport = () => {
  const { post } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const previewProduct = useCallback(async (url) => {
    setLoading(true);
    setError(null);
    try {
      // Backend ko request bhej rahe hain product fetch karne ke liye
      const response = await post("/api/import/preview", { url });
      if (response.success) {
        setPreview(response);
      } else {
        setError(response.error || "Failed to fetch product preview");
      }
    } catch (err) {
      setError(err.message || "An error occurred during preview");
    } finally {
      setLoading(false);
    }
  }, [post]);

  const importSingle = useCallback(async (url, options) => {
    setError(null);
    try {
      const response = await post("/api/import/single", { url, ...options });
      setImportResult(response);
      return response;
    } catch (err) {
      setImportResult({ success: false, error: err.message });
      return { success: false, error: err.message };
    }
  }, [post]);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setImportResult(null);
  }, []);

  return {
    preview,
    importResult,
    loading,
    error,
    previewProduct,
    importSingle,
    reset
  };
};