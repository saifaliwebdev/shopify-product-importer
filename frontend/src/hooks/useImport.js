import { useState, useCallback } from "react";
import useApi from "./useApi";

export function useImport() {
  const { post, get, loading, error } = useApi();
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  // Preview product before import
  const previewProduct = useCallback(async (url) => {
    setPreview(null);
    setImportResult(null);
    
    try {
      const data = await post("/api/import/preview", { url });
      setPreview(data);
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [post]);

  // Import single product
  const importSingle = useCallback(async (url, options = {}) => {
    setImportResult(null);
    
    try {
      const data = await post("/api/import/single", { url, options });
      setImportResult(data);
      return data;
    } catch (err) {
      const result = { success: false, error: err.message };
      setImportResult(result);
      return result;
    }
  }, [post]);

  // Import collection
  const importCollection = useCallback(async (url, limit, options = {}) => {
    try {
      const data = await post("/api/import/collection", { url, limit, options });
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [post]);

  // Bulk import from file
  const importBulk = useCallback(async (file, options = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("options", JSON.stringify(options));

    try {
      const data = await post("/api/import/bulk", formData);
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [post]);

  // Check job status
  const checkJobStatus = useCallback(async (jobId) => {
    try {
      const data = await get(`/api/import/status/${jobId}`);
      setJobStatus(data);
      return data;
    } catch (err) {
      return { error: err.message };
    }
  }, [get]);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId, onProgress, interval = 2000) => {
    const poll = async () => {
      const status = await checkJobStatus(jobId);
      
      if (onProgress) onProgress(status);

      if (status.state === "completed" || status.state === "failed") {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
      return poll();
    };

    return poll();
  }, [checkJobStatus]);

  // Clear state
  const reset = useCallback(() => {
    setPreview(null);
    setImportResult(null);
    setJobStatus(null);
  }, []);

  return {
    preview,
    importResult,
    jobStatus,
    loading,
    error,
    previewProduct,
    importSingle,
    importCollection,
    importBulk,
    checkJobStatus,
    pollJobStatus,
    reset,
  };
}

export default useImport;
