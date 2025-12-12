import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import {
  ImportIcon,
  ProductIcon,
  ChartVerticalIcon,
  ClockIcon,
} from "@shopify/polaris-icons";

import StatsCard from "../src/components/StatsCard";
import RecentImports from "../src/components/RecentImports";
import useApi from "../src/hooks/useApi";
import useSettings from "../src/hooks/useSettings";

export default function Dashboard() {
  const navigate = useNavigate();
  const { get } = useApi();
  const { usage, loadUsage } = useSettings();
  const [recentImports, setRecentImports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const historyData = await get("/api/import/history?limit=5");
      setRecentImports(historyData.imports || []);
      await loadUsage();
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const remainingImports = usage ? usage.monthlyLimit - usage.monthlyImports : 0;
  const usagePercent = usage ? Math.round((usage.monthlyImports / usage.monthlyLimit) * 100) : 0;

  return (
    <Page title="Product Importer Pro">
      <BlockStack gap="5">
        {/* Welcome Banner */}
        <Banner
          title="Welcome to Product Importer Pro! 🚀"
          tone="info"
          onDismiss={() => {}}
        >
          <p>
            Import products from any Shopify store, AliExpress, Amazon, and more.
            Start by pasting a product URL!
          </p>
        </Banner>

        {/* Quick Actions */}
        <Card>
          <BlockStack gap="4">
            <Text variant="headingMd" as="h2">
              Quick Actions
            </Text>
            <InlineStack gap="3" wrap>
              <Button
                variant="primary"
                icon={ImportIcon}
                size="large"
                onClick={() => navigate("/import/single")}
              >
                Import Product
              </Button>
              <Button
                icon={ProductIcon}
                size="large"
                onClick={() => navigate("/import/bulk")}
              >
                Bulk Import
              </Button>
              <Button
                icon={ClockIcon}
                size="large"
                onClick={() => navigate("/history")}
              >
                View History
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Stats Grid */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="4">
          <StatsCard
            title="Total Imports"
            value={usage?.totalImports || 0}
            subtitle="All time"
            icon={ProductIcon}
          />
          <StatsCard
            title="This Month"
            value={usage?.monthlyImports || 0}
            subtitle={`of ${usage?.monthlyLimit || 0} allowed`}
            icon={ChartVerticalIcon}
          />
          <StatsCard
            title="Remaining"
            value={remainingImports}
            subtitle="imports this month"
            icon={ImportIcon}
          />
          <StatsCard
            title="Plan"
            value={usage?.plan?.toUpperCase() || "FREE"}
            subtitle="Current subscription"
            icon={ClockIcon}
          />
        </InlineGrid>

        {/* Usage Warning */}
        {usagePercent >= 80 && (
          <Banner
            title={usagePercent >= 100 ? "Import limit reached" : "Running low on imports"}
            tone={usagePercent >= 100 ? "critical" : "warning"}
          >
            <p>
              You've used {usage?.monthlyImports} of {usage?.monthlyLimit} imports this month.
              {usagePercent >= 100
                ? " Upgrade your plan to continue importing."
                : " Consider upgrading your plan."}
            </p>
            <Box paddingBlockStart="2">
              <Button onClick={() => navigate("/settings")}>
                Manage Subscription
              </Button>
            </Box>
          </Banner>
        )}

        {/* Main Content */}
        <Layout>
          <Layout.Section>
            <RecentImports
              imports={recentImports}
              onItemClick={(item) => navigate(`/history?id=${item._id}`)}
            />
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="4">
                <Text variant="headingMd" as="h2">
                  Supported Platforms
                </Text>
                <Divider />
                <BlockStack gap="2">
                  {[
                    { name: "Shopify Stores", status: "✅ Full Support" },
                    { name: "AliExpress", status: "✅ Full Support" },
                    { name: "Amazon", status: "✅ Full Support" },
                    { name: "eBay", status: "🔄 Coming Soon" },
                    { name: "Etsy", status: "🔄 Coming Soon" },
                    { name: "Any Website", status: "⚡ Basic Support" },
                  ].map((platform, index) => (
                    <InlineStack key={index} align="space-between">
                      <Text>{platform.name}</Text>
                      <Text tone="subdued">{platform.status}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            <Box paddingBlockStart="4">
              <Card>
                <BlockStack gap="4">
                  <Text variant="headingMd" as="h2">
                    Need Help?
                  </Text>
                  <Divider />
                  <BlockStack gap="2">
                    <Button fullWidth url="#" external>
                      📖 Documentation
                    </Button>
                    <Button fullWidth url="#" external>
                      💬 Contact Support
                    </Button>
                    <Button fullWidth url="#" external>
                      ⭐ Rate Us
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Box>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
