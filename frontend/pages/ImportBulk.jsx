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
  DropZone,
  Thumbnail,
  List,
  Divider,
  Box,
  Tabs,
} from "@shopify/polaris";
import { ImportIcon, DeleteIcon } from "@shopify/polaris-icons";

import ImportOptions from "../src/components/ImportOptions";
import ImportProgress from "../src/components/ImportProgress";
import useImport from "../src/hooks/useImport";
import useApi from "../src/hooks/useApi";
import { isValidUrl } from "../src/utils/helpers";

export default function ImportBulk() {
  const navigate = useNavigate();
  const { get } = useApi();
  const { importCollection, importBulk } = useImport();

  const [tabIndex, setTabIndex] = useState(0);
  const [collections, setCollections] = useState([]);
  
  // Collection import
  const [collectionUrl, setCollectionUrl] = useState("");
  const [productLimit, setProductLimit] = useState("50");
  
  // Bulk URL import
  const [urls, setUrls] = useState("");
  
  // File upload
  const [file, setFile] = useState(null);
  
  // Common
  const [options, setOptions] = useState({
    status: "draft",
    priceMarkup: 0,
    priceMarkupType: "percentage",
    downloadImages: true,
    inventoryQuantity: 100,
  });
  
  const [jobId, setJobId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

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

  // Handle collection import
  const handleCollectionImport = async () => {
    if (!collectionUrl || !isValidUrl(collectionUrl)) {
      setError("Please enter a valid collection URL");
      return;
    }

    setImporting(true);
    setError("");
    setJobId(null);

    try {
      const result = await importCollection(collectionUrl, parseInt(productLimit), options);
      
      if (result.success && result.jobId) {
        setJobId(result.jobId);
      } else {
        setError(result.error || "Failed to start import");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Handle bulk URL import
  const handleBulkUrlImport = async () => {
    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u && isValidUrl(u));

    if (urlList.length === 0) {
      setError("Please enter at least one valid URL");
      return;
    }

    setImporting(true);
    setError("");
    setJobId(null);

    try {
      // Create a temporary file-like object with URLs
      const blob = new Blob([urlList.map((u) => `url\n${u}`).join("\n")], {
        type: "text/csv",
      });
      const tempFile = new File([blob], "urls.csv", { type: "text/csv" });

      const result = await importBulk(tempFile, options);
      
      if (result.success && result.jobId) {
        setJobId(result.jobId);
      } else {
        setError(result.error || "Failed to start import");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Handle file upload import
  const handleFileImport = async () => {
    if (!file) {
      setError("Please upload a file");
      return;
    }

    setImporting(true);
    setError("");
    setJobId(null);

    try {
      const result = await importBulk(file, options);
      
      if (result.success && result.jobId) {
        setJobId(result.jobId);
      } else {
        setError(result.error || "Failed to start import");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Handle file drop
  const handleDrop = useCallback((files) => {
    const uploadedFile = files[0];
    if (uploadedFile) {
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      
      if (validTypes.includes(uploadedFile.type) || uploadedFile.name.match(/\.(csv|xlsx|xls)$/)) {
        setFile(uploadedFile);
        setError("");
      } else {
        setError("Please upload a CSV or Excel file");
      }
    }
  }, []);

  // Handle import completion
  const handleImportComplete = (status) => {
    // Could show notification or redirect
    console.log("Import completed:", status);
  };

  const tabs = [
    {
      id: "collection",
      content: "Collection Import",
      panelID: "collection-panel",
    },
    {
      id: "urls",
      content: "Paste URLs",
      panelID: "urls-panel",
    },
    {
      id: "file",
      content: "Upload File",
      panelID: "file-panel",
    },
  ];

  return (
    <Page
      title="Bulk Import"
      subtitle="Import multiple products at once"
      backAction={{ content: "Dashboard", onAction: () => navigate("/") }}
    >
      <Layout>
        {/* Error Banner */}
        {error && (
          <Layout.Section>
            <Banner
              title="Error"
              tone="critical"
              onDismiss={() => setError("")}
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Progress (if job is running) */}
        {jobId && (
          <Layout.Section>
            <ImportProgress jobId={jobId} onComplete={handleImportComplete} />
          </Layout.Section>
        )}

        {/* Import Methods */}
        {!jobId && (
          <>
            <Layout.Section>
              <Card>
                <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>
                  <Box padding="4">
                    {/* Collection Import */}
                    {tabIndex === 0 && (
                      <BlockStack gap="4">
                        <TextField
                          label="Collection URL"
                          value={collectionUrl}
                          onChange={setCollectionUrl}
                          placeholder="https://store.myshopify.com/collections/featured"
                          helpText="Enter a Shopify collection URL or AliExpress category URL"
                        />
                        
                        <TextField
                          label="Product Limit"
                          type="number"
                          value={productLimit}
                          onChange={setProductLimit}
                          min={1}
                          max={100}
                          helpText="Maximum number of products to import (1-100)"
                        />

                        <Button
                          variant="primary"
                          icon={ImportIcon}
                          onClick={handleCollectionImport}
                          loading={importing}
                          disabled={!collectionUrl}
                        >
                          Import Collection
                        </Button>
                      </BlockStack>
                    )}

                    {/* Paste URLs */}
                    {tabIndex === 1 && (
                      <BlockStack gap="4">
                        <TextField
                          label="Product URLs"
                          value={urls}
                          onChange={setUrls}
                          multiline={8}
                          placeholder="https://store.com/products/product-1
https://store.com/products/product-2
https://aliexpress.com/item/123456.html"
                          helpText="Enter one URL per line"
                        />

                        <Text variant="bodySm" tone="subdued">
                          {urls.split("\n").filter((u) => u.trim() && isValidUrl(u.trim())).length} valid URL(s) detected
                        </Text>

                        <Button
                          variant="primary"
                          icon={ImportIcon}
                          onClick={handleBulkUrlImport}
                          loading={importing}
                          disabled={!urls.trim()}
                        >
                          Import URLs
                        </Button>
                      </BlockStack>
                    )}

                    {/* File Upload */}
                    {tabIndex === 2 && (
                      <BlockStack gap="4">
                        <DropZone onDrop={handleDrop} accept=".csv,.xlsx,.xls">
                          {file ? (
                            <BlockStack gap="2" inlineAlign="center">
                              <Thumbnail
                                source="https://cdn.shopify.com/s/files/1/0757/9955/files/New_Post.png"
                                alt="File"
                                size="small"
                              />
                              <Text variant="bodyMd">{file.name}</Text>
                              <Text variant="bodySm" tone="subdued">
                                {(file.size / 1024).toFixed(1)} KB
                              </Text>
                              <Button
                                icon={DeleteIcon}
                                tone="critical"
                                onClick={() => setFile(null)}
                              >
                                Remove
                              </Button>
                            </BlockStack>
                          ) : (
                            <DropZone.FileUpload />
                          )}
                        </DropZone>

                        <Divider />

                        <BlockStack gap="2">
                          <Text variant="headingSm">File Format</Text>
                          <Text variant="bodySm" tone="subdued">
                            Upload a CSV or Excel file with a column named "url" or "URL"
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            Example:
                          </Text>
                          <Box padding="2" background="bg-surface-secondary" borderRadius="2">
                            <Text variant="bodyMd" fontWeight="medium">
                              url<br />
                              https://store.com/products/product-1<br />
                              https://store.com/products/product-2
                            </Text>
                          </Box>
                        </BlockStack>

                        <Button
                          variant="primary"
                          icon={ImportIcon}
                          onClick={handleFileImport}
                          loading={importing}
                          disabled={!file}
                        >
                          Import from File
                        </Button>
                      </BlockStack>
                    )}
                  </Box>
                </Tabs>
              </Card>
            </Layout.Section>

            {/* Import Options */}
            <Layout.Section variant="oneThird">
              <ImportOptions
                options={options}
                onChange={setOptions}
                collections={collections}
              />

              <Box paddingBlockStart="4">
                <Card>
                  <BlockStack gap="3">
                    <Text variant="headingMd">Tips</Text>
                    <Divider />
                    <List type="bullet">
                      <List.Item>
                        Start with a small batch to test
                      </List.Item>
                      <List.Item>
                        Use "Draft" status to review before publishing
                      </List.Item>
                      <List.Item>
                        Large imports run in background
                      </List.Item>
                      <List.Item>
                        Check history for import status
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>
              </Box>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
