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
            c o n s t   r e s u l t   =   r e s p o n s e . b o d y ? . d a t a ? . p r o d u c t V a r i a n t s B u l k U p d a t e   | |   r e s p o n s e . d a t a ? . p r o d u c t V a r i a n t s B u l k U p d a t e ; 
 
             i f   ( r e s u l t ? . u s e r E r r o r s ? . l e n g t h   >   0 )   { 
                 c o n s o l e . e r r o r ( " L'  B u l k   u p d a t e   a l s o   f a i l e d : " ,   r e s u l t . u s e r E r r o r s ) ; 
             }   e l s e   { 
                 c o n s o l e . l o g ( " '  V a r i a n t   u p d a t e d   v i a   b u l k   u p d a t e ,   p r i c e : " ,   r e s u l t ? . p r o d u c t V a r i a n t s ? . [ 0 ] ? . p r i c e ) ; 
             } 
         }   c a t c h   ( e r r )   { 
             c o n s o l e . e r r o r ( " L'  A l t e r n a t i v e   u p d a t e   a l s o   f a i l e d : " ,   e r r . m e s s a g e ) ; 
         } 
     } 
 
     / * * 
       *   A d d   i m a g e s   t o   p r o d u c t 
       * / 
     a s y n c   a d d P r o d u c t I m a g e s ( c l i e n t ,   p r o d u c t I d ,   i m a g e s )   { 
         c o n s t   m e d i a   =   i m a g e s . m a p ( ( i m g ,   i n d e x )   = >   ( { 
             o r i g i n a l S o u r c e :   i m g . s r c , 
             a l t :   i m g . a l t   | |   " " , 
             m e d i a C o n t e n t T y p e :   " I M A G E " , 
         } ) ) ; 
 
         a w a i t   c l i e n t . q u e r y ( { 
             d a t a :   { 
                 q u e r y :   ` 
                     m u t a t i o n   p r o d u c t C r e a t e M e d i a ( $ p r o d u c t I d :   I D ! ,   $ m e d i a :   [ C r e a t e M e d i a I n p u t ! ] ! )   { 
                         p r o d u c t C r e a t e M e d i a ( p r o d u c t I d :   $ p r o d u c t I d ,   m e d i a :   $ m e d i a )   { 
                             m e d i a   { 
                                 . . .   o n   M e d i a I m a g e   { 
                                     i d 
                                 } 
                             } 
                             m e d i a U s e r E r r o r s   { 
                                 f i e l d 
                                 m e s s a g e 
                             } 
                         } 
                     } 
                 ` , 
                 v a r i a b l e s :   {   p r o d u c t I d ,   m e d i a   } , 
             } , 
         } ) ; 
     } 
 
     / * * 
       *   A d d   p r o d u c t   t o   c o l l e c t i o n 
       * / 
     a s y n c   a d d T o C o l l e c t i o n ( c l i e n t ,   p r o d u c t I d ,   c o l l e c t i o n I d )   { 
         c o n s o l e . l o g ( " =���  A d d i n g   p r o d u c t   t o   c o l l e c t i o n : " ,   c o l l e c t i o n I d ) ; 
         
         t r y   { 
             c o n s t   r e s p o n s e   =   a w a i t   c l i e n t . q u e r y ( { 
                 d a t a :   { 
                     q u e r y :   ` 
                         m u t a t i o n   c o l l e c t i o n A d d P r o d u c t s ( $ i d :   I D ! ,   $ p r o d u c t I d s :   [ I D ! ] ! )   { 
                             c o l l e c t i o n A d d P r o d u c t s ( i d :   $ i d ,   p r o d u c t I d s :   $ p r o d u c t I d s )   { 
                                 c o l l e c t i o n   { 
                                     i d 
                                     t i t l e 
                                 } 
                                 u s e r E r r o r s   { 
                                     f i e l d 
                                     m e s s a g e 
                                 } 
                             } 
                         } 
                     ` , 
                     v a r i a b l e s :   { 
                         i d :   c o l l e c t i o n I d , 
                         p r o d u c t I d s :   [ p r o d u c t I d ] , 
                     } , 
                 } , 
             } ) ; 
 
             c o n s t   r e s u l t   =   r e s p o n s e . b o d y ? . d a t a ? . c o l l e c t i o n A d d P r o d u c t s   | |   r e s p o n s e . d a t a ? . c o l l e c t i o n A d d P r o d u c t s ; 
             
             i f   ( r e s u l t ? . u s e r E r r o r s ? . l e n g t h   >   0 )   { 
                 c o n s o l e . e r r o r ( " L'  C o l l e c t i o n   a d d   e r r o r : " ,   r e s u l t . u s e r E r r o r s ) ; 
             }   e l s e   { 
                 c o n s o l e . l o g ( " '  P r o d u c t   a d d e d   t o   c o l l e c t i o n : " ,   r e s u l t ? . c o l l e c t i o n ? . t i t l e   | |   c o l l e c t i o n I d ) ; 
             } 
         }   c a t c h   ( e r r o r )   { 
             c o n s o l e . e r r o r ( " L'  F a i l e d   t o   a d d   t o   c o l l e c t i o n : " ,   e r r o r . m e s s a g e ) ; 
         } 
     } 
 
     / * * 
       *   B u l k   i m p o r t   p r o d u c t s 
       * / 
     a s y n c   b u l k I m p o r t ( s e s s i o n ,   p r o d u c t s ,   o p t i o n s   =   { } )   { 
         c o n s t   r e s u l t s   =   { 
             t o t a l :   p r o d u c t s . l e n g t h , 
             s u c c e s s :   0 , 
             f a i l e d :   0 , 
             e r r o r s :   [ ] , 
         } ; 
 
         f o r   ( c o n s t   p r o d u c t   o f   p r o d u c t s )   { 
             c o n s t   r e s u l t   =   a w a i t   t h i s . i m p o r t P r o d u c t ( s e s s i o n ,   p r o d u c t ,   o p t i o n s ) ; 
             
             i f   ( r e s u l t . s u c c e s s )   { 
                 r e s u l t s . s u c c e s s + + ; 
             }   e l s e   { 
                 r e s u l t s . f a i l e d + + ; 
                 r e s u l t s . e r r o r s . p u s h ( { 
                     t i t l e :   p r o d u c t . t i t l e , 
                     u r l :   p r o d u c t . s o u r c e _ u r l , 
                     e r r o r :   r e s u l t . e r r o r , 
                 } ) ; 
             } 
 
             a w a i t   t h i s . d e l a y ( 5 0 0 ) ; 
         } 
 
         r e t u r n   r e s u l t s ; 
     } 
 
     d e l a y ( m s )   { 
         r e t u r n   n e w   P r o m i s e ( r e s o l v e   = >   s e t T i m e o u t ( r e s o l v e ,   m s ) ) ; 
     } 
 } 
 
 e x p o r t   d e f a u l t   n e w   P r o d u c t I m p o r t e r ( ) ;  
 