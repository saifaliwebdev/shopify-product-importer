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

      console.log("📦 Variants count:", variants.length, "- First price:", variants[0]?.price);

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
          // Multiple variants - create them one by one
          console.log("📦 Multiple variants product - creating variants one by one");
          await this.createProductVariantsOneByOne(client, productId, variants, productData.options || []);
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
   * Create product variants one by one to avoid rate limiting
   */
  async createProductVariantsOneByOne(client, productId, variants, options) {
    console.log("📦 Creating", variants.length, "variants one by one");

    try {
      // Step 1: Add product options first (required before creating variants)
      if (options && options.length > 0) {
        console.log("🔧 Adding product options first...");
        
        const optionsToCreate = options.map(opt => ({
          name: opt.name || "Option",
          values: opt.values?.map(v => ({ name: v })) || []
        }));

        const optionsResponse = await client.query({
          data: {
            query: `
              mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
                productOptionsCreate(productId: $productId, options: $options) {
                  product {
                    id
                    options {
                      id
                      name
                      values
                    }
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
              options: optionsToCreate,
            },
          },
        });

        const optResult = optionsResponse.body?.data?.productOptionsCreate;
        if (optResult?.userErrors?.length > 0) {
          console.log("⚠️ Options create errors:", optResult.userErrors[0]?.message);
        } else {
          console.log("✅ Product options added");
        }
      }

      // Step 2: Create variants one by one with delays
      console.log("🔄 Creating variants one by one...");
      
      let createdCount = 0;
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        
        try {
          const variantInput = {
            price: variant.price,
            compareAtPrice: variant.compare_at_price || null,
            sku: variant.sku || "",
            optionValues: [],
          };

          // Map option values
          if (variant.option1) {
            variantInput.optionValues.push({
              name: variant.option1,
              optionName: options?.[0]?.name || "Size"
            });
          }
          if (variant.option2) {
            variantInput.optionValues.push({
              name: variant.option2,
              optionName: options?.[1]?.name || "Color"
            });
          }
          if (variant.option3) {
            variantInput.optionValues.push({
              name: variant.option3,
              optionName: options?.[2]?.name || "Material"
            });
          }

          console.log(`📝 Creating variant ${i + 1}/${variants.length}:`, variant.option1 || "Default");

          const response = await client.query({
            data: {
              query: `
                mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                  productVariantsBulkCreate(productId: $productId, variants: $variants) {
                    productVariants {
                      id
                      title
                      price
                      optionValues {
                        name
                        value {
                          name
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
              variables: {
                productId: productId,
                variants: [variantInput],
              },
            },
          });

          const result = response.body?.data?.productVariantsBulkCreate;

          if (result?.userErrors?.length > 0) {
            console.log(`⚠️ Variant ${i + 1} error:`, result.userErrors[0]?.message);
          } else {
            createdCount++;
            console.log(`✅ Created variant ${i + 1}: ${result?.productVariants?.[0]?.title}`);
          }

          // Rate limiting - wait between requests to avoid "router only supports one blocker"
          if (i < variants.length - 1) {
            console.log("⏱️ Waiting 2 seconds to avoid rate limiting...");
            await this.delay(2000);
          }
        } catch (variantError) {
          console.log(`⚠️ Variant ${i + 1} failed:`, variantError.message);
        }
      }

      console.log(`✅ Created ${createdCount} out of ${variants.length} variants`);
    } catch (error) {
      console.log("⚠️ Variant creation error:", error.message);
      // Update first variant price as fallback
      await this.updateFirstVariantPrice(client, productId, variants[0]);
    }
  }

  /**
   * Update first variant's price
   */
  async updateFirstVariantPrice(client, productId, variantData) {
    try {
      console.log("🔄 Updating first variant price as fallback...");
      
      const productResponse = await client.query({
        data: {
          query: `query { product(id: "${productId}") { variants(first: 1) { edges { node { id } } } }`,
        },
      });
      
      const variantId = productResponse.body?.data?.product?.variants?.edges?.[0]?.node?.id;
      if (variantId && variantData) {
        await this.updateDefaultVariant(client, variantId, variantData);
      }
    } catch (err) {
      console.log("⚠️ Fallback price update failed:", err.message);
    }
  }

  /**
   * Update default variant price using REST API (more reliable)
   */
  async updateDefaultVariant(client, variantId, variantData) {
    console.log("🔄 Updating variant:", variantId, "with price:", variantData.price);

    try {
      const response = await client.query({
        data: {
          query: `
            mutation productVariantUpdate($input: ProductVariantInput!) {
              productVariantUpdate(input: $input) {
                productVariant {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              id: variantId,
              price: variantData.price,
              compareAtPrice: variantData.compare_at_price || null,
            },
          },
        },
      });

      const result = response.body?.data?.productVariantUpdate || response.data?.productVariantUpdate;

      if (result?.userErrors?.length > 0) {
        console.error("🔄 Variant update errors:", result.userErrors);
        console.log("🔄 Trying alternative update method...");
        await this.updateVariantViaProductUpdate(client, variantId, variantData);
      } else {
        console.log("✅ Variant updated, new price:", result?.productVariant?.price);
      }
    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      await this.updateVariantViaProductUpdate(client, variantId, variantData);
    }
  }

  /**
   * Alternative: Update variant via product update
   */
  async updateVariantViaProductUpdate(client, variantId, variantData) {
    console.log("🔄 Alternative: Updating via product variants bulk update...");
    
    try {
      const variantResponse = await client.query({
        data: {
          query: `
            query getVariantProduct($id: ID!) {
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
      
      if (!productId) {
        console.error("❌ Could not get product ID");
        return;
      }

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
              compareAtPrice: variantData.compare_at_price || null,
            }],
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkUpdate || response.data?.productVariants
