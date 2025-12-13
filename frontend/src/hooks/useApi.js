import { useCallback, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  let app;
  try {
    app = useAppBridge();
  } catch (err) {
    // App Bridge not available (development mode)
    console.warn("App Bridge not available, falling back to regular fetch");
  }

  const fetchApi = useCallback(async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      let response;

      if (app && app.authenticatedFetch) {
        // Use authenticatedFetch from App Bridge for embedded apps
        console.log("Using authenticatedFetch for:", endpoint);
        response = await app.authenticatedFetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          ...options,
        });
      } else {
        // Fallback to regular fetch (development)
        console.log("Using regular fetch for:", endpoint);
        response = await fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          ...options,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      return data;
    } catch (err) {
      console.error("API call failed:", err.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [app]);

  const get = useCallback((endpoint) => fetchApi(endpoint), [fetchApi]);

  const post = useCallback(
    (endpoint, body) =>
      fetchApi(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [fetchApi]
  );

  const put = useCallback(
    (endpoint, body) =>
      fetchApi(endpoint, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    [fetchApi]
  );

  const del = useCallback(
    (endpoint) =>
      fetchApi(endpoint, {
        method: "DELETE",
      }),
    [fetchApi]
  );

  return { get, post, put, del, loading, error };
}

export default useApi;
