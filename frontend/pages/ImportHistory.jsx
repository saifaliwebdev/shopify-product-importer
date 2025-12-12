import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  Pagination,
  EmptyState,
  Filters,
  ChoiceList,
  BlockStack,
  InlineStack,
  Text,
  Modal,
  Box,
  Spinner,
} from "@shopify/polaris";
import { RefreshIcon, ViewIcon } from "@shopify/polaris-icons";

import useApi from "../src/hooks/useApi";
import {
  formatDate,
  getStatusColor,
  truncate,
  getDomain,
} from "../src/utils/helpers";

export default function ImportHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { get, loading } = useApi();

  const [imports, setImports] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  
  const [statusFilter, setStatusFilter] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Load imports
  useEffect(() => {
    loadImports();
  }, [pagination.page, statusFilter]);

  // Check for id param
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const found = imports.find((i) => i._id === id);
      if (found) {
        setSelectedImport(found);
        setModalOpen(true);
      }
    }
  }, [searchParams, imports]);

  const loadImports = async () => {
    try {
      let url = `/api/import/history?page=${pagination.page}&limit=${pagination.limit}`;
      if (statusFilter.length > 0) {
        url += `&status=${statusFilter.join(",")}`;
      }

      const data = await get(url);
      setImports(data.imports || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Failed to load imports:", error);
    }
  };

  // Handle page change
  const handlePageChange = (direction) => {
    setPagination((prev) => ({
      ...prev,
      page: direction === "next" ? prev.page + 1 : prev.page - 1,
    }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setStatusFilter([]);
  };

  // Open detail modal
  const handleViewDetails = (item) => {
    setSelectedImport(item);
    setModalOpen(true);
  };

  // Format table rows
  const rows = imports.map((item) => [
    <InlineStack gap="2" blockAlign="center" key={item._id}>
      <BlockStack gap="1">
        <Text variant="bodyMd" fontWeight="semibold">
          {truncate(item.product_title || "Unknown", 30)}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {getDomain(item.source_url)}
        </Text>
      </BlockStack>
    </InlineStack>,
    <Badge tone="info">{item.source_platform}</Badge>,
    <Badge tone={getStatusColor(item.status)}>{item.status}</Badge>,
    item.import_type || "single",
    formatDate(item.createdAt),
    <Button
      icon={ViewIcon}
      onClick={() => handleViewDetails(item)}
      accessibilityLabel="View details"
    />,
  ]);

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: "Success", value: "success" },
            { label: "Failed", value: "failed" },
            { label: "Pending", value: "pending" },
            { label: "Processing", value: "processing" },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.length > 0
    ? [
        {
          key: "status",
          label: `Status: ${statusFilter.join(", ")}`,
          onRemove: () => setStatusFilter([]),
        },
      ]
    : [];

  return (
    <Page
      title="Import History"
      subtitle={`${pagination.total} total imports`}
      backAction={{ content: "Dashboard", onAction: () => navigate("/") }}
      primaryAction={{
        content: "Refresh",
        icon: RefreshIcon,
        onAction: loadImports,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Filters
                filters={filters}
                appliedFilters={appliedFilters}
                onClearAll={handleClearFilters}
                hideQueryField
              />

              {loading ? (
                <Box padding="8">
                  <BlockStack gap="4" inlineAlign="center">
                    <Spinner size="large" />
                    <Text>Loading imports...</Text>
                  </BlockStack>
                </Box>
              ) : imports.length === 0 ? (
                <EmptyState
                  heading="No imports found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{
                    content: "Import Your First Product",
                    onAction: () => navigate("/import/single"),
                  }}
                >
                  <p>Start importing products to see them here.</p>
                </EmptyState>
              ) : (
                <>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                    headings={[
                      "Product",
                      "Platform",
                      "Status",
                      "Type",
                      "Date",
                      "Actions",
                    ]}
                    rows={rows}
                  />

                  <Box padding="4">
                    <InlineStack align="center">
                      <Pagination
                        hasPrevious={pagination.page > 1}
                        hasNext={pagination.page < pagination.pages}
                        onPrevious={() => handlePageChange("prev")}
                        onNext={() => handlePageChange("next")}
                      />
                    </InlineStack>
                  </Box>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Detail Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Import Details"
        primaryAction={{
          content: "Close",
          onAction: () => setModalOpen(false),
        }}
        secondaryActions={
          selectedImport?.product_id
            ? [
                {
                  content: "View Product",
                  external: true,
                  url: `https://admin.shopify.com/products/${selectedImport.product_id.split("/").pop()}`,
                },
              ]
            : []
        }
      >
        <Modal.Section>
          {selectedImport && (
            <BlockStack gap="4">
              <InlineStack align="space-between">
                <Text variant="bodyMd" fontWeight="semibold">
                  Product Title
                </Text>
                <Text>{selectedImport.product_title || "N/A"}</Text>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodyMd" fontWeight="semibold">
                  Status
                </Text>
                <Badge tone={getStatusColor(selectedImport.status)}>
                  {selectedImport.status}
                </Badge>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodyMd" fontWeight="semibold">
                  Platform
                </Text>
                <Badge tone="info">{selectedImport.source_platform}</Badge>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodyMd" fontWeight="semibold">
                  Import Type
                </Text>
                <Text>{selectedImport.import_type || "single"}</Text>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodyMd" fontWeight="semibold">
                  Date
                </Text>
                <Text>{formatDate(selectedImport.createdAt)}</Text>
              </InlineStack>

              <BlockStack gap="2">
                <Text variant="bodyMd" fontWeight="semibold">
                  Source URL
                </Text>
                <Text variant="bodySm" tone="subdued" breakWord>
                  {selectedImport.source_url}
                </Text>
              </BlockStack>

              {selectedImport.error && (
                <Box padding="3" background="bg-surface-critical" borderRadius="2">
                  <BlockStack gap="2">
                    <Text variant="bodyMd" fontWeight="semibold" tone="critical">
                      Error
                    </Text>
                    <Text tone="critical">{selectedImport.error}</Text>
                  </BlockStack>
                </Box>
              )}

              {selectedImport.stats && (
                <BlockStack gap="2">
                  <Text variant="bodyMd" fontWeight="semibold">
                    Stats
                  </Text>
                  <InlineStack gap="4">
                    <Text>Images: {selectedImport.stats.images_imported}</Text>
                    <Text>Variants: {selectedImport.stats.variants_imported}</Text>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
