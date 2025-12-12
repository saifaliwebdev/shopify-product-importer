import React, { useEffect, useState } from "react";
import {
  Card,
  ProgressBar,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Spinner,
  Box,
  Divider,
  List,
} from "@shopify/polaris";

export default function ImportProgress({ jobId, onComplete }) {
  const [status, setStatus] = useState(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!jobId || !polling) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/import/status/${jobId}`);
        const data = await response.json();
        setStatus(data);

        if (data.state === "completed" || data.state === "failed") {
          setPolling(false);
          if (onComplete) onComplete(data);
        }
      } catch (error) {
        console.error("Failed to fetch job status:", error);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId, polling, onComplete]);

  if (!status) {
    return (
      <Card>
        <BlockStack gap="4" align="center">
          <Spinner size="large" />
          <Text>Starting import...</Text>
        </BlockStack>
      </Card>
    );
  }

  const progress = status.progress || 0;
  const result = status.result;

  return (
    <Card>
      <BlockStack gap="4">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h2">
            Import Progress
          </Text>
          <Badge
            tone={
              status.state === "completed"
                ? "success"
                : status.state === "failed"
                ? "critical"
                : "info"
            }
          >
            {status.state?.toUpperCase()}
          </Badge>
        </InlineStack>

        <Divider />

        {/* Progress Bar */}
        <BlockStack gap="2">
          <ProgressBar progress={progress} size="medium" />
          <Text variant="bodySm" tone="subdued" alignment="center">
            {progress}% complete
          </Text>
        </BlockStack>

        {/* Stats */}
        {result && (
          <>
            <Divider />
            <InlineStack gap="4" align="center" blockAlign="center">
              <Box padding="3" background="bg-surface-success" borderRadius="2">
                <BlockStack align="center">
                  <Text variant="headingLg" fontWeight="bold">
                    {result.imported || result.successful_products || 0}
                  </Text>
                  <Text variant="bodySm">Imported</Text>
                </BlockStack>
              </Box>

              <Box padding="3" background="bg-surface-critical" borderRadius="2">
                <BlockStack align="center">
                  <Text variant="headingLg" fontWeight="bold">
                    {result.failed || result.failed_products || 0}
                  </Text>
                  <Text variant="bodySm">Failed</Text>
                </BlockStack>
              </Box>

              <Box padding="3" background="bg-surface-secondary" borderRadius="2">
                <BlockStack align="center">
                  <Text variant="headingLg" fontWeight="bold">
                    {result.total || 0}
                  </Text>
                  <Text variant="bodySm">Total</Text>
                </BlockStack>
              </Box>
            </InlineStack>
          </>
        )}

        {/* Errors */}
        {result?.errors?.length > 0 && (
          <>
            <Divider />
            <BlockStack gap="2">
              <Text variant="headingSm" as="h4" tone="critical">
                Errors ({result.errors.length})
              </Text>
              <List type="bullet">
                {result.errors.slice(0, 5).map((err, index) => (
                  <List.Item key={index}>
                    <Text tone="critical">
                      {err.title || err.url}: {err.error}
                    </Text>
                  </List.Item>
                ))}
                {result.errors.length > 5 && (
                  <List.Item>
                    <Text tone="subdued">
                      ...and {result.errors.length - 5} more errors
                    </Text>
                  </List.Item>
                )}
              </List>
            </BlockStack>
          </>
        )}

        {/* Failed Reason */}
        {status.failedReason && (
          <>
            <Divider />
            <Box padding="3" background="bg-surface-critical" borderRadius="2">
              <Text tone="critical">{status.failedReason}</Text>
            </Box>
          </>
        )}
      </BlockStack>
    </Card>
  );
}