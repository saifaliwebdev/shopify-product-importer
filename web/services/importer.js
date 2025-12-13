import shopify from "../shopify.js";
import ImageHandler from "./imageHandler.js";
import Import from "../models/Import.js";

class ProductImporter {
  constructor() {
    this.imageHandler = new ImageHandler();
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
    } = options;

    try {
      // 1. Process images
      let images = productData.images || [];
      if (downloadImages && images.length > 0) {
        images = await this.imageHandler.processImages(images);
      }

      // 2. Apply price markup
      const variants = this.applyPriceMarkup(
        productData.variants,
        priceMarkup,
        priceMarkupType
      );

      // 3. Create product in Shopify
      const client = new shopify.api.clients.Graphql({ session });

      console.log("📦 Creating product in Shopify:", productData.title);

      const productInput = {
        title: productData.title,
        descriptionHtml: productData.description,
        vendor: productData.vendor || "",
        productType: productData.product_type || "",
        tags: productData.tags || [],
        status: status.toUpperCase(),
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

      console.log("📦 Product creation response:", JSON.stringify(createResponse.body, null, 2));

      const result = createResponse.body.data.productCreate;

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

      // 4. Add variants
      if (variants.length > 0) {
        await this.createVariants(client, productId, variants, productData.options);
      }

      // 5. Add images
      if (images.length > 0) {
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
   */
  applyPriceMarkup(variants, markup, type) {
    if (!markup || markup === 0) return variants;

    return variants.map(variant => {
      let price = parseFloat(variant.price) || 0;
      let comparePrice = parseFloat(variant.compare_at_price) || 0;

      if (type === "percentage") {
        price = price * (1 + markup / 100);
        if (comparePrice) {
          comparePrice = comparePrice * (1 + markup / 100);
        }
      } else {
        price = price + markup;
        if (comparePrice) {
          comparePrice = comparePrice + markup;
        }
      }

      return {
        ...variant,
        price: price.toFixed(2),
        compare_at_price: comparePrice ? comparePrice.toFixed(2) : null,
      };
    });
  }

  /**
   * Create variants for product
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
    await client.query({
      data: {
        query: `
          mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $productIds) {
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
