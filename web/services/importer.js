import shopify from "../shopify.js";
import ImageHandler from "./imageHandler.js";
import Import from "../models/Import.js";
import { convertPriceForImport } from "../utils/currency.js";

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
      publishToSalesChannels = false,
      downloadImages = true,
      collectionId = null,
      inventoryQuantity = 100,
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
      
      const locationId = await this.getLocationId(client);

      let images = productData.images || [];
      if (downloadImages && images.length > 0) {
        images = await this.imageHandler.processImages(images);
      }

      const variants = this.applyPriceMarkup(
        productData.variants,
        priceMarkup,
        priceMarkupType,
        storeCurrency,
        productData
      );

      console.log("📦 Variants count:", variants.length, "- First price:", variants[0]?.price);

      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";
      console.log("📦 Product status will be:", productStatus);

      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

      const finalVendor = replaceVendor || productData.vendor || "";

      // Build product options for creation
      const productOptions = this.buildProductOptions(productData.options || []);
      console.log("📦 Product options:", JSON.stringify(productOptions, null, 2));

      const productInput = {
        title: finalTitle,
        descriptionHtml: productData.description,
        vendor: finalVendor,
        productType: productData.product_type || "",
        tags: productData.tags || [],
        status: productStatus,
      };

      // Add options to product if they exist
      if (productOptions.length > 0) {
        productInput.productOptions = productOptions;
      }

      console.log("📦 Product input:", JSON.stringify(productInput, null, 2));

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
      console.log("📦 Product options created:", createdProduct.options);

      try {
        console.log("🔍 Handling variants for product...");
        console.log("   - Total variants:", variants.length);
        console.log("   - Product has options:", productData.options?.length > 0);

        if (variants.length === 0) {
          console.log("⏭️ No variants to process");
        } else if (variants.length === 1 && !productData.options?.length) {
          console.log("📝 Single variant product - updating default variant");
          const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;

          if (defaultVariantId) {
            console.log("📝 Updating default variant price to:", variants[0].price);
            await this.updateDefaultVariant(client, defaultVariantId, variants[0]);
          } else {
            console.error("❌ No default variant found for single variant product");
          }
        } else if (variants.length > 1 || productData.options?.length > 0) {
          console.log("📦 Multiple variants product - creating variants with bulk create");
          await this.createProductVariantsBulk(client, productId, variants, productData.options || [], createdProduct.options || []);
        } else {
          console.log("⏭️ Unhandled variant scenario");
        }
      } catch (variantError) {
        console.error("❌ Variant processing failed:", variantError.message);
      }

      if (images.length > 0) {
        console.log("📸 Adding", images.length, "images to product");
        await this.addProductImages(client, productId, images);
      }

      if (collectionId) {
        await this.addToCollection(client, productId, collectionId);
      }

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

  // Build product options array for product creation
  buildProductOptions(options) {
    if (!options || options.length === 0) return [];
    
    return options.map(opt => ({
      name: opt.name,
      values: opt.values.map(v => ({ name: v }))
    }));
  }

  applyPriceMarkup(variants, markup, type, storeCurrency, productData) {
    return variants.map(variant => {
      let price = parseFloat(variant.price) || 0;
      let comparePrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;

      console.log("💰 Original price:", variant.price, "-> Parsed:", price);

      if (markup && markup !== 0) {
        if (type === "percentage") {
          price = price * (1 + markup / 100);
          if (comparePrice) {
            comparePrice = comparePrice * (1 + markup / 100);
          }
        } else {
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

  // FIXED: Create variants using new optionValues format
  async createProductVariantsBulk(client, productId, variants, sourceOptions, createdOptions) {
    console.log("📦 Creating", variants.length, "variants with bulk create");
    console.log("📦 Source options:", JSON.stringify(sourceOptions, null, 2));
    console.log("📦 Created options:", JSON.stringify(createdOptions, null, 2));
    
    try {
      // Build option name mapping
      const optionNames = [];
      if (createdOptions && createdOptions.length > 0) {
        createdOptions.forEach(opt => optionNames.push(opt.name));
      } else if (sourceOptions && sourceOptions.length > 0) {
        sourceOptions.forEach(opt => optionNames.push(opt.name));
      } else {
        // Default option names
        optionNames.push("Option 1", "Option 2", "Option 3");
      }

      console.log("📦 Option names for variants:", optionNames);

      // Prepare variant inputs with optionValues format (NEW API)
      const variantInputs = variants.map((variant, index) => {
        // Build optionValues array
        const optionValues = [];
        
        if (variant.option1 && optionNames[0]) {
          optionValues.push({
            optionName: optionNames[0],
            name: variant.option1
          });
        }
        
        if (variant.option2 && optionNames[1]) {
          optionValues.push({
            optionName: optionNames[1],
            name: variant.option2
          });
        }
        
        if (variant.option3 && optionNames[2]) {
          optionValues.push({
            optionName: optionNames[2],
            name: variant.option3
          });
        }

        const variantInput = {
          price: variant.price,
          optionValues: optionValues,
        };

        // Add optional fields if they exist
        if (variant.compare_at_price) {
          variantInput.compareAtPrice = variant.compare_at_price;
        }
        
        if (variant.sku) {
          variantInput.sku = variant.sku;
        }

        if (variant.weight) {
          variantInput.weight = parseFloat(variant.weight);
          variantInput.weightUnit = (variant.weight_unit || 'kg').toUpperCase();
        }

        if (index === 0) {
          console.log("📦 First variant input example:", JSON.stringify(variantInput, null, 2));
        }

        return variantInput;
      });

      // Filter out variants with no option values (skip invalid ones)
      const validVariantInputs = variantInputs.filter(v => v.optionValues && v.optionValues.length > 0);

      if (validVariantInputs.length === 0) {
        console.log("⚠️ No valid variants to create (no option values)");
        // Just update the default variant price
        await this.updateFirstVariantPrice(client, productId, variants[0]);
        return;
      }

      console.log("📦 Bulk creating", validVariantInputs.length, "variants");

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
            variants: validVariantInputs,
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkCreate;
      
      if (result?.userErrors?.length > 0) {
        console.error("📦 Bulk variant creation errors:", JSON.stringify(result.userErrors, null, 2));
        
        // Try alternative approach if bulk create fails
        console.log("🔄 Trying alternative variant creation method...");
        await this.createVariantsOneByOne(client, productId, variants, optionNames);
        return;
      }

      const createdVariants = result?.productVariants || [];
      console.log(`✅ Successfully created ${createdVariants.length} variants out of ${validVariantInputs.length}`);

      // Log first few created variants
      createdVariants.slice(0, 3).forEach((variant, index) => {
        console.log(`✅ Variant ${index + 1}: ${variant.title} - Price: ${variant.price}`);
      });

      // Delete default variant if we created new ones
      if (createdVariants.length > 0) {
        await this.deleteDefaultVariant(client, productId);
      }

    } catch (error) {
      console.error("❌ Bulk variant creation failed:", error.message);
      
      // Fallback: update first variant price
      try {
        await this.updateFirstVariantPrice(client, productId, variants[0]);
      } catch (fallbackError) {
        console.error("❌ Fallback also failed:", fallbackError.message);
      }
      
      throw error;
    }
  }

  // Alternative: Create variants one by one
  async createVariantsOneByOne(client, productId, variants, optionNames) {
    console.log("🔄 Creating variants one by one...");
    let successCount = 0;

    for (let i = 0; i < Math.min(variants.length, 100); i++) {
      const variant = variants[i];
      
      try {
        const optionValues = [];
        
        if (variant.option1 && optionNames[0]) {
          optionValues.push({ optionName: optionNames[0], name: variant.option1 });
        }
        if (variant.option2 && optionNames[1]) {
          optionValues.push({ optionName: optionNames[1], name: variant.option2 });
        }
        if (variant.option3 && optionNames[2]) {
          optionValues.push({ optionName: optionNames[2], name: variant.option3 });
        }

        if (optionValues.length === 0) continue;

        const response = await client.query({
          data: {
            query: `
              mutation productVariantCreate($input: ProductVariantInput!) {
                productVariantCreate(input: $input) {
                  productVariant {
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
              input: {
                productId: productId,
                price: variant.price,
                compareAtPrice: variant.compare_at_price || null,
                sku: variant.sku || "",
                options: [variant.option1, variant.option2, variant.option3].filter(Boolean),
              },
            },
          },
        });

        const result = response.body?.data?.productVariantCreate;
        if (result?.productVariant) {
          successCount++;
        }

        // Small delay to avoid rate limiting
        await this.delay(100);

      } catch (error) {
        console.log(`⚠️ Variant ${i + 1} failed:`, error.message);
      }
    }

    console.log(`✅ Created ${successCount} variants one by one`);
  }

  // Delete the default "Default Title" variant
  async deleteDefaultVariant(client, productId) {
    try {
      const response = await client.query({
        data: {
          query: `
            query getProductVariants($id: ID!) {
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
        console.log("🗑️ Deleting default variant:", defaultVariant.node.id);
        
        await client.query({
          data: {
            query: `
              mutation productVariantDelete($id: ID!) {
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

  async updateFirstVariantPrice(client, productId, variantData) {
    try {
      console.log("🔄 Updating first variant price as fallback...");
      
      const productResponse = await client.query({
        data: {
          query: `query { product(id: "${productId}") { variants(first: 1) { edges { node { id } } } } }`,
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

  async updateDefaultVariant(client, variantId, variantData) {
    console.log("🔄 Updating variant price:", variantId, "with price:", variantData.price);

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
        throw new Error("Variant update failed: " + result.userErrors.map(e => e.message).join(", "));
      } else {
        console.log("✅ Variant updated successfully, new price:", result?.productVariant?.price);
      }
    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      throw error;
    }
  }

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