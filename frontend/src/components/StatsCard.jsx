import React from "react";
import { Card, Text, BlockStack, InlineStack, Icon } from "@shopify/polaris";

export default function StatsCard({ title, value, subtitle, icon, trend }) {
  return (
    <Card>
      <BlockStack gap="2">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">
            {title}
          </Text>
          {icon && <Icon source={icon} tone="subdued" />}
        </InlineStack>
        
        <Text variant="heading2xl" as="p" fontWeight="bold">
          {value}
        </Text>
        
        {subtitle && (
          <Text variant="bodySm" tone="subdued">
            {subtitle}
          </Text>
        )}
        
        {trend && (
          <Text
            variant="bodySm"
            tone={trend > 0 ? "success" : trend < 0 ? "critical" : "subdued"}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}% from last month
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
