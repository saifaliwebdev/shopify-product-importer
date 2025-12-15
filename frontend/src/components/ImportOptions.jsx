import React from "react";
import {
  Card,
  FormLayout,
  Select,
  RangeSlider,
  Checkbox,
  TextField,
  BlockStack,
  Text,
  Divider,
} from "@shopify/polaris";

export default function ImportOptions({ options, onChange, collections = [] }) {
  const handleChange = (key, value) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <Card>
      <BlockStack gap="4">
        <Text variant="headingMd" as="h2">
          Import Options
        </Text>
        
        <Divider />

        <FormLayout>
          {/* Product Status */}
          <Select
            label="Product Status"
            options={[
              { label: "Draft (Review before publishing)", value: "draft" },
              { label: "Active (Publish immediately)", value: "active" },
            ]}
            value={options.status}
            onChange={(value) => handleChange("status", value)}
            helpText="Draft is recommended for review"
          />

          {/* Price Markup */}
          <BlockStack gap="2">
            <RangeSlider
              label={`Price Markup: ${options.priceMarkup}${options.priceMarkupType === "percentage" ? "%" : "$"}`}
              value={options.priceMarkup}
              onChange={(value) => handleChange("priceMarkup", value)}
              min={0}
              max={options.priceMarkupType === "percentage" ? 100 : 50}
              step={options.priceMarkupType === "percentage" ? 5 : 1}
              output
              prefix={options.priceMarkupType === "fixed" ? "$" : undefined}
              suffix={options.priceMarkupType === "percentage" ? "%" : undefined}
            />
            
            <Select
              label="Markup Type"
              options={[
                { label: "Percentage (%)", value: "percentage" },
                { label: "Fixed Amount ($)", value: "fixed" },
              ]}
              value={options.priceMarkupType}
              onChange={(value) => handleChange("priceMarkupType", value)}
              helpText="Choose how to apply markup: percentage or fixed amount"
            />
          </BlockStack>

          {/* Collection */}
          {collections.length > 0 && (
            <Select
              label="Add to Collection"
              options={[
                { label: "-- No Collection --", value: "" },
                ...collections.map((c) => ({
                  label: c.title,
                  value: c.id,
                })),
              ]}
              value={options.collectionId || ""}
              onChange={(value) => handleChange("collectionId", value)}
            />
          )}

          <Divider />

          {/* Image Options */}
          <Checkbox
            label="Download and re-upload images"
            checked={options.downloadImages}
            onChange={(value) => handleChange("downloadImages", value)}
            helpText="Recommended for reliability. Images are stored on your Shopify."
          />

          {/* Inventory */}
          <TextField
            label="Default Inventory Quantity"
            type="number"
            value={options.inventoryQuantity?.toString() || "100"}
            onChange={(value) => handleChange("inventoryQuantity", parseInt(value) || 0)}
            min={0}
            helpText="Initial stock quantity for imported products"
          />

          <Divider />

          {/* Naming Options */}
          <TextField
            label="Title Prefix"
            value={options.titlePrefix || ""}
            onChange={(value) => handleChange("titlePrefix", value)}
            placeholder="e.g., [IMPORTED]"
            helpText="Added before product title"
          />

          <TextField
            label="Title Suffix"
            value={options.titleSuffix || ""}
            onChange={(value) => handleChange("titleSuffix", value)}
            placeholder="e.g., - Fast Shipping"
            helpText="Added after product title"
          />

          <TextField
            label="Replace Vendor With"
            value={options.replaceVendor || ""}
            onChange={(value) => handleChange("replaceVendor", value)}
            placeholder="Leave empty to keep original"
            helpText="Override the vendor/brand name"
          />
        </FormLayout>
      </BlockStack>
    </Card>
  );
}
