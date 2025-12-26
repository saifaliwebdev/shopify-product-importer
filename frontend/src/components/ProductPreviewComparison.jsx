import React from 'react';
import {
  Card,
  RadioButton,
  InlineStack,
  Badge,
  Text,
  Box,
  Divider
} from '@shopify/polaris';

export default function ProductPreviewComparison({
  original,
  aiOptimized,
  selections,
  onSelectionChange
}) {
  const aiAvailable = aiOptimized && !aiOptimized.aiError;

  const SelectionCard = ({ title, content, selected, onSelect, ai = false }) => (
    <Box
      background="bg-surface"
      padding="4"
      borderRadius="2"
      borderWidth="1"
      borderColor={selected ? "border-success" : "border-subdued"}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <RadioButton
          label={title}
          checked={selected}
          onChange={onSelect}
        />
        {ai && <Badge status="success">✨ AI Optimized</Badge>}
        <Text as="p" variant="bodyMd" color="subdued">
          {content || "No content available"}
        </Text>
      </div>
    </Box>
  );

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Title Section */}
        <Text variant="headingMd">Title</Text>
        <InlineStack gap="4" blockAlign="stretch">
          <SelectionCard
            title="Original Title"
            content={original?.title}
            selected={selections.title === 'original'}
            onSelect={() => handleSelectionChange('title', 'original')}
          />
          <SelectionCard
            title="AI Optimized Title"
            content={aiOptimized?.optimized_title}
            selected={selections.title === 'ai'}
            onSelect={() => handleSelectionChange('title', 'ai')}
            ai
            disabled={!aiAvailable}
          />
        </InlineStack>

        <Divider />

        {/* Description Section */}
        <Text variant="headingMd">Description</Text>
        <InlineStack gap="4" blockAlign="stretch">
          <SelectionCard
            title="Original Description"
            content={original?.description?.slice(0, 200) + '...'}
            selected={selections.description === 'original'}
            onSelect={() => handleSelectionChange('description', 'original')}
          />
          <SelectionCard
            title="AI Optimized Description"
            content={aiOptimized?.optimized_description?.slice(0, 200) + '...'}
            selected={selections.description === 'ai'}
            onSelect={() => handleSelectionChange('description', 'ai')}
            ai
            disabled={!aiAvailable}
          />
        </InlineStack>

        <Divider />

        {/* Tags Section */}
        <Text variant="headingMd">Tags</Text>
        <InlineStack gap="4" blockAlign="stretch">
          <SelectionCard
            title="Original Tags"
            content={original?.tags?.join(', ')}
            selected={selections.tags === 'original'}
            onSelect={() => handleSelectionChange('tags', 'original')}
          />
          <SelectionCard
            title="AI Generated Tags"
            content={aiOptimized?.optimized_tags?.join(', ')}
            selected={selections.tags === 'ai'}
            onSelect={() => handleSelectionChange('tags', 'ai')}
            ai
            disabled={!aiAvailable}
          />
        </InlineStack>
      </div>
    </Card>
  );

  function handleSelectionChange(field, value) {
    onSelectionChange({
      ...selections,
      [field]: value
    });
  }
}
