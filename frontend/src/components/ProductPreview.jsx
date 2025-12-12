import React from "react";
import {
  Card,
  Thumbnail,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { formatPrice, detectPlatform, getPlatformColor } from "../utils/helpers";

export default function ProductPreview({ product, platform }) {
  if (!product) return null;

  const primaryImage = product.images?.[0]?.src;
  const price = product.variants?.[0]?.price || 0;
  const comparePrice = product.variants?.[0]?.compare_at_price;

  return (
    <Card>
      <BlockStack gap="4">
        <Text variant="headingMd" as="h2">
          Product Preview
        </Text>
        
        <Divider />
        
        <InlineStack gap="4" wrap={false}>
          {/* Image */}
          <Box minWidth="120px">
            {primaryImage ? (
              <Thumbnail
                source={primaryImage}
                alt={product.title}
                size="large"
              />
            ) : (
              <Box
                background="bg-surface-secondary"
                padding="8"
                borderRadius="2"
              >
                <Text tone="subdued">No image</Text>
              </Box>
            )}
          </Box>

          {/* Info */}
          <BlockStack gap="2">
            <InlineStack gap="2">
              <Badge tone={getPlatformColor(platform || detectPlatform(product.source_url || ""))}>
                {platform || detectPlatform(product.source_url || "")}
              </Badge>
              {product.vendor && (
                <Badge tone="info">{product.vendor}</Badge>
              )}
            </InlineStack>

            <Text variant="headingMd" as="h3">
              {product.title}
            </Text>

            <InlineStack gap="2" align="start">
              <Text variant="headingLg" as="p" fontWeight="bold">
                {formatPrice(price)}
              </Text>
              {comparePrice && parseFloat(comparePrice) > parseFloat(price) && (
                <Text
                  variant="bodyMd"
                  as="p"
                  tone="subdued"
                  textDecorationLine="line-through"
                >
                  {formatPrice(comparePrice)}
                </Text>
              )}
            </InlineStack>

            <Text variant="bodySm" tone="subdued">
              {product.variants?.length || 0} variant(s) • {product.images?.length || 0} image(s)
            </Text>
          </BlockStack>
        </InlineStack>

        {/* Additional Images */}
        {product.images?.length > 1 && (
          <>
            <Divider />
            <BlockStack gap="2">
              <Text variant="headingSm" as="h4">
                All Images ({product.images.length})
              </Text>
              <InlineStack gap="2" wrap>
                {product.images.slice(0, 6).map((img, index) => (
                  <Thumbnail
                    key={index}
                    source={img.src}
                    alt={img.alt || `Image ${index + 1}`}
                    size="small"
                  />
                ))}
                {product.images.length > 6 && (
                  <Box
                    background="bg-surface-secondary"
                    padding="3"
                    borderRadius="2"
                  >
                    <Text tone="subdued">+{product.images.length - 6}</Text>
                  </Box>
                )}
              </InlineStack>
            </BlockStack>
          </>
        )}

        {/* Variants */}
        {product.variants?.length > 1 && (
          <>
            <Divider />
            <BlockStack gap="2">
              <Text variant="headingSm" as="h4">
                Variants ({product.variants.length})
              </Text>
              <InlineStack gap="2" wrap>
                {product.variants.slice(0, 5).map((variant, index) => (
                  <Badge key={index} tone="info">
                    {variant.title} - {formatPrice(variant.price)}
                  </Badge>
                ))}
                {product.variants.length > 5 && (
                  <Badge>+{product.variants.length - 5} more</Badge>
                )}
              </InlineStack>
            </BlockStack>
          </>
        )}

        {/* Tags */}
        {product.tags?.length > 0 && (
          <>
            <Divider />
            <BlockStack gap="2">
              <Text variant="headingSm" as="h4">
                Tags
              </Text>
              <InlineStack gap="1" wrap>
                {product.tags.slice(0, 10).map((tag, index) => (
                  <Badge key={index}>{tag}</Badge>
                ))}
              </InlineStack>
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}
