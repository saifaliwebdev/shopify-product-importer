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
      inventoryQuantity = 100,
    } = options;

    try {
      const client = new shopify.api.clients.Graphql({ session });
      
      const storeResponse = await client.request(`
        query {
          shop {
            currencyCode
          }
        }
      `);
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

      // Convert string status to GraphQL Enum
      const productStatus = status === "active" ? "ACTIVE" : "DRAFT";

      let finalTitle = productData.title;
      if (titlePrefix) finalTitle = `${titlePrefix} ${finalTitle}`;
      if (titleSuffix) finalTitle = `${finalTitle} ${titleSuffix}`;

      const finalVendor = replaceVendor || productData.vendor || "";

      // Step 1: Create product with options
      const productInput = {
        title: finalTitle,
        descriptionHtml: productData.description
          ?.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '') // Remove all table elements
          ?.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
          ?.replace(/style="[^"]*"/g, '') // Remove inline styles
          ?.replace(/<p><!----><\/p>/g, '') // Remove empty paragraph tags
          ?.replace(/<p>\s*<\/p>/g, '') // Remove whitespace-only paragraphs
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix double <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix triple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix quadruple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix quintuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix sextuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix septuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix octuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix nonuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix decuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix undecuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix duodecuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix tredecuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix quattuordecuple <br> tags
          ?.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/g, '<br>') // Fix quindecuple <br> tags
          ?.trim() || '<p>Product description</p>',
        vendor: finalVendor || 'Imported Product',
        status: productStatus, // This will be "DRAFT" or "ACTIVE" enum
        productType: productData.product_type?.trim() || "General", // Always provide a non-empty productType
      };

      // Add tags only if they exist (omit empty arrays)
      if (Array.isArray(productData.tags) && productData.tags.length > 0) {
        productInput.tags = productData.tags.map(t => String(t).trim()).filter(t => t.length > 0);
      }

      // Add product options if they exist
      if (productData.options && productData.options.length > 0) {
        productInput.options = productData.options.map(opt => ({
          name: String(opt.name).trim(),
          values: opt.values
            .map(v => String(v).trim())
            .filter(v => v.length > 0) // Remove empty strings
            .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
        })).filter(opt => opt.values.length > 0); // Remove options with no values

        // Final validation
        if (productInput.options.length === 0) {
          delete productInput.options;
        }

        console.log("🔧 Product options:", JSON.stringify(productInput.options, null, 2));
      }
      
      // --- DEBUGGING ---
      // Log the final productInput to verify against Shopify schema
      console.log("📦 Final ProductCreate input:", JSON.stringify(productInput, null, 2));
      // --- END DEBUGGING ---

      console.log("📦 Creating product:", finalTitle);

      const createResponse = await client.request(`
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
      `, { input: productInput });

      const result = createResponse.body?.data?.productCreate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Product creation errors:", JSON.stringify(result.userErrors, null, 2));
        // Log specific details for debugging - FIXED: Removed error.code reference
        result.userErrors.forEach(error => {
          console.error(`❌ Error in field: ${error.field.join('.')} - ${error.message}`);
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
      console.log("📦 Created options:", createdOptions.map(o => o.name).join(", "));

      // Step 2: Delete default variant first to avoid conflicts
      try {
        await this.deleteDefaultVariant(client, productId);
      } catch (error) {
        console.log("⚠️ Could not delete default variant:", error.message);
      }

      // Step 3: Handle variants
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
          await this.createAllVariants(client, productId, variants, createdOptions, inventoryQuantity);
        }
      } catch (variantError) {
        console.error("❌ Variant processing failed:", variantError.message);
      }

      // Step 4: Add images
      if (images.length > 0) {
        console.log("📸 Adding", images.length, "images");
        await this.addProductImages(client, productId, images);
      }

      // Step 5: Add to collection
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

  async createAllVariants(client, productId, variants, createdOptions, inventoryQuantity = 100) {
    console.log("📦 Creating variants with optionValues format...");
    
    // Get option names
    const optionNames = createdOptions.map(o => o.name);
    console.log("📦 Option names:", optionNames);

    // Fetch existing variants to avoid duplicates
    console.log("🔍 Checking existing variants...");
    const existingVariants = await this.getExistingVariants(client, productId);
    console.log(`📦 Found ${existingVariants.length} existing variants`);

    // Prepare variant inputs - ONLY valid fields
    const variantInputs = [];
    const seenCombinations = new Set();
    const variantsToUpdate = [];
    
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

      // Create a unique key for this combination
      const combinationKey = optionValues.map(opt => `${opt.optionName}:${opt.name}`).join('|');
      
      if (seenCombinations.has(combinationKey)) {
        console.log(`⚠️ Skipping duplicate variant: ${combinationKey}`);
        continue;
      }
      seenCombinations.add(combinationKey);

      // Check if this variant already exists
      const existingVariant = existingVariants.find(v => 
        this.compareVariantOptions(v.selectedOptions, optionValues)
      );

      if (existingVariant) {
        // Update existing variant
        console.log(`🔄 Updating existing variant: ${combinationKey}`);
        variantsToUpdate.push({
          id: existingVariant.id,
          price: String(variant.price),
          compareAtPrice: variant.compare_at_price ? String(variant.compare_at_price) : null,
        });
      } else {
        // Create new variant
        console.log(`➕ Creating new variant: ${combinationKey}`);
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
    }

    // Update existing variants
    if (variantsToUpdate.length > 0) {
      console.log(`🔄 Updating ${variantsToUpdate.length} existing variants...`);
      const updatedVariants = await this.updateExistingVariants(client, productId, variantsToUpdate);
      
      // Also enable inventory tracking and set quantities for updated variants
      if (inventoryQuantity > 0 && updatedVariants && updatedVariants.length > 0) {
        console.log(`📦 Enabling inventory tracking for ${updatedVariants.length} updated variants`);
        await this.enableInventoryTracking(client, updatedVariants);
        await this.setInventoryQuantities(client, updatedVariants, inventoryQuantity);
      }
    }

    // Create new variants
    if (variantInputs.length === 0) {
      console.log("⚠️ No new variants to create");
      return;
    }

    console.log(`➕ Creating ${variantInputs.length} new variants`);
    console.log("📦 First variant:", JSON.stringify(variantInputs[0], null, 2));

    try {
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
        productId: productId,
        variants: variantInputs,
      });

      const result = response.body?.data?.productVariantsBulkCreate;
      
      if (result?.userErrors?.length > 0) {
        console.error("❌ Variant creation errors:", JSON.stringify(result.userErrors, null, 2));
        
        // Log details about each error - FIXED: Removed error.code reference
        result.userErrors.forEach(error => {
          console.error(`❌ Error in field: ${error.field.join('.')} - ${error.message}`);
        });
        
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      const createdVariants = result?.productVariants || [];
      console.log(`✅ Created ${createdVariants.length} new variants successfully!`);

      // Show first 3 variants
      createdVariants.slice(0, 3).forEach((v, i) => {
        console.log(`   ✅ ${i + 1}. ${v.title} - $${v.price}`);
      });

      if (createdVariants.length > 3) {
        console.log(`   ... and ${createdVariants.length - 3} more variants`);
      }

      // ✅ Enable inventory tracking and set quantities for all created variants
      if (inventoryQuantity > 0) {
        console.log(`📦 Enabling inventory tracking and setting quantity to ${inventoryQuantity} for ${createdVariants.length} variants`);
        
        // First, enable inventory tracking for all variants
        await this.enableInventoryTracking(client, createdVariants);
        
        // Then set inventory quantities
        await this.setInventoryQuantities(client, createdVariants, inventoryQuantity);
      }

    } catch (error) {
      console.error("❌ Bulk create failed:", error.message);
      throw error;
    }
  }

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
      `, { id: productId });

      const variants = response.body?.data?.product?.variants?.edges || [];
      return variants.map(v => v.node);
    } catch (error) {
      console.error("❌ Failed to fetch existing variants:", error.message);
      return [];
    }
  }

  compareVariantOptions(existingOptions, newOptionValues) {
    if (existingOptions.length !== newOptionValues.length) {
      return false;
    }

    for (const existing of existingOptions) {
      const found = newOptionValues.find(newOpt => 
        newOpt.optionName === existing.name && newOpt.name === existing.value
      );
      if (!found) return false;
    }

    return true;
  }

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
        productId: productId,
        variants: variantsToUpdate,
      });

      const result = response.body?.data?.productVariantsBulkUpdate;

      if (result?.userErrors?.length > 0) {
        console.error("❌ Variant update errors:", result.userErrors);
        throw new Error(result.userErrors.map(e => e.message).join(", "));
      }

      const updatedVariants = result?.productVariants || [];
      console.log(`✅ Updated ${updatedVariants.length} existing variants`);
      updatedVariants.forEach((v, i) => {
        console.log(`   ✅ Updated: ${v.title} - $${v.price}`);
      });

      return updatedVariants;

    } catch (error) {
      console.error("❌ Variant update failed:", error.message);
      throw error;
    }
  }

  async updateVariantPrice(client, productId, variantId, price, compareAtPrice) {
    console.log("🔄 Updating variant price to:", price);

    try {
      // Use productVariantsBulkUpdate instead of productVariantUpdate
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
        productId: productId,
        variants: [{
          id: variantId,
          price: String(price),
          compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
        }],
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
      `, { id: productId });

      const variants = response.body?.data?.product?.variants?.edges || [];
      const defaultVariant = variants.find(v => v.node.title === "Default Title");

      if (defaultVariant && variants.length > 1) {
        console.log("🗑️ Deleting default variant...");
        
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
        `, { id: defaultVariant.node.id });
        
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
      `, { productId, media });

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
        id: collectionId,
        productIds: [productId],
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

  async setInventoryQuantities(client, variants, quantity) {
    try {
      // First, get the location ID for inventory management
      const locationId = await this.getLocationId(client);
      if (!locationId) {
        console.log("⚠️ Could not get location ID, skipping inventory update");
        return;
      }

      console.log(`📦 Setting inventory for ${variants.length} variants at location: ${locationId}`);

      // Fetch inventory item IDs for each variant
      const inventoryAdjustments = [];
      
      for (const variant of variants) {
        try {
          const response = await client.request(`
            query getVariantInventoryItem($id: ID!) {
              productVariant(id: $id) {
                inventoryItem {
                  id
                }
              }
            }
          `, { id: variant.id });

          const inventoryItemId = response.body?.data?.productVariant?.inventoryItem?.id;
          
          if (inventoryItemId) {
            inventoryAdjustments.push({
              inventoryItemId: inventoryItemId,
              locationId: locationId,
              availableQuantity: quantity
              // Note: reason field is only at top-level InventorySetQuantitiesInput
            });
          } else {
            console.error(`❌ Could not get inventory item for variant: ${variant.title}`);
          }
        } catch (error) {
          console.error(`❌ Failed to get inventory item for variant ${variant.title}:`, error.message);
        }
      }

      if (inventoryAdjustments.length === 0) {
        console.log("⚠️ No inventory adjustments to apply");
        return;
      }

      console.log(`📦 Applying ${inventoryAdjustments.length} inventory adjustments`);

      // Set inventory quantities using correct inventorySetQuantities mutation
      const response = await client.request(`
        mutation inventorySetQuantities($quantities: [InventoryQuantityInput!]!) {
          inventorySetQuantities(input: {
            name: "initial_import",
            reason: "initial_import",
            quantities: $quantities
          }) {
            inventoryAdjustmentGroup {
              inventoryAdjustments {
                id
                availableQuantity
                inventoryItem {
                  id
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, { quantities: inventoryAdjustments });

      const result = response.body?.data?.inventorySetQuantities;

      // Log the full response for debugging
      console.log("📦 InventorySetQuantities response:", JSON.stringify(result, null, 2));

      if (result?.userErrors?.length > 0) {
        console.error("❌ Inventory update errors:", JSON.stringify(result.userErrors, null, 2));
        return;
      }

      // Use the correct field path based on current Shopify schema
      const inventoryAdjustmentResults = result?.inventoryAdjustmentGroup?.inventoryAdjustments || [];
      console.log(`✅ Set inventory quantity to ${quantity} for ${inventoryAdjustmentResults.length} variants`);

      // Show inventory update results
      inventoryAdjustmentResults.slice(0, 3).forEach((adjustment, i) => {
        console.log(`   ✅ Variant ${i + 1}: ${adjustment.availableQuantity} units`);
      });

      if (inventoryAdjustmentResults.length > 3) {
        console.log(`   ... and ${inventoryAdjustmentResults.length - 3} more variants`);
      }

    } catch (error) {
      console.error("❌❌ Inventory update failed :", error.message);
    }
  }

  async enableInventoryTracking(client, variants) {
    try {
      console.log(`📦 Enabling inventory tracking for ${variants.length} variants`);
      
      // Note: inventoryManagement field is no longer supported in Shopify schema
      // Inventory tracking is automatically enabled when using inventorySetQuantities
      console.log("📦 Inventory tracking will be enabled via inventorySetQuantities mutation");

    } catch (error) {
      console.error("❌ Failed to enable inventory tracking:", error.message);
    }
  }
}

export default new ProductImporter();