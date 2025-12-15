import axios from "axios";
import * as cheerio from "cheerio";

class ShopifyScraper {
  /**
   * Scrape single product from Shopify store
   */
  async scrapeProduct(url) {
    try {
      // Try JSON endpoint first (fastest)
      const jsonUrl = this.getJsonUrl(url);
      const response = await axios.get(jsonUrl);
      const productData = response.data.product;
      
      return this.transformProduct(productData, url);
    } catch (error) {
      // Fallback to HTML scraping
      return this.scrapeProductHtml(url);
    }
  }

  /**
   * Get JSON URL from product URL
   */
  getJsonUrl(url) {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const handle = pathParts[pathParts.length - 1];
    
    return `${urlObj.origin}/products/${handle}.json`;
  }

  /**
   * Scrape product from HTML (fallback)
   */
  async scrapeProductHtml(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    // Try to find product JSON in script tag
    let productData = null;
    
    $('script[type="application/json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json.product) {
          productData = json.product;
        }
      } catch {}
    });
    
    // Also check for window.product variable
    $("script").each((i, el) => {
      const content = $(el).html() || "";
      const match = content.match(/var\s+product\s*=\s*({[\s\S]*?});/);
      if (match) {
        try {
          productData = JSON.parse(match[1]);
        } catch {}
      }
    });
    
    if (productData) {
      return this.transformProduct(productData, url);
    }
    
    // Manual HTML extraction
    return {
      title: $('h1').first().text().trim() || $('[class*="product-title"]').first().text().trim(),
      description: $('[class*="product-description"]').html() || $('meta[name="description"]').attr("content"),
      images: this.extractImages($),
      price: this.extractPrice($),
      variants: [],
      vendor: $('[class*="vendor"]').text().trim(),
      tags: [],
      source_url: url,
    };
  }

  /**
   * Transform Shopify product data to our format
   */
  transformProduct(data, sourceUrl) {
    // Ensure tags are always an array
    let tags = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags;
    } else if (typeof data.tags === 'string') {
      // Handle comma-separated string
      tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Remove duplicate variants based on option combinations
    const seenCombinations = new Set();
    const uniqueVariants = [];
    
    (data.variants || []).forEach(variant => {
      const combinationKey = [
        variant.option1 || '',
        variant.option2 || '',
        variant.option3 || ''
      ].join('|');
      
      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
        uniqueVariants.push({
          title: variant.title,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          sku: variant.sku,
          weight: variant.weight,
          weight_unit: variant.weight_unit || "kg",
          inventory_quantity: variant.inventory_quantity || 0,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          requires_shipping: variant.requires_shipping !== false,
        });
      }
    });

    console.log(`📦 Shopify scraper: ${data.variants?.length || 0} variants → ${uniqueVariants.length} unique variants`);

    return {
      title: data.title,
      description: data.body_html || data.description || "",
      vendor: data.vendor || "",
      product_type: data.product_type || "",
      tags: tags,
      images: (data.images || []).map(img => ({
        src: img.src || img,
        alt: img.alt || data.title,
        position: img.position || 1,
      })),
      variants: uniqueVariants,
      options: data.options || [],
      source_url: sourceUrl,
      source_id: data.id?.toString(),
      source_handle: data.handle,
    };
  }

  /**
   * Scrape collection
   */
  async scrapeCollection(url, limit = 50) {
    const urlObj = new URL(url);
    const products = [];
    let page = 1;
    
    // Check if it's a collection URL or all products
    const isCollection = url.includes("/collections/");
    let baseUrl = urlObj.origin;
    
    if (isCollection) {
      const collectionHandle = urlObj.pathname.split("/collections/")[1]?.split("/")[0];
      baseUrl = `${urlObj.origin}/collections/${collectionHandle}`;
    }
    
    while (products.length < limit) {
      try {
        const response = await axios.get(`${baseUrl}/products.json?page=${page}&limit=250`);
        const pageProducts = response.data.products;
        
        if (!pageProducts || pageProducts.length === 0) break;
        
        for (const product of pageProducts) {
          if (products.length >= limit) break;
          
          products.push(this.transformProduct(product, `${urlObj.origin}/products/${product.handle}`));
        }
        
        page++;
        
        // Rate limiting
        await this.delay(500);
      } catch (error) {
        console.error(`Collection page ${page} error:`, error.message);
        break;
      }
    }
    
    return products;
  }

  /**
   * Extract images from HTML
   */
  extractImages($) {
    const images = [];
    
    $('[class*="product"] img, [data-product-image] img, .product-image img').each((i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && !src.includes("svg") && !src.includes("icon")) {
        images.push({
          src: src.startsWith("//") ? `https:${src}` : src,
          alt: $(el).attr("alt") || "",
          position: i + 1,
        });
      }
    });
    
    return images;
  }

  /**
   * Extract price from HTML
   */
  extractPrice($) {
    const priceText = $('[class*="price"]').first().text();
    const match = priceText.match(/[\d,.]+/);
    return match ? parseFloat(match[0].replace(",", "")) : 0;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ShopifyScraper;
