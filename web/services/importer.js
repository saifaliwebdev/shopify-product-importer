import shopify from "../shopify.js";
import ImageHandler from "./imageHandler.js";
import Import from "../models/Import.js";
import { convertPriceForImport } from "../utils/currency.js";

class ProductImporter {
  constructor() {
    this.imageHandler = new ImageHandler();
    this.locationId = null; // Will be fetched dynamically
  }

  /**
   * Get the primary location ID for the store
   */
  async getLocationId(client) {
    if (this.locationId) return this.locationId;
    
    try {
      const response = await client.query({
        data: `{
          locations(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }`,
      });
      
      this.locationId = response.body?.data?.locations?.edges?.[0]?.node?.id;
      console.log("📍 Location ID:", this.locationId);
      return this.locationId;
    } catch (error) {
      console.error("❌ Failed to get location ID:", error.message);
      return null;
    }
  }

  /**
   * Import single product to Shopify store
   */
  async importProduct(session, productData, options = {}) {
    const {
      status = "draft",
      priceMarkup = 0,
      priceMarkupType = "percentage", // percentage or fixed
      publishToSalesChannels = false,
      downloadImages = true,
      collectionId = null,
      inventoryQuantity = 100,
      titlePrefix = "",
      titleSuffix = "",
      replaceVendor = "",
    } = options;

    try {
      // 1. Get store currency and location
      const client = new shopify.api.clients.Graphql({ session });
      
      const storeResponse = await client.query({
        data: `{
          shop {
            currencyCode
          }
        }`,
      });
      const storeCurrency = storeResponse.body?.data?.shop?.currencyCode || 'USD';
      console.log("🏪 Store currency:", storeCurrency);
      
      // Get location ID for inventory
      const locationId = await this.getLocationId(client);

      // 2. Process images
      let images = productData.images || [];
      if (downloadImages && images.length > 0) {
        images = await this.imageHandler.processImages(images);
      }

      // 3. Apply price markup and currency conversion
      const variants = this.applyPriceMarkup(
        productData.variants,
        priceMarkup,
        priceMarkupType,
        storeCurrency,
        productData
      );

      console.log("📦 Original variants:", productData.variants);
      console.log("📦 Processed variants:", variants);

      // Check condition immediately
      console.log("🔍 Checking variant update condition:");
      console.log("   - variants.length:", variants.length);
      console.log("   - variants[0]?.price:", variants[0]?.price);
      console.log("   - variants[0]?.price !== '0.00':", variants[0]?.price !== "0.00");
      console.log("   - Condition result:", variants.length > 0 && variants[0]?.price && variants[0]?.price !== "0.00");

      // 4. Create product in Shopify
      const shopifyClient = new shopify.api.clients.Graphql({ session });

      console.log("📦 Creating product in Shopify:", productData.title);

      // Set status based on options
      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";
      console.log("📦 Product status will be:", productStatus);

      // Apply title prefix/suffix
      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

      // Apply vendor replacement
      const finalVendor = replaceVendor || productData.vendor || "";

      const productInput = {
        title: finalTitle,
        descriptionHtml: productData.description,
        vendor: finalVendor,
        productType: productData.product_type || "",
        tags: productData.tags || [],
        status: productStatus,
      };

      console.log("📦 Product input:", JSON.stringify(productInput, null, 2));

      // Create product
      const createResponse = await client.query({
        data: {
          query: `
            mutation productCreate($input: ProductInput!) {
              productCreate(input: $input) {
                product {
                  id
                  title
                  handle
                  status
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: { input: productInput },
        },
      });

      try {
        console.log("📦 Product creation response received");
        // Log key parts separately to avoid JSON stringify issues
        console.log("📦 Response body exists:", !!createResponse.body);
        console.log("📦 Response data exists:", !!createResponse.body?.data);
        console.log("📦 ProductCreate exists:", !!createResponse.body?.data?.productCreate);
      } catch (logError) {
        console.log("📦 Could not log response details:", logError.message);
      }

      const result = createResponse.body?.data?.productCreate || createResponse.data?.productCreate;

      if (result.userErrors?.length > 0) {
        console.error("📦 Product creation user errors:", result.userErrors);
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      if (!result.product) {
        console.error("📦 No product returned from creation");
        throw new Error("Product creation failed - no product returned");
      }

      const createdProduct = result.product;
      const productId = createdProduct.id;

      console.log("✅ Product created successfully:", productId);

      // 4. Handle variants
      try {
        console.log("🔍 Handling variants for product...");
        console.log("   - Total variants:", variants.length);
        console.log("   - Product has options:", productData.options?.length > 0);

        if (variants.length === 0) {
          console.log("⏭️ No variants to process");
        } else if (variants.length === 1 && !productData.options?.length) {
          // Single variant product - update default variant
          console.log("📝 Single variant product - updating default variant");
          const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;

          if (defaultVariantId) {
            console.log("📝 Updating default variant price to:", variants[0].price);
            await this.updateDefaultVariant(client, defaultVariantId, variants[0]);
          } else {
            console.error("❌ No default variant found for single variant product");
          }
        } else if (variants.length > 1 || productData.options?.length > 0) {
          // Multiple variants - create them using bulk create
          console.log("📦 Multiple variants product - creating variants");
          await this.createProductVariants(client, productId, variants, productData.options || []);
        } else {
          console.log("⏭️ Unhandled variant scenario");
        }
      } catch (variantError) {
        console.error("❌ Variant processing failed:", variantError.message);
        // Don't throw here - product was created successfully
      }

      // 5. Add images
      if (images.length > 0) {
        console.log("📸 Adding", images.length, "images to product");
        await this.addProductImages(client, productId, images);
      }

      // 6. Add to collection if specified
      if (collectionId) {
        await this.addToCollection(client, productId, collectionId);
      }

      // 7. Save import record
      await Import.create({
        shop: session.shop,
        source_url: productData.source_url,
        source_platform: productData.source_platform || "unknown",
        product_id: productId,
        product_title: productData.title,
        status: "success",
        options: options,
      });

      return {
        success: true,
        product: createdProduct,
      };

    } catch (error) {
      // Save failed import
      await Import.create({
        shop: session.shop,
        source_url: productData.source_url,
        source_platform: productData.source_platform || "unknown",
        status: "failed",
        error: error.message,
        options: options,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Apply price markup to variants
   * Note: Currency conversion disabled - prices are passed as-is from source
   */
  applyPriceMarkup(variants, markup, type, storeCurrency, productData) {
    return variants.map(variant => {
      // Use original price directly (no currency conversion)
      // This prevents incorrect conversion issues
      let price = parseFloat(variant.price) || 0;
      let comparePrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;

      console.log("💰 Original price:", variant.price, "-> Parsed:", price);

      // Apply markup if specified
      if (markup && markup !== 0) {
        if (type === "percentage") {
          price = price * (1 + markup / 100);
          if (comparePrice) {
            comparePrice = comparePrice * (1 + markup / 100);
          }
        } else {
          // Fixed amount
          price = price + parseFloat(markup);
          if (comparePrice) {
            comparePrice = comparePrice + parseFloat(markup);
          }
        }
        console.log("💰 After markup:", price);
      }

      return {
        ...variant,
        price: price.toFixed(2),
        compare_at_price: comparePrice ? comparePrice.toFixed(2) : null,
      };
    });
  }

  /**
   * Create product variants using bulk create
   */
  async createProductVariants(client, productId, variants, options) {
    console.log("📦 Creating", variants.length, "variants for product:", productId);
    console.log("📦 Product options:", JSON.stringify(options, null, 2));

    // Get dynamic location ID
    const locationId = await this.getLocationId(client);
    console.log("📍 Using location ID for variants:", locationId);

    // Use productVariantsBulkCreate for newer Shopify API
    console.log("🔄 Using bulk variant creation...");

    try {
      // Build variants array for bulk create
      const bulkVariants = variants.map(variant => {
        const variantInput = {
          price: variant.price,
          compareAtPrice: variant.compare_at_price,
          sku: variant.sku || "",
          optionValues: [],
        };

        // Add option values
        if (variant.option1 && options[0]) {
          variantInput.optionValues.push({
            name: variant.option1,
            optionName: options[0].name || "Option 1"
          });
        }
        if (variant.option2 && options[1]) {
          variantInput.optionValues.push({
            name: variant.option2,
            optionName: options[1].name || "Option 2"
          });
        }
        if (variant.option3 && options[2]) {
          variantInput.optionValues.push({
            name: variant.option3,
            optionName: options[2].name || "Option 3"
          });
        }

        // If no options defined, add simple option values
        if (variantInput.optionValues.length === 0 && variant.option1) {
          variantInput.optionValues.push({
            name: variant.option1,
            optionName: "Title"
          });
        }

        console.log("📝 Variant input:", variant.option1, "Price:", variant.price);
        return variantInput;
      });

      const response = await client.query({
        data: {
          query: `
            mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkCreate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  title
                  price
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            productId: productId,
            variants: bulkVariants,
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkCreate || response.data?.productVariantsBulkCreate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Bulk variant create errors:", result.userErrors);
      } else {
        const createdCount = result?.productVariants?.length || 0;
        console.log("✅ Created", createdCount, "variants via bulk create");
      }
    } catch (bulkError) {
      console.error("❌ Bulk variant creation failed:", bulkError.message);
      console.log("🔄 Falling back to REST API for variants...");
      
      // Fallback: Try updating default variant at least
      try {
        // Get the product with its default variant
        const productResponse = await client.query({
          data: {
            query: `
              query getProduct($id: ID!) {
                product(id: $id) {
                  variants(first: 1) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
              }
            `,
            variables: { id: productId },
          },
        });
        
        const defaultVariantId = productResponse.body?.data?.product?.variants?.edges?.[0]?.node?.id;
        if (defaultVariantId && variants[0]) {
          await this.updateDefaultVariant(client, defaultVariantId, variants[0]);
        }
      } catch (fallbackError) {
        console.error("❌ Fallback also failed:", fallbackError.message);
      }
    }
  }

  /**
   * Create variants for product (legacy method)
   */
  async createVariants(client, productId, variants, options) {
    // First, set up options
    if (options && options.length > 0) {
      await client.query({
        data: {
          query: `
            mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
              productOptionsCreate(productId: $productId, options: $options) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            productId,
            options: options.map(opt => ({
              name: opt.name,
              values: opt.values.map(v => ({ name: v })),
            })),
          },
        },
      });
    }

    // Create variants
    for (const variant of variants) {
      await client.query({
        data: {
          query: `
            mutation productVariantCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkCreate(productId: $productId, variants: $variants) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            productId,
            variants: [{
              price: variant.price,
              compareAtPrice: variant.compare_at_price,
              sku: variant.sku,
              weight: variant.weight,
              weightUnit: variant.weight_unit?.toUpperCase() || "KILOGRAMS",
              optionValues: [
                variant.option1 && { name: variant.option1, optionName: options?.[0]?.name },
                variant.option2 && { name: variant.option2, optionName: options?.[1]?.name },
                variant.option3 && { name: variant.option3, optionName: options?.[2]?.name },
              ].filter(Boolean),
            }],
          },
        },
      });
    }
  }

  /**
   * Update default variant price using bulk update
   */
  async updateDefaultVariant(client, variantId, variantData) {
    console.log("🔄 Updating variant:", variantId, "with price:", variantData.price);

    // Extract product ID from variant ID
    // variantId format: gid://shopify/ProductVariant/12345
    // We need product ID which we can get from the variant
    
    try {
      // First get the product ID from the variant
      const variantResponse = await client.query({
        data: {
          query: `
            query getVariant($id: ID!) {
              productVariant(id: $id) {
                product {
                  id
                }
              }
            }
          `,
          variables: { id: variantId },
        },
      });
      
      const productId = variantResponse.body?.data?.productVariant?.product?.id;
      console.log("🔄 Product ID for variant:", productId);
      
      if (!productId) {
        throw new Error("Could not find product ID for variant");
      }

      // Use productVariantsBulkUpdate
      const response = await client.query({
        data: {
          query: `
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            productId: productId,
            variants: [{
              id: variantId,
              price: variantData.price,
              compareAtPrice: variantData.compare_at_price,
              sku: variantData.sku || "",
            }],
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkUpdate || response.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        console.error("🔄 Variant update user errors:", result.userErrors);
        throw new Error("Variant update failed: " + result.userErrors.map(e => e.message).join(", "));
      }

      console.log("✅ Variant updated successfully, price:", result?.productVariants?.[0]?.price);
    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      throw error;
    }
  }

  /**
   * Add images to product
   */
  async addProductImages(client, productId, images) {
    const media = images.map((img, index) => ({
      originalSource: img.src,
      alt: img.alt || "",
      mediaContentType: "IMAGE",
    }));

    await client.query({
      data: {
        query: `
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                ... on MediaImage {
                  id
                }
              }
              mediaUserErrors {
                field
                message
              }
            }
          }
        `,
        variables: { productId, media },
      },
    });
  }

  /**
   * Add product to collection
   */
  async addToCollection(client, productId, collectionId) {
    console.log("📁 Adding product to collection:", collectionId);
    
    try {
      const response = await client.query({
        data: {
          query: `
            mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
              collectionAddProducts(id: $id, productIds: $productIds) {
                collection {
                  id
                  title
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            id: collectionId,
            productIds: [productId],
          },
        },
      });

      const result = response.body?.data?.collectionAddProducts || response.data?.collectionAddProducts;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Collection add error:", result.userErrors);
      } else {
        console.log("✅ Product added to collection:", result?.collection?.title || collectionId);
      }
    } catch (error) {
      console.error("❌ Failed to add to collection:", error.message);
      // Don't throw - collection add is optional
    }
  }

  /**
   * Bulk import products
   */
  async bulkImport(session, products, options = {}) {
    const results = {
      total: products.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const product of products) {
      const result = await this.importProduct(session, product, options);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          title: product.title,
          url: product.source_url,
          error: result.error,
        });
      }

      // Rate limiting - Shopify has API limits
      await this.delay(500);
    }

    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ProductImporter();
