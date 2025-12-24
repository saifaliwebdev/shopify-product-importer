import { useState, useCallback } from "react";
import useApi from "../src/hooks/useApi";

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

  //   const previewProduct = useCallback(
  //     async (url, aiOptimize = false) => {
  //       setLoading(true);
  //       setError("");
  //       setPreview(null);
  //       try {
  //         const data = await post("/api/import/preview", { url, aiOptimize });
  //         setPreview(data);
  //       } catch (err) {
  //         const msg = err?.message || "Failed to fetch product preview";
  //         setError(msg);
  //         setPreview({ success: false, error: msg });
  //       } finally {
  //         setLoading(false);
  //       }
  //     },
  //     [post]
  //   );
  // frontend/src/hooks/useImport.js mein previewProduct ko update karein:

  const previewProduct = useCallback(
    async (url, extraOptions = {}) => {
      setLoading(true);
      setError(null);
      try {
        // extraOptions mein aiOptimize pass hoga
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
    async (productData, options, selections) => {
      setImporting(true);
      setError("");
      try {
        const data = await post("/api/import", {
          productData,
          options,
          selections,
        });
        setImportResult(data);
        return data;
      } catch (err) {
        const msg = err?.message || "Import failed";
        setError(msg);
        const result = { success: false, error: msg };
        setImportResult(result);
        return result;
      } finally {
        setImporting(false);
      }
    },
    [post]
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
