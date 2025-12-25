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
import { ImportIcon, MagicIcon } from "@shopify/polaris-icons";

import ProductPreview from "../src/components/ProductPreview";
import ProductPreviewComparison from "../src/components/ProductPreviewComparison";
import ImportOptions from "../src/components/ImportOptions";
import { useImport } from "../hooks/useImport";
import useApi from "../src/hooks/useApi";

export default function ImportSingle() {
  const navigate = useNavigate();
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
  const [importing, setImporting] = useState(false); // FIXED: Added missing state

  const [options, setOptions] = useState({
    status: "draft",
    priceMarkup: 0,
    priceMarkupType: "percentage",
    downloadImages: true,
    inventoryQuantity: 100,
    aiOptimize: false,
  });

  const [selections, setSelections] = useState({
    title: "original",
    description: "original",
    tags: "original",
  });

  const handlePreview = async () => {
    if (!url) return;
    reset();
    const result = await previewProduct(url, { aiOptimize: options.aiOptimize });
    console.log('🔍 Preview Result:', result);
    console.log('📊 AI Optimized Data:', result?.aiOptimizedData);
    console.log('📝 Has optimized_title?', !!result?.aiOptimizedData?.optimized_title);
    console.log('📝 Has original?', !!result?.original);
  };

  const handleImport = async () => {
    if (!url) return;
    setImporting(true); // Ab crash nahi hoga
    try {
      // FIXED: Passing 3 separate arguments as required by your new hook
      const result = await importSingle(url, options, selections);

      if (result && result.success) {
        setUrl("");
        setOptions((prev) => ({ ...prev, aiOptimize: false }));
        // Reset preview taake success ke baad screen saaf ho jaye
        setTimeout(() => reset(), 3000);
      }
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Page
      title="Smart Product Importer"
      primaryAction={{
        content: "Import to Shopify",
        icon: ImportIcon,
        disabled: !preview?.success || importing,
        loading: importing, // Button spinner chalega
        onAction: handleImport,
      }}
    >
      <Layout>
        {/* Success Banner */}
        {importResult?.success && (
          <Layout.Section>
            <Banner tone="success" title="Product imported successfully!" />
          </Layout.Section>
        )}

        {/* Error Banner */}
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Error">{error}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <TextField
                label="Paste Product URL"
                value={url}
                onChange={(v) => setUrl(v)}
                placeholder="Amazon, AliExpress, or Shopify URL"
                connectedRight={
                  <Button
                    variant="primary"
                    onClick={handlePreview}
                    loading={loading}
                  >
                    Fetch Product
                  </Button>
                }
              />
              <InlineStack gap="4">
                <Button
                  icon={MagicIcon}
                  pressed={options.aiOptimize}
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      aiOptimize: !prev.aiOptimize,
                    }))
                  }
                >
                  {options.aiOptimize ? "AI SEO Enabled" : "Enable AI SEO"}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {loading && (
          <Layout.Section>
            <Box padding="20">
              <BlockStack inlineAlign="center" gap="4">
                <Spinner size="large" />
                <Text variant="headingMd">Scraping and optimizing...</Text>
              </BlockStack>
            </Box>
          </Layout.Section>
        )}

        {preview?.success && (
          <>
            <Layout.Section variant="oneHalf">
              {/* Check karein ke product data maujood hai */}
              {preview?.product ? (
                <ProductPreview product={preview.product} />
              ) : (
                <Card padding="500">
                  <Text>Product data is loading or unavailable...</Text>
                </Card>
              )}
            </Layout.Section>

            <Layout.Section variant="oneHalf">
              {/* 1. Check: Agar loading ho rahi hai to Comparison nahi, balki loading state dikhao */}
              {loading ? (
                <Card title="AI Optimizing...">
                  <Box padding="400">
                    <BlockStack gap="4">
                      <Text variant="headingMd">Original Title</Text>
                      <Text>{preview?.product?.title}</Text>
                      <Box paddingBlockStart="200">
                        <Text color="subdued">🤖 AI is generating SEO content, please wait (this can take 10-20s)...</Text>
                      </Box>
                    </BlockStack>
                  </Box>
                </Card>
              ) : (
                /* 2. Check: Loading khatam honay ke baad, dekho AI ka data sahi aaya ya nahi */
                <>
                  {preview?.aiOptimizedData?.optimized_title && preview?.original ? (
                    <ProductPreviewComparison
                      original={preview.original}
                      aiOptimized={preview.aiOptimizedData}
                      selections={selections}
                      onSelectionChange={setSelections}
                    />
                  ) : (
                    /* 3. Fallback: Agar AI fail ho gaya ya data adhoora hai (Kush...), to ye dikhao */
                    <Card title="Product Details">
                      <Box padding="400">
                        <BlockStack gap="4">
                          <Text variant="headingMd">Original Title</Text>
                          <Text>{preview?.product?.title || "No title available"}</Text>
                          {preview?.success && (
                            <Banner tone="warning">
                              AI was unable to optimize this product description. You can still import using original details.
                            </Banner>
                          )}
                        </BlockStack>
                      </Box>
                    </Card>
                  )}
                </>
              )}

              <Box paddingBlockStart="4">
                <ImportOptions options={options} onChange={setOptions} />
              </Box>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}