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
  Divider,
  Badge,
} from "@shopify/polaris";
import { ImportIcon, MagicIcon } from "@shopify/polaris-icons";

import ProductPreview from "../src/components/ProductPreview";
import ProductPreviewComparison from "../src/components/ProductPreviewComparison";
import ImportOptions from "../src/components/ImportOptions";
import { useImport } from "../hooks/useImport";
import useApi from "../src/hooks/useApi";

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
  const [options, setOptions] = useState({
    status: "draft",
    priceMarkup: 0,
    priceMarkupType: "percentage",
    downloadImages: true,
    inventoryQuantity: 100,
    aiOptimize: false, // AI Toggle
  });

  const [selections, setSelections] = useState({
    title: "original",
    description: "original",
    tags: "original",
  });

  // const handlePreview = async () => {
  //   if (!url) return;
  //   reset();
  //   await previewProduct(url);
  // };

  const handlePreview = async () => {
    if (!url) return;
    reset();
    // Hum options.aiOptimize bhej rahe hain backend ko
    await previewProduct(url, { aiOptimize: options.aiOptimize });
  };

  // const handleImport = async () => {
  //   const result = await importSingle(url, { ...options, selections });
  //   if (result.success) { /* Handle success */ }
  // };

  // handleImport function ko update karein:
  const handleImport = async () => {
    if (!url) return;
    setImporting(true);
    try {
      const result = await importSingle(url, { ...options, selections });

      if (result.success) {
        // SUCCESS! Ab sab clear aur reset karein
        setUrl(""); // URL input khali ho gaya
        setOptions({ ...options, aiOptimize: false }); // AI toggle reset
        // Note: ImportResult banner useImport.js hook handle kar raha hai
      }
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
        disabled: !preview?.success,
        onAction: handleImport,
      }}
    >
      <Layout>
        {/* URL Input Area */}
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
                <Text variant="headingMd">
                  Scraping product data and optimizing...
                </Text>
              </BlockStack>
            </Box>
          </Layout.Section>
        )}

        {preview?.success && (
          <>
            {/* Left Side: Images & Variants (Old UI Data) */}
            <Layout.Section variant="oneHalf">
              <ProductPreview product={preview.product} />
            </Layout.Section>

            {/* Right Side: AI vs Original (Sirf tab dikhao jab preview.aiOptimizedData maujood ho) */}
            <Layout.Section variant="oneHalf">
              {preview.aiOptimizedData ? (
                <ProductPreviewComparison
                  original={preview.original}
                  aiOptimized={preview.aiOptimizedData}
                  selections={selections}
                  onSelectionChange={setSelections}
                />
              ) : (
                <Card title="Product Details">
                  <BlockStack gap="4">
                    <Text variant="headingMd">Original Title</Text>
                    <Text>{preview.product.title}</Text>
                    {/* Yahan normal preview dikha dein agar AI off hai */}
                  </BlockStack>
                </Card>
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
