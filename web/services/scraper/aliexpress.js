import axios from "axios";
import * as cheerio from "cheerio";

class AliExpressScraper {
  /**
   * Scrape single product from AliExpress
   * Note: Basic scraping without Puppeteer (limited functionality)
   */
  async scrapeProduct(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Extract basic info
      const title = $("h1").first().text().trim() || 
                   $('[data-pl="product-title"]').text().trim() ||
                   "AliExpress Product";

      // Try to find price
      const priceText = $('[class*="price"]').first().text();
      const priceMatch = priceText.match(/[\d.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

      // Images
      const images = [];
      $('img[src*="alicdn"]').each((i, el) => {
        const src = $(el).attr("src");
        if (src && !src.includes("icon") && images.length < 10) {
          images.push({
            src: src.startsWith("//") ? `https:${src}` : src,
            alt: title,
          });
        }
      });

      return {
        title,
        description: "Imported from AliExpress",
        vendor: "AliExpress",
        product_type: "",
        tags: ["aliexpress", "imported"],
        images: images.slice(0, 10),
        variants: [{
          title: "Default",
          price: price.toString(),
          sku: `ALI-${Date.now()}`,
          option1: null,
          option2: null,
          option3: null,
          inventory_quantity: 100,
        }],
        options: [],
        source_url: url,
      };

    } catch (error) {
      console.error("AliExpress scrape error:", error.message);
      throw new Error("AliExpress scraping requires manual import. Please use Shopify store URLs for automatic import.");
    }
  }

  async scrapeCollection(url, limit = 50) {
    // Not supported without Puppeteer
    throw new Error("AliExpress collection import not available. Please import products one by one.");
  }
}

export default AliExpressScraper;