import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box,
  ProgressBar,
} from "@shopify/polaris";

import useSettings from "../src/hooks/useSettings";

export default function Settings() {
  const navigate = useNavigate();
  const { settings, usage, loading, updateSettings, loadSettings } = useSettings();
  
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  // Initialize form data
  useEffect(() => {
    if (settings) {
      setFormData({
        defaults: { ...settings.defaults },
        naming: { ...settings.naming },
        description: { ...settings.description },
        images: { ...settings.images },
        inventory: { ...settings.inventory },
      });
    }
  }, [settings]);

  // Handle form changes
  const handleChange = (section, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const result = await updateSettings(formData);
      setSaveResult(result);
    } catch (error) {
      setSaveResult({ success: false, error: error.message });
    } finally {
      setSaving(false);
    }
  };

  // Usage percentage
  const usagePercent = usage
    ? Math.round((usage.monthlyImports / usage.monthlyLimit) * 100)
    : 0;

  if (!formData) {
    return (
      <Page title="Settings">
        <Card>
          <Text>Loading settings...</Text>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Settings"
      subtitle="Configure your import preferences"
      backAction={{ content: "Dashboard", onAction: () => navigate("/") }}
      primaryAction={{
        content: "Save Settings",
        loading: saving,
        onAction: handleSave,
      }}
    >
      <Layout>
        {/* Save Result Banner */}
        {saveResult && (
          <Layout.Section>
            <Banner
              title={saveResult.success ? "Settings saved!" : "Failed to save"}
              tone={saveResult.success ? "success" : "critical"}
              onDismiss={() => setSaveResult(null)}
            />
          </Layout.Section>
        )}

        {/* Usage & Plan */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Usage & Plan
              </Text>
              <Divider />

              <InlineStack align="space-between">
                <BlockStack gap="1">
                  <Text variant="headingLg">
                    {usage?.plan?.toUpperCase() || "FREE"} Plan
                  </Text>
                  <Text tone="subdued">
                    {usage?.monthlyImports || 0} / {usage?.monthlyLimit || 10} imports this month
                  </Text>
                </BlockStack>
                <Button>Upgrade Plan</Button>
              </InlineStack>

              <ProgressBar
                progress={Math.min(usagePercent, 100)}
                size="medium"
                tone={usagePercent >= 90 ? "critical" : usagePercent >= 70 ? "warning" : "primary"}
              />

              {usagePercent >= 80 && (
                <Banner
                  tone={usagePercent >= 100 ? "critical" : "warning"}
                  title={usagePercent >= 100 ? "Limit reached" : "Running low"}
                >
                  <p>
                    {usagePercent >= 100
                      ? "You've reached your monthly limit. Upgrade to continue importing."
                      : "Consider upgrading to avoid interruption."}
                  </p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Default Import Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Default Import Settings
              </Text>
              <Divider />

              <FormLayout>
                <Select
                  label="Default Product Status"
                  options={[
                    { label: "Draft", value: "draft" },
                    { label: "Active", value: "active" },
                  ]}
                  value={formData.defaults.status}
                  onChange={(v) => handleChange("defaults", "status", v)}
                  helpText="New products will be created with this status"
                />

                <TextField
                  label="Default Price Markup (%)"
                  type="number"
                  value={formData.defaults.priceMarkup?.toString() || "0"}
                  onChange={(v) => handleChange("defaults", "priceMarkup", parseInt(v) || 0)}
                  suffix="%"
                  helpText="Automatically increase prices by this percentage"
                />

                <Checkbox
                  label="Download and re-upload images"
                  checked={formData.defaults.downloadImages}
                  onChange={(v) => handleChange("defaults", "downloadImages", v)}
                  helpText="Store images on your Shopify (recommended)"
                />

                <Checkbox
                  label="Auto-publish products"
                  checked={formData.defaults.autoPublish}
                  onChange={(v) => handleChange("defaults", "autoPublish", v)}
                  helpText="Automatically publish to sales channels"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Naming Rules */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Product Naming
              </Text>
              <Divider />

              <FormLayout>
                <TextField
                  label="Title Prefix"
                  value={formData.naming.prefixTitle || ""}
                  onChange={(v) => handleChange("naming", "prefixTitle", v)}
                  placeholder="e.g., [NEW]"
                  helpText="Added before every product title"
                />

                <TextField
                  label="Title Suffix"
                  value={formData.naming.suffixTitle || ""}
                  onChange={(v) => handleChange("naming", "suffixTitle", v)}
                  placeholder="e.g., - Fast Shipping"
                  helpText="Added after every product title"
                />

                <TextField
                  label="Replace Vendor With"
                  value={formData.naming.replaceVendor || ""}
                  onChange={(v) => handleChange("naming", "replaceVendor", v)}
                  placeholder="Your Brand Name"
                  helpText="Override vendor name for all imports"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Description Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Description Settings
              </Text>
              <Divider />

              <FormLayout>
                <Checkbox
                  label="Keep original description"
                  checked={formData.description.keepOriginal}
                  onChange={(v) => handleChange("description", "keepOriginal", v)}
                />

                <Checkbox
                  label="Remove links from description"
                  checked={formData.description.removeLinks}
                  onChange={(v) => handleChange("description", "removeLinks", v)}
                  helpText="Automatically remove external links"
                />

                <TextField
                  label="Append to Description"
                  value={formData.description.appendText || ""}
                  onChange={(v) => handleChange("description", "appendText", v)}
                  multiline={3}
                  placeholder="Add shipping info, return policy, etc."
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Image Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Image Settings
              </Text>
              <Divider />

              <FormLayout>
                <TextField
                  label="Maximum Images"
                  type="number"
                  value={formData.images.maxImages?.toString() || "10"}
                  onChange={(v) => handleChange("images", "maxImages", parseInt(v) || 10)}
                  min={1}
                  max={20}
                  helpText="Maximum images to import per product"
                />

                <Checkbox
                  label="Compress images"
                  checked={formData.images.compressImages}
                  onChange={(v) => handleChange("images", "compressImages", v)}
                  helpText="Reduce file size (may affect quality)"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Inventory Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h2">
                Inventory Settings
              </Text>
              <Divider />

              <FormLayout>
                <TextField
                  label="Default Inventory Quantity"
                  type="number"
                  value={formData.inventory.defaultQuantity?.toString() || "100"}
                  onChange={(v) => handleChange("inventory", "defaultQuantity", parseInt(v) || 100)}
                  min={0}
                />

                <Checkbox
                  label="Track inventory"
                  checked={formData.inventory.trackInventory}
                  onChange={(v) => handleChange("inventory", "trackInventory", v)}
                />

                <Checkbox
                  label="Continue selling when out of stock"
                  checked={formData.inventory.continueSellingWhenOutOfStock}
                  onChange={(v) => handleChange("inventory", "continueSellingWhenOutOfStock", v)}
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Save Button (Bottom) */}
        <Layout.Section>
          <InlineStack align="end">
            <Button variant="primary" loading={saving} onClick={handleSave}>
              Save Settings
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
