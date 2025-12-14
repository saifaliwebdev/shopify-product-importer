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
      const response = await client.request({
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
      
      const storeResponse = await client.request({
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

      const shopifyClient = new shopify.api.clients.Graphql({ session });
      console.log("📦 Creating product in Shopify:", productData.title);

      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";
      console.log("📦 Product status will be:", productStatus);

      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

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

      const createResponse = await client.request({
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
          console.log("📦 Multiple variants product - creating variants one by one");
          await this.createProductVariantsOneByOne(client, productId, variants, productData.options || []);
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

  async createProductVariantsOneByOne(client, productId, variants, options) {
    console.log("📦 Creating", variants.length, "variants one by one");

    try {
      if (options && options.length > 0) {
        console.log("🔧 Adding product options first...");
        
        const optionsToCreate = options.map(opt => ({
          name: opt.name || "Option",
          values: opt.values?.map(v => ({ name: v })) || []
        }));

        const optionsResponse = await client.request({
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

          const response = await client.request({
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
      await this.updateFirstVariantPrice(client, productId, variants[0]);
    }
  }

  async updateFirstVariantPrice(client, productId, variantData) {
    try {
      console.log("🔄 Updating first variant price as fallback...");
      
      const productResponse = await client.request({
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

  async updateDefaultVariant(client, variantId, variantData) {
    console.log("🔄 Updating variant using productVariantsBulkUpdate:", variantId, "with price:", variantData.price);

    try {
      const variantResponse = await client.request({
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
        throw new Error("Could not get product ID for variant");
      }

      console.log("🔄 Using productVariantsBulkUpdate with productId:", productId);

      const response = await client.request({
        data: {
          query: `
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
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
            productId: productId,
            variants: [{
              id: variantId,
              price: variantData.price,
              compareAtPrice: variantData.compare_at_price || null,
            }],
          },
        },
      });

      const result = response.body?.data?.productVariantsBulkUpdate || response.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        console.error("🔄 Variant bulk update errors:", result.userErrors);
        throw new Error("Variant update failed: " + result.userErrors.map(e => e.message).join(", "));
      } else {
        console.log("✅ Variant updated successfully, new price:", result?.productVariants?.[0]?.price);
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

    await client.request({
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
      const response = await client.request({
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
