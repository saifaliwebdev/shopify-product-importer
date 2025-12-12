import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

class AmazonScraper {
  constructor() {
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this.browser;
  }

  /**
   * Scrape single product from Amazon
   */
  async scrapeProduct(url) {
    // Try axios first (faster)
    try {
      return await this.scrapeWithAxios(url);
    } catch (error) {
      // Fallback to Puppeteer
      return await this.scrapeWithPuppeteer(url);
    }
  }

  async scrapeWithAxios(url) {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // Title
    const title = $("#productTitle").text().trim() ||
                  $("h1 span").first().text().trim();

    if (!title) throw new Error("Could not extract product title");

    // Price
    const priceText = $(".a-price .a-offscreen").first().text() ||
                     $("#priceblock_ourprice").text() ||
                     $("#priceblock_dealprice").text() ||
                     $('[data-a-color="price"] .a-offscreen').first().text();
    
    const priceMatch = priceText.match(/[\d,.]+/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(",", "")) : 0;

    // Compare at price
    const comparePriceText = $(".a-text-price .a-offscreen").first().text();
    const comparePriceMatch = comparePriceText.match(/[\d,.]+/);
    const comparePrice = comparePriceMatch ? 
      parseFloat(comparePriceMatch[0].replace(",", "")) : null;

    // Images
    const images = [];
    
    // Try to get images from JSON
    const scriptContent = $("script:contains('ImageBlockATF')").html() || "";
    const imageMatch = scriptContent.match(/'initial'\s*:\s*(\[[\s\S]*?\])/);
    
    if (imageMatch) {
      try {
        const imageData = JSON.parse(imageMatch[1]);
        imageData.forEach((img) => {
          if (img.hiRes) {
            images.push({ src: img.hiRes, alt: title });
          } else if (img.large) {
            images.push({ src: img.large, alt: title });
          }
        });
      } catch (e) {}
    }

    // Fallback to DOM images
    if (images.length === 0) {
      $("#altImages img, #imageBlock img").each((i, el) => {
        let src = $(el).attr("src") || "";
        // Get high quality version
        src = src.replace(/\._[A-Z]+\d+_/, "").replace(/\._.*_\./, ".");
        if (src && !src.includes("sprite") && !src.includes("grey-pixel")) {
          images.push({ src, alt: title });
        }
      });
    }

    // Description
    const description = $("#productDescription").html() ||
                       $("#feature-bullets").html() ||
                       $(".a-expander-content").first().html() ||
                       "";

    // Brand/Vendor
    const vendor = $("#bylineInfo").text().replace(/Visit the|Store|Brand:/gi, "").trim() ||
                  $('a#bylineInfo').text().trim() ||
                  $('[data-a-popover*="brand"]').text().trim() ||
                  "Amazon";

    // Variants
    const variants = [];
    const options = [];

    // Check for size/color options
    $("#variation_size_name li, #variation_color_name li").each((i, el) => {
      const value = $(el).attr("title") || $(el).text().trim();
      if (value) {
        // Simplified - would need more logic for real variants
      }
    });

    // Default variant if no variants found
    if (variants.length === 0) {
      variants.push({
        title: "Default",
        price: price.toString(),
        compare_at_price: comparePrice?.toString() || null,
        sku: `AMZ-${Date.now()}`,
        option1: null,
        option2: null,
        option3: null,
        inventory_quantity: 100,
      });
    }

    return {
      title,
      description,
      vendor,
      product_type: "",
      tags: ["amazon", "imported"],
      images: images.slice(0, 10),
      variants,
      options,
      source_url: url,
    };
  }

  async scrapeWithPuppeteer(url) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector("#productTitle, h1", { timeout: 10000 });

      const productData = await page.evaluate(() => {
        const title = document.querySelector("#productTitle")?.textContent?.trim() ||
                     document.querySelector("h1 span")?.textContent?.trim() || "";

        const priceEl = document.querySelector(".a-price .a-offscreen") ||
                       document.querySelector("#priceblock_ourprice");
        const priceText = priceEl?.textContent || "";
        const priceMatch = priceText.match(/[\d,.]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(",", "")) : 0;

        const images = [];
        document.querySelectorAll("#altImages img, #main-image-container img").forEach((img) => {
          let src = img.src || "";
          src = src.replace(/\._[A-Z]+\d+_/, "");
          if (src && !src.includes("sprite")) {
            images.push({ src, alt: title });
          }
        });

        const description = document.querySelector("#productDescription")?.innerHTML ||
                           document.querySelector("#feature-bullets")?.innerHTML || "";

        const vendor = document.querySelector("#bylineInfo")?.textContent?.trim() || "Amazon";

        return { title, price, images, description, vendor };
      });

      return {
        title: productData.title,
        description: productData.description,
        vendor: productData.vendor.replace(/Visit the|Store|Brand:/gi, "").trim(),
        product_type: "",
        tags: ["amazon", "imported"],
        images: productData.images.slice(0, 10),
        variants: [{
          title: "Default",
          price: productData.price.toString(),
          sku: `AMZ-${Date.now()}`,
          option1: null,
          option2: null,
          option3: null,
          inventory_quantity: 100,
        }],
        options: [],
        source_url: url,
      };

    } finally {
      await page.close();
    }
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

      // Get product links
      const productLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]').forEach((a) => {
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
          await this.delay(2000); // Amazon rate limiting
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

export default AmazonScraper;