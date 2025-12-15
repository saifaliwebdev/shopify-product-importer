import shopify from "../shopify.js";
import ImageHandler from "./imageHandler.js";
import Import from "../models/Import.js";

class ProductImporter {
  constructor() {
    this.imageHandler = new ImageHandler();
    this.locationId = null;
  }

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

  async importProduct(session, productData, options = {}) {
    const {
      status = "draft",
      priceMarkup = 0,
      priceMarkupType = "percentage",
      downloadImages = true,
      collectionId = null,
      titlePrefix = "",
      titleSuffix = "",
      replaceVendor = "",
    } = options;

    try {
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

      let images = productData.images || [];
      if (downloadImages && images.length > 0) {
        images = await this.imageHandler.processImages(images);
      }

      const variants = this.applyPriceMarkup(
        productData.variants,
        priceMarkup,
        priceMarkupType
      );

      console.log("📦 Variants count:", variants.length);

      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";

      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

      const finalVendor = replaceVendor || productData.vendor || "";

      // Step 1: Create product with options
      const productInput = {
        title: finalTitle,
        descriptionHtml: productData.description,
        vendor: finalVendor,
        productType: productData.product_type || "",
        tags: productData.tags || [],
        status: productStatus,
      };

      // Add product options if they exist
      if (productData.options && productData.options.length > 0) {
        productInput.productOptions = productData.options.map(opt => ({
          name: opt.name,
          values: opt.values.map(v => ({ name: v }))
        }));
        console.log("📦 Product options:", JSON.stringify(productInput.productOptions, null, 2));
      }

      console.log("📦 Creating product:", finalTitle);

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
                  options {
                    id
                    name
                    values
                  }
                  variants(first: 1) {
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

      const result = createResponse.body?.data?.productCreate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Product creation errors:", result.userErrors);
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      if (!result?.product) {
        throw new Error("Product creation failed - no product returned");
      }

      const createdProduct = result.product;
      const productId = createdProduct.id;
      const createdOptions = createdProduct.options || [];

      console.log("✅ Product created:", productId);
      console.log("📦 Created options:", createdOptions.map(o => o.name).join(", "));

      // Step 2: Handle variants
      try {
        if (variants.length <= 1 && (!productData.options || productData.options.length === 0)) {
          // Single variant - just update price
          console.log("📝 Single variant product - updating default variant");
          const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;
          
          if (defaultVariantId && variants[0]) {
            await this.updateVariantPrice(client, productId, defaultVariantId, variants[0].price, variants[0].compare_at_price);
          }
        } else {
          // Multiple variants - create them
          console.log("📦 Creating", variants.length, "variants...");
          await this.createAllVariants(client, productId, variants, createdOptions);
        }
      } catch (variantError) {
        console.error("❌ Variant processing failed:", variantError.message);
      }

      // Step 3: Add images
      if (images.length > 0) {
        console.log("📸 Adding", images.length, "images");
        await this.addProductImages(client, productId, images);
      }

      // Step 4: Add to collection
      if (collectionId) {
        await this.addToCollection(client, productId, collectionId);
      }

      // Save import record
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
      console.error("❌ Import failed:", error.message);
      
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

  applyPriceMarkup(variants, markup, type) {
    return variants.map(variant => {
      let price = parseFloat(variant.price) || 0;
      let comparePrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;

      if (markup && markup !== 0) {
        if (type === "percentage") {
          price = price * (1 + markup / 100);
          if (comparePrice) comparePrice = comparePrice * (1 + markup / 100);
        } else {
          price = price + parseFloat(markup);
          if (comparePrice) comparePrice = comparePrice + parseFloat(markup);
        }
      }

      return {
        ...variant,
        price: price.toFixed(2),
        compare_at_price: comparePrice ? comparePrice.toFixed(2) : null,
      };
    });
  }

  async createAllVariants(client, productId, variants, createdOptions) {
    console.log("📦 Creating variants with optionValues format...");
    
    // Get option names
    const optionNames = createdOptions.map(o => o.name);
    console.log("📦 Option names:", optionNames);

    // Prepare variant inputs - ONLY valid fields
    const variantInputs = [];
    const seenCombinations = new Set();
    
    for (const variant of variants) {
      const optionValues = [];
      
      // Build optionValues from option1, option2, option3
      if (variant.option1 && optionNames[0]) {
        optionValues.push({
          optionName: optionNames[0],
          name: String(variant.option1)
        });
      }
      
      if (variant.option2 && optionNames[1]) {
        optionValues.push({
          optionName: optionNames[1],
          name: String(variant.option2)
        });
      }
      
      if (variant.option3 && optionNames[2]) {
        optionValues.push({
          optionName: optionNames[2],
          name: String(variant.option3)
        });
      }

      // Skip if no option values
      if (optionValues.length === 0) continue;

      // Create a unique key for this combination to avoid duplicates
      const combinationKey = optionValues.map(opt => `${opt.optionName}:${opt.name}`).join('|');
      
      if (seenCombinations.has(combinationKey)) {
        console.log(`⚠️ Skipping duplicate variant: ${combinationKey}`);
        continue;
      }
      seenCombinations.add(combinationKey);

      // ONLY these fields are allowed in ProductVariantsBulkInput
      const variantInput = {
        optionValues: optionValues,
        price: String(variant.price),
      };

      // Add compare at price if exists
      if (variant.compare_at_price) {
        variantInput.compareAtPrice = String(variant.compare_at_price);
      }

      variantInputs.push(variantInput);
    }

    if (variantInputs.length === 0) {
      console.log("⚠️ No valid variants to create");
      return;
    }

    console.log("📦 Creating", variantInputs.length, "variants");
    console.log("📦 First variant:", JSON.stringify(variantInputs[0], null, 2));

    try {
      const response = await client.query({
        data: {
          query: `
            mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkCreate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  title
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
                userErrors {
                  field
                  message
                  code
                }
              }
            }
          `,
          variables: {
            productId: productId,
            variants: variantInputs,
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkCreate;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Variant creation errors:", JSON.stringify(result.userErrors, null, 2));
        
        // Log details about each error
        result.userErrors.forEach(error => {
          if (error.code === 'VARIANT_ALREADY_EXISTS_CHANGE_OPTION_VALUE') {
            console.error(`❌ Duplicate variant detected: ${error.message}`);
          }
        });
        
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      const createdVariants = result?.productVariants || [];
      console.log(`✅ Created ${createdVariants.length} variants successfully!`);

      // Show first 3 variants
      createdVariants.slice(0, 3).forEach((v, i) => {
        console.log(`   ✅ ${i + 1}. ${v.title} - $${v.price}`);
      });

      if (createdVariants.length > 3) {
        console.log(`   ... and ${createdVariants.length - 3} more variants`);
      }

      // Delete default variant
      await this.deleteDefaultVariant(client, productId);

    } catch (error) {
      console.error("❌ Bulk create failed:", error.message);
      throw error;
    }
  }

  async updateVariantPrice(client, productId, variantId, price, compareAtPrice) {
    console.log("🔄 Updating variant price to:", price);

    try {
      // Use productVariantsBulkUpdate instead of productVariantUpdate
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
              price: String(price),
              compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
            }],
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Variant update errors:", result.userErrors);
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      console.log("✅ Variant price updated to:", result?.productVariants?.[0]?.price);

    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      throw error;
    }
  }

  async deleteDefaultVariant(client, productId) {
    try {
      const response = await client.query({
        data: {
          query: `
            query getVariants($id: ID!) {
              product(id: $id) {
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
              }
            }
          `,
          variables: { id: productId },
        },
      });

      const variants = response.body?.data?.product?.variants?.edges || [];
      const defaultVariant = variants.find(v => v.node.title === "Default Title");

      if (defaultVariant && variants.length > 1) {
        console.log("🗑️ Deleting default variant...");
        
        await client.query({
          data: {
            query: `
              mutation deleteVariant($id: ID!) {
                productVariantDelete(id: $id) {
                  deletedProductVariantId
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            variables: { id: defaultVariant.node.id },
          },
        });
        
        console.log("✅ Default variant deleted");
      }
    } catch (error) {
      console.log("⚠️ Could not delete default variant:", error.message);
    }
  }

  async addProductImages(client, productId, images) {
    try {
      const media = images.map(img => ({
        originalSource: img.src,
        alt: img.alt || "",
        mediaContentType: "IMAGE",
      }));

      const response = await client.query({
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

      const result = response.body?.data?.productCreateMedia;
      
      if (result?.mediaUserErrors?.length > 0) {
        console.error("❌ Image errors:", result.mediaUserErrors);
      } else {
        console.log("✅ Images added successfully");
      }
    } catch (error) {
      console.error("❌ Failed to add images:", error.message);
    }
  }

  async addToCollection(client, productId, collectionId) {
    console.log("📁 Adding to collection:", collectionId);
    
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

      const result = response.body?.data?.collectionAddProducts;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Collection error:", result.userErrors);
      } else {
        console.log("✅ Added to collection:", result?.collection?.title);
      }
    } catch (error) {
      console.error("❌ Failed to add to collection:", error.message);
    }
  }

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

      await this.delay(500);
    }

    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ProductImporter();
