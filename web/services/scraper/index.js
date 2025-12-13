import ShopifyScraper from "./shopify.js";
import AliExpressScraper from "./aliexpress.js";
import AmazonScraper from "./amazon.js";
import GenericScraper from "./generic.js";

class ProductScraper {
  constructor() {
    this.scrapers = {
      shopify: new ShopifyScraper(),
      aliexpress: new AliExpressScraper(),
      amazon: new AmazonScraper(),
      generic: new GenericScraper(),
    };
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url) {
    const urlLower = url.toLowerCase();

    console.log("🔍 Detecting platform for:", urlLower);

    if (urlLower.includes("aliexpress.com")) {
      console.log("📦 Detected: AliExpress");
      return "aliexpress";
    }
    if (urlLower.includes("amazon.com") || urlLower.includes("amazon.")) {
      console.log("📦 Detected: Amazon");
      return "amazon";
    }
    if (urlLower.includes("myshopify.com") || this.isShopifyStore(url)) {
      console.log("📦 Detected: Shopify");
      return "shopify";
    }

    console.log("📦 Detected: Generic");
    return "generic";
  }

  /**
   * Check if URL is a Shopify store
   */
  async isShopifyStore(url) {
    try {
      const response = await fetch(`${new URL(url).origin}/products.json?limit=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Scrape single product
   */
  async scrapeProduct(url) {
    const platform = await this.detectPlatform(url);
    const scraper = this.scrapers[platform] || this.scrapers.generic;
    
    console.log(`🔍 Scraping from ${platform}: ${url}`);
    
    try {
      const product = await scraper.scrapeProduct(url);
      return {
        success: true,
        platform,
        product,
      };
    } catch (error) {
      console.error(`Scrape error: ${error.message}`);
      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }

  /**
   * Scrape collection/multiple products
   */
  async scrapeCollection(url, limit = 50) {
    const platform = await this.detectPlatform(url);
    const scraper = this.scrapers[platform] || this.scrapers.generic;
    
    console.log(`📦 Scraping collection from ${platform}: ${url}`);
    
    try {
      const products = await scraper.scrapeCollection(url, limit);
      return {
        success: true,
        platform,
        products,
        count: products.length,
      };
    } catch (error) {
      console.error(`Collection scrape error: ${error.message}`);
      return {
        success: false,
        platform,
        error: error.message,
      };
    }
  }
}

export default new ProductScraper();
