import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Spinner,
  Box,
} from "@shopify/polaris";
import { ImportIcon } from "@shopify/polaris-icons";

import ProductPreviewComparison from "../src/components/ProductPreviewComparison";
import ImportOptions from "../src/components/ImportOptions";
import { useImport } from "../src/hooks/useImport";
import useApi from "../src/hooks/useApi";
import { isValidUrl } from "../src/utils/helpers";

export default function ImportSingle() {
  const navigate = useNavigate();
  const { get } = useApi();
  const {
    preview,
    importResult,
    loading,
    error,
    previewProduct,
    importSingle,
    reset,
  } = useImport();

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [importing, setImporting] = useState(false);
  const [collections, setCollections] = useState([]);

  const [options, setOptions] = useState({
    status: "draft",
    priceMarkup: 0,
    priceMarkupType: "percentage",
    downloadImages: true,
    inventoryQuantity: 100,
    titlePrefix: "",
    titleSuffix: "",
    replaceVendor: "",
    collectionId: "",
    aiOptimize: false,
  });

  const [selections, setSelections] = useState({
    title: 'ai',
    description: 'ai',
    tags: 'ai'
  });

  // Load collections
  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const data = await get("/api/products/collections");
      setCollections(data || []);
    } catch (err) {
      console.error("Failed to load collections:", err);
    }
  };

  // Validate URL
  const validateUrl = (value) => {
    if (!value) {
      setUrlError("Please enter a product URL");
      return false;
    }
    if (!isValidUrl(value)) {
      setUrlError("Please enter a valid URL");
      return false;
    }
    setUrlError("");
    return true;
  };

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!validateUrl(url)) return;

    reset();
    await previewProduct(url);
  }, [url, previewProduct, reset]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!validateUrl(url)) return;

    setImporting(true);
    try {
      const result = await importSingle(url, {
        ...options,
        selections
      });
      
      if (result.success) {
        // Show success, optionally redirect
      }
    } finally {
      setImporting(false);
    }
  }, [url, options, selections, importSingle]);

  // Handle URL change
  const handleUrlChange = (value) => {
    setUrl(value);
    if (urlError) validateUrl(value);
    if (preview) reset();
  };

  return (
    <Page
      title="Import Single Product"
      subtitle="Paste a product URL to import it to your store"
      backAction={{ content: "Dashboard", onAction: () => navigate("/") }}
      primaryAction={{
        content: "Import Product",
        icon: ImportIcon,
        disabled: !preview?.success || importing,
        loading: importing,
        onAction: handleImport,
      }}
    >
      <Layout>
        {/* URL Input Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <TextField
                label="Product URL"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com/products/product-name"
                error={urlError}
                autoComplete="off"
                helpText="Paste a product URL from Shopify"
                connectedRight={
                  <Button
                    onClick={handlePreview}
                    loading={loading}
                    disabled={!url}
                  >
                    Preview
                  </Button>
                }
              />

              {/* Supported platforms hint */}
              <InlineStack gap="2" wrap>
                <Text variant="bodySm" tone="subdued">
                  Supported:
                </Text>
                {["Shopify", "AliExpress", "Amazon", "Any URL"].map((p) => (
                  <Box
                    key={p}
                    padding="1"
                    background="bg-surface-secondary"
                    borderRadius="1"
                  >
                    <Text variant="bodySm">{p}</Text>
                  </Box>
                ))}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Error Banner */}
        {(error || (preview && !preview.success)) && (
          <Layout.Section>
            <Banner
              title="Failed to fetch product"
              tone="critical"
              onDismiss={reset}
            >
              <p>{error || preview?.error || "Could not scrape product from this URL"}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Import Result */}
        {importResult && (
          <Layout.Section>
            {importResult.success ? (
              <Banner
                title="Product imported successfully! 🎉"
                tone="success"
                onDismiss={reset}
              >
                <BlockStack gap="2">
                  <p>
                    <strong>{importResult.product?.title}</strong> has been added to
                    your store.
                  </p>
                  <InlineStack gap="2">
                    <Button
                      url={`https://admin.shopify.com/store/YOUR_STORE/products/${importResult.product?.id?.split("/").pop()}`}
                      external
                    >
                      View Product
                    </Button>
                    <Button
                      onClick={() => {
                        reset();
                        setUrl("");
                      }}
                    >
                      Import Another
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Banner>
            ) : (
              <Banner
                title="Import failed"
                tone="critical"
                onDismiss={reset}
              >
                <p>{importResult.error}</p>
              </Banner>
            )}
          </Layout.Section>
        )}

        {/* Loading State */}
        {loading && (
          <Layout.Section>
            <Card>
              <BlockStack gap="4" inlineAlign="center">
                <Spinner size="large" />
                <Text>Fetching product details...</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Preview & Options */}
        {preview?.success && preview.product && (
          <>
            <Layout.Section>
              <ProductPreviewComparison
                original={preview.original}
                aiOptimized={preview.aiOptimized}
                selections={selections}
                onSelectionChange={setSelections}
              />
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <ImportOptions
                options={options}
                onChange={setOptions}
                collections={collections}
              />

              <Box paddingBlockStart="4">
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  icon={ImportIcon}
                  onClick={handleImport}
                  loading={importing}
                >
                  Import to Store
                </Button>
              </Box>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
