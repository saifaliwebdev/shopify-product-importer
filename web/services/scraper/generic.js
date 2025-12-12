import axios from "axios";
import * as cheerio from "cheerio";

class GenericScraper {
  /**
   * Scrape product from any website
   */
  async scrapeProduct(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      // Try multiple selectors for each field
      const title = this.extractTitle($);
      const price = this.extractPrice($);
      const images = this.extractImages($, url);
      const description = this.extractDescription($);

      if (!title) {
        throw new Error("Could not extract product title");
      }

      return {
        title,
        description,
        vendor: new URL(url).hostname.replace("www.", ""),
        product_type: "",
        tags: ["imported"],
        images: images.slice(0, 10),
        variants: [{
          title: "Default",
          price: price.toString(),
          sku: `GEN-${Date.now()}`,
          option1: null,
          option2: null,
          option3: null,
          inventory_quantity: 100,
        }],
        options: [],
        source_url: url,
      };

    } catch (error) {
      console.error("Generic scrape error:", error);
      throw error;
    }
  }

  extractTitle($) {
    const selectors = [
      'h1[class*="product"]',
      'h1[class*="title"]',
      'h1[itemprop="name"]',
      '[class*="product-title"]',
      '[class*="product-name"]',
      '[data-testid*="title"]',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'h1',
      'title',
    ];

    for (const selector of selectors) {
      const el = $(selector).first();
      const text = el.attr("content") || el.text();
      if (text && text.trim().length > 2) {
        return text.trim();
      }
    }

    return null;
  }

  extractPrice($) {
    const selectors = [
      '[class*="price"]:not([class*="compare"])',
      '[itemprop="price"]',
      '[data-price]',
      '[class*="Price"]',
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
    ];

    for (const selector of selectors) {
      const el = $(selector).first();
      const text = el.attr("content") || el.attr("data-price") || el.text();
      const match = (text || "").match(/[\d,.]+/);
      if (match) {
        const price = parseFloat(match[0].replace(",", ""));
        if (price > 0) return price;
      }
    }

    return 0;
  }

  extractImages($, baseUrl) {
    const images = [];
    const seen = new Set();

    const selectors = [
      '[class*="product"] img',
      '[class*="gallery"] img',
      '[itemprop="image"]',
      '[class*="slider"] img',
      'meta[property="og:image"]',
      '[class*="main-image"] img',
      '.product-image img',
      '#product-image img',
    ];

    for (const selector of selectors) {
      $(selector).each((i, el) => {
        let src = $(el).attr("src") || 
                  $(el).attr("data-src") || 
                  $(el).attr("content") ||
                  $(el).attr("data-lazy-src");

        if (!src) return;

        // Make absolute URL
        if (src.startsWith("//")) {
          src = "https:" + src;
        } else if (src.startsWith("/")) {
          const origin = new URL(baseUrl).origin;
          src = origin + src;
        }

        // Skip tiny images, icons, placeholders
        if (
          src.includes("placeholder") ||
          src.includes("icon") ||
          src.includes("sprite") ||
          src.includes("logo") ||
          src.includes("data:image") ||
          src.includes(".svg") ||
          seen.has(src)
        ) {
          return;
        }

        seen.add(src);
        images.push({
          src,
          alt: $(el).attr("alt") || "",
        });
      });
    }

    return images;
  }

  extractDescription($) {
    const selectors = [
      '[class*="product-description"]',
      '[class*="description"]',
      '[itemprop="description"]',
      '#product-description',
      '.product-details',
      'meta[name="description"]',
      'meta[property="og:description"]',
    ];

    for (const selector of selectors) {
      const el = $(selector).first();
      const content = el.attr("content") || el.html();
      if (content && content.trim().length > 10) {
        return content.trim();
      }
    }

    return "";
  }

  /**
   * Scrape collection - not supported for generic
   */
  async scrapeCollection(url, limit = 50) {
    // For generic sites, just return single product
    try {
      const product = await this.scrapeProduct(url);
      return [product];
    } catch (error) {
      return [];
    }
  }
}

export default GenericScraper;