import React from "react";
import {
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import { formatRelativeTime, getStatusColor, truncate } from "../utils/helpers";

export default function RecentImports({ imports = [], onItemClick }) {
  if (imports.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No imports yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Import your first product to get started!</p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="4">
        <Text variant="headingMd" as="h2">
          Recent Imports
        </Text>

        <ResourceList
          resourceName={{ singular: "import", plural: "imports" }}
          items={imports}
          renderItem={(item) => {
            const { _id, product_title, source_platform, status, createdAt, source_url } = item;

            return (
              <ResourceItem
                id={_id}
                onClick={() => onItemClick && onItemClick(item)}
                accessibilityLabel={`View details for ${product_title}`}
              >
                <InlineStack gap="4" align="space-between" blockAlign="center">
                  <BlockStack gap="1">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {truncate(product_title || "Unknown Product", 40)}
                    </Text>
                    <InlineStack gap="2">
                      <Badge tone="info">{source_platform}</Badge>
                      <Badge tone={getStatusColor(status)}>{status}</Badge>
                    </InlineStack>
                  </BlockStack>

                  <Text variant="bodySm" tone="subdued">
                    {formatRelativeTime(createdAt)}
                  </Text>
                </InlineStack>
              </ResourceItem>
            );
          }}
        />
      </BlockStack>
    </Card>
  );
}