import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

class AliExpressScraper {
  constructor() {
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  /**
   * Scrape single product from AliExpress
   */
  async scrapeProduct(url) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set user agent to avoid blocking
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for product data to load
      await page.waitForSelector("h1", { timeout: 10000 });

      // Extract product data
      const productData = await page.evaluate(() => {
        // Try to find product JSON data
        const scripts = document.querySelectorAll("script");
        let data = null;

        for (const script of scripts) {
          const content = script.textContent || "";
          if (content.includes("window.runParams")) {
            try {
              const match = content.match(/data:\s*({[\s\S]*?})\s*}\s*;/);
              if (match) {
                data = JSON.parse(match[1]);
              }
            } catch (e) {}
          }
        }

        // Fallback to DOM scraping
        const title = document.querySelector("h1")?.textContent?.trim() || "";
        
        const priceEl = document.querySelector('[class*="price"] [class*="current"]') ||
                       document.querySelector('[class*="Price"]');
        const priceText = priceEl?.textContent || "";
        const priceMatch = priceText.match(/[\d.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

        // Images
        const images = [];
        document.querySelectorAll('[class*="slider"] img, [class*="gallery"] img').forEach((img) => {
          const src = img.src || img.dataset.src;
          if (src && !src.includes("placeholder")) {
            // Get high quality version
            const highQualitySrc = src.replace(/_\d+x\d+/, "").replace(/\.jpg_.*/, ".jpg");
            images.push({
              src: highQualitySrc.startsWith("//") ? `https:${highQualitySrc}` : highQualitySrc,
              alt: img.alt || title,
            });
          }
        });

        // Description
        const descEl = document.querySelector('[class*="description"]') ||
                      document.querySelector('[class*="Detail"]');
        const description = descEl?.innerHTML || "";

        // Variants/Options
        const options = [];
        document.querySelectorAll('[class*="sku-property"]').forEach((prop) => {
          const name = prop.querySelector('[class*="title"]')?.textContent?.trim() || "";
          const values = [];
          prop.querySelectorAll('[class*="sku-property-item"]').forEach((item) => {
            const value = item.textContent?.trim() || item.title || "";
            if (value) values.push(value);
          });
          if (name && values.length) {
            options.push({ name, values });
          }
        });

        return { title, price, images, description, options, rawData: data };
      });

      // Build variants from options
      const variants = this.buildVariants(productData.options, productData.price);

      return {
        title: productData.title,
        description: productData.description,
        vendor: "AliExpress",
        product_type: "",
        tags: ["aliexpress", "imported"],
        images: productData.images.slice(0, 10),
        variants: variants.length > 0 ? variants : [{
          title: "Default",
          price: productData.price.toString(),
          sku: "",
          option1: null,
          option2: null,
          option3: null,
        }],
        options: productData.options,
        source_url: url,
      };

    } catch (error) {
      console.error("AliExpress scrape error:", error);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Build variants from options
   */
  buildVariants(options, basePrice) {
    if (!options || options.length === 0) return [];

    const variants = [];
    
    const generateCombinations = (arrays, current = []) => {
      if (arrays.length === 0) {
        return [current];
      }
      const [first, ...rest] = arrays;
      const combinations = [];
      for (const value of first) {
        combinations.push(...generateCombinations(rest, [...current, value]));
      }
      return combinations;
    };

    const optionValues = options.map(o => o.values);
    const combinations = generateCombinations(optionValues);

    combinations.forEach((combo, index) => {
      variants.push({
        title: combo.join(" / "),
        price: basePrice.toString(),
        sku: `ALI-${Date.now()}-${index}`,
        option1: combo[0] || null,
        option2: combo[1] || null,
        option3: combo[2] || null,
        inventory_quantity: 100,
      });
    });

    return variants.slice(0, 100); // Shopify limit
  }

  /**
   * Scrape collection/search results
   */
  async scrapeCollection(url, limit = 50) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const products = [];

    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('[class*="product"], [class*="item"]', { timeout: 10000 });

      // Get product links
      const productLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*="/item/"]').forEach((a) => {
          const href = a.href;
          if (href && !links.includes(href)) {
            links.push(href);
          }
        });
        return links;
      });

      // Scrape each product
      for (const link of productLinks.slice(0, limit)) {
        try {
          const product = await this.scrapeProduct(link);
          products.push(product);
          await this.delay(1000); // Rate limiting
        } catch (error) {
          console.error(`Failed to scrape ${link}:`, error.message);
        }
      }

      return products;

    } finally {
      await page.close();
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AliExpressScraper;