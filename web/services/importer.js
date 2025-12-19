import shopify from "../shopify.js";
import Import from "../models/Import.js";
import ImageHandler from "./imageHandler.js";

class ProductImporter {
  constructor() {
    this.locationId = null;
    this.imageHandler = new ImageHandler();
  }

  // ✅ FIXED: getLocationId
  async getLocationId(client) {
    if (this.locationId) return this.locationId;
    
    try {
      const response = await client.request(`
        query {
          locations(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      `);
      
      // ✅ FIXED: Direct .data access for API v10
      this.locationId = response?.data?.locations?.edges?.[0]?.node?.id;
      console.log("📍 Location ID:", this.locationId);
      return this.locationId;
    } catch (error) {
      console.error("❌ Failed to get location ID:", error.message);
      return null;
    }
  }

  // ✅ Helper: Clean description
  cleanDescription(html) {
    if (!html) return '<p>Product description</p>';
    
    return html
      .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/style="[^"]*"/g, '')
      .replace(/<p><!----><\/p>/g, '')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '')
      .replace(/<li[^>]*>/gi, '<p>')
      .replace(/<\/li>/gi, '</p>')
      .replace(/<strong[^>]*>/gi, '')
      .replace(/<\/strong>/gi, '')
      .replace(/(<br\s*\/?>[\s]*){2,}/gi, '<br>')  // ✅ Single regex for all multiple <br>
      .trim();
  }

  // ✅ FIXED: importProduct
  async importProduct(session, productData, options = {}) {
    // ✅ Input validation
    if (!session?.shop || !session?.accessToken) {
      throw new Error("Invalid session - shop or accessToken missing");
    }
    
    if (!productData?.title) {
      throw new Error("Product title is required");
    }

    const {
      status = "draft",
      priceMarkup = 0,
      priceMarkupType = "percentage",
      downloadImages = true,
      collectionId = null,
      titlePrefix = "",
      titleSuffix = "",
      replaceVendor = "",
      inventoryQuantity = 100,
    } = options;

    try {
      const client = new shopify.api.clients.Graphql({ session });
      
      // ✅ FIXED: Get store currency
      const storeResponse = await client.request(`
        query {
          shop {
            currencyCode
          }
        }
      `);
      
      // ✅ FIXED: Direct .data access
      const storeCurrency = storeResponse?.data?.shop?.currencyCode || 'USD';
      console.log("🏪 Store currency:", storeCurrency);

      // Process images
      let images = productData.images || [];
      if (downloadImages && images.length > 0) {
        images = await this.imageHandler.processImages(images);
      }

      // Apply price markup
      const variants = this.applyPriceMarkup(
        productData.variants || [{ price: "0.00" }],
        priceMarkup,
        priceMarkupType
      );

      console.log("📦 Variants count:", variants.length);

      // Prepare product input
      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";

      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

      const finalVendor = replaceVendor || productData.vendor || "Imported Product";

      const productInput = {
        title: finalTitle,
        descriptionHtml: this.cleanDescription(productData.description),
        vendor: finalVendor,
        status: productStatus,
        productType: productData.product_type?.trim() || "General",
      };

      // Add tags if exist
      if (Array.isArray(productData.tags) && productData.tags.length > 0) {
        productInput.tags = productData.tags
          .map(t => String(t).trim())
          .filter(t => t.length > 0);
      }

      // Add options if exist (Shopify expects array of option names)
      if (productData.options && productData.options.length > 0) {
        productInput.options = productData.options
          .map(opt => String(opt.name).trim())
          .filter(name => name.length > 0)
          .filter((name, i, a) => a.indexOf(name) === i);
          
        if (productInput.options.length === 0) {
          delete productInput.options;
        }
      }

      console.log("📦 Creating product:", finalTitle);
      console.log("📦 Product Input:", JSON.stringify(productInput, null, 2));

      // Updated for Shopify API v10
      const createResponse = await client.request(`
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              handle
              status
              options {
                name
                values
              }
              variants(first: 1) {
                nodes {
                  id
                  title
                  price
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: productInput
        }
      });

      // ✅ FIXED: Direct .data access
      const result = createResponse?.data?.productCreate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Product creation errors:", JSON.stringify(result.userErrors, null, 2));
        result.userErrors.forEach(error => {
          console.error(`❌ Error in field: ${error.field?.join('.') || 'unknown'} - ${error.message}`);
        });
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      if (!result?.product) {
        throw new Error("Product creation failed - no product returned");
      }

      const createdProduct = result.product;
      const productId = createdProduct.id;
      const createdOptions = createdProduct.options || [];

      console.log("✅ Product created:", productId);

      // Handle variants
      try {
        if (variants.length <= 1 && (!productData.options || productData.options.length === 0)) {
          const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;
          if (defaultVariantId && variants[0]) {
            await this.updateVariantPrice(client, productId, defaultVariantId, variants[0].price, variants[0].compare_at_price);
          }
        } else {
          await this.deleteDefaultVariant(client, productId);
          await this.createAllVariants(client, productId, variants, createdOptions, inventoryQuantity);
        }
      } catch (variantError) {
        console.error("❌ Variant processing failed:", variantError.message);
      }

      // Add images
      if (images.length > 0) {
        console.log("📸 Adding", images.length, "images");
        await this.addProductImages(client, productId, images);
      }

      // Add to collection
      if (collectionId) {
        await this.addToCollection(client, productId, collectionId);
      }

      // Save import record
      await Import.create({
        shop: session.shop,
        source_url: productData.source_url || "unknown",
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
        source_url: productData.source_url || "unknown",
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

  // ✅ FIXED: createAllVariants
  async createAllVariants(client, productId, variants, createdOptions, inventoryQuantity = 100) {
    console.log("📦 Creating variants...");
    
    const optionNames = createdOptions.map(o => o.name);
    const existingVariants = await this.getExistingVariants(client, productId);
    
    const variantInputs = [];
    const seenCombinations = new Set();
    const variantsToUpdate = [];
    
    for (const variant of variants) {
      const optionValues = [];
      
      if (variant.option1 && optionNames[0]) {
        optionValues.push({ optionName: optionNames[0], name: String(variant.option1) });
      }
      if (variant.option2 && optionNames[1]) {
        optionValues.push({ optionName: optionNames[1], name: String(variant.option2) });
      }
      if (variant.option3 && optionNames[2]) {
        optionValues.push({ optionName: optionNames[2], name: String(variant.option3) });
      }

      if (optionValues.length === 0) continue;

      const combinationKey = optionValues.map(opt => `${opt.optionName}:${opt.name}`).join('|');
      
      if (seenCombinations.has(combinationKey)) {
        console.log(`⚠️ Skipping duplicate: ${combinationKey}`);
        continue;
      }
      seenCombinations.add(combinationKey);

      const existingVariant = existingVariants.find(v => 
        this.compareVariantOptions(v.selectedOptions, optionValues)
      );

      if (existingVariant) {
        variantsToUpdate.push({
          id: existingVariant.id,
          price: String(variant.price),
          compareAtPrice: variant.compare_at_price ? String(variant.compare_at_price) : null,
        });
      } else {
        const variantInput = {
          optionValues: optionValues,
          price: String(variant.price),
        };
        if (variant.compare_at_price) {
          variantInput.compareAtPrice = String(variant.compare_at_price);
        }
        variantInputs.push(variantInput);
      }
    }

    // Update existing
    if (variantsToUpdate.length > 0) {
      await this.updateExistingVariants(client, productId, variantsToUpdate);
    }

    // Create new
    if (variantInputs.length === 0) {
      console.log("⚠️ No new variants to create");
      return;
    }

    console.log(`➕ Creating ${variantInputs.length} new variants`);

    try {
      // ✅ FIXED: Correct syntax
      const response = await client.request(`
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
            }
          }
        }
      `, {
        variables: {  // ✅ FIXED
          productId: productId,
          variants: variantInputs,
        }
      });

      // ✅ FIXED: Direct .data access
      const result = response?.data?.productVariantsBulkCreate;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Variant errors:", JSON.stringify(result.userErrors, null, 2));
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      const createdVariants = result?.productVariants || [];
      console.log(`✅ Created ${createdVariants.length} variants`);

      // Set inventory
      if (inventoryQuantity > 0 && createdVariants.length > 0) {
        await this.setInventoryQuantities(client, createdVariants, inventoryQuantity);
      }

    } catch (error) {
      console.error("❌ Bulk create failed:", error.message);
      throw error;
    }
  }

  // ✅ FIXED: getExistingVariants
  async getExistingVariants(client, productId) {
    try {
      const response = await client.request(`
        query getVariants($id: ID!) {
          product(id: $id) {
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      `, {
        variables: { id: productId }  // ✅ FIXED
      });

      const variants = response?.data?.product?.variants?.edges || [];
      return variants.map(v => v.node);
    } catch (error) {
      console.error("❌ Failed to fetch variants:", error.message);
      return [];
    }
  }

  compareVariantOptions(existingOptions, newOptionValues) {
    if (existingOptions.length !== newOptionValues.length) return false;
    
    for (const existing of existingOptions) {
      const found = newOptionValues.find(newOpt => 
        newOpt.optionName === existing.name && newOpt.name === existing.value
      );
      if (!found) return false;
    }
    return true;
  }

  // ✅ FIXED: updateExistingVariants
  async updateExistingVariants(client, productId, variantsToUpdate) {
    try {
      const response = await client.request(`
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
              title
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {  // ✅ FIXED
          productId: productId,
          variants: variantsToUpdate,
        }
      });

      const result = response?.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      console.log(`✅ Updated ${result?.productVariants?.length || 0} variants`);
      return result?.productVariants || [];

    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      throw error;
    }
  }

  // ✅ FIXED: updateVariantPrice
  async updateVariantPrice(client, productId, variantId, price, compareAtPrice) {
    try {
      const response = await client.request(`
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
      `, {
        variables: {  // ✅ FIXED
          productId: productId,
          variants: [{
            id: variantId,
            price: String(price),
            compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
          }],
        }
      });

      const result = response?.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      console.log("✅ Variant price updated");

    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
    }
  }

  // ✅ FIXED: deleteDefaultVariant
  async deleteDefaultVariant(client, productId) {
    try {
      const response = await client.request(`
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
      `, {
        variables: { id: productId }  // ✅ FIXED
      });

      const variants = response?.data?.product?.variants?.edges || [];
      const defaultVariant = variants.find(v => v.node.title === "Default Title");

      if (defaultVariant && variants.length > 1) {
        await client.request(`
          mutation deleteVariant($id: ID!) {
            productVariantDelete(id: $id) {
              deletedProductVariantId
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: { id: defaultVariant.node.id }  // ✅ FIXED
        });
        console.log("✅ Default variant deleted");
      }
    } catch (error) {
      console.log("⚠️ Could not delete default variant:", error.message);
    }
  }

  // ✅ FIXED: addProductImages
  async addProductImages(client, productId, images) {
    try {
      const media = images.map(img => ({
        originalSource: img.src,
        alt: img.alt || "",
        mediaContentType: "IMAGE",
      }));

      const response = await client.request(`
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
      `, {
        variables: { productId, media }  // ✅ FIXED
      });

      const result = response?.data?.productCreateMedia;
      
      if (result?.mediaUserErrors?.length > 0) {
        console.error("❌ Image errors:", result.mediaUserErrors);
      } else {
        console.log("✅ Images added successfully");
      }
    } catch (error) {
      console.error("❌ Failed to add images:", error.message);
    }
  }

  // ✅ FIXED: addToCollection
  async addToCollection(client, productId, collectionId) {
    try {
      const response = await client.request(`
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
      `, {
        variables: {  // ✅ FIXED
          id: collectionId,
          productIds: [productId],
        }
      });

      const result = response?.data?.collectionAddProducts;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Collection error:", result.userErrors);
      } else {
        console.log("✅ Added to collection:", result?.collection?.title);
      }
    } catch (error) {
      console.error("❌ Failed to add to collection:", error.message);
    }
  }

  // ✅ FIXED: setInventoryQuantities
  async setInventoryQuantities(client, variants, quantity) {
    try {
      const locationId = await this.getLocationId(client);
      if (!locationId) {
        console.log("⚠️ Could not get location ID");
        return;
      }

      const inventoryAdjustments = [];
      
      for (const variant of variants) {
        try {
          const response = await client.request(`
            query getVariantInventory($id: ID!) {
              productVariant(id: $id) {
                inventoryItem {
                  id
                }
              }
            }
          `, {
            variables: { id: variant.id }  // ✅ FIXED
          });

          const inventoryItemId = response?.data?.productVariant?.inventoryItem?.id;
          
          if (inventoryItemId) {
            inventoryAdjustments.push({
              inventoryItemId: inventoryItemId,
              locationId: locationId,
              quantity: quantity
            });
          }
        } catch (error) {
          console.error(`❌ Failed for variant ${variant.id}:`, error.message);
        }
      }

      if (inventoryAdjustments.length === 0) return;

      // Set quantities
      const response = await client.request(`
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            inventoryAdjustmentGroup {
              createdAt
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {  // ✅ FIXED
          input: {
            name: "available",
            reason: "correction",
            quantities: inventoryAdjustments.map(adj => ({
              inventoryItemId: adj.inventoryItemId,
              locationId: adj.locationId,
              quantity: adj.quantity
            }))
          }
        }
      });

      const result = response?.data?.inventorySetQuantities;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Inventory errors:", result.userErrors);
      } else {
        console.log(`✅ Inventory set for ${inventoryAdjustments.length} variants`);
      }

    } catch (error) {
      console.error("❌ Inventory update failed:", error.message);
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

      await this.delay(2000);  // ✅ Increased delay for rate limiting
    }

    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ProductImporter;
