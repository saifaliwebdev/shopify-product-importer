import axios from "axios";
import * as cheerio from "cheerio";

class AmazonScraper {
  /**
   * Scrape single product from Amazon
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

      // Title
      const title = $("#productTitle").text().trim() ||
                   $("h1 span").first().text().trim() ||
                   "Amazon Product";

      // Price
      const priceText = $(".a-price .a-offscreen").first().text() ||
                       $("#priceblock_ourprice").text() ||
                       $('[data-a-color="price"] .a-offscreen').first().text();
      
      const priceMatch = priceText.match(/[\d,.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0].replace(",", "")) : 0;

      // Images
      const images = [];
      $("#altImages img, #imageBlock img, #landingImage").each((i, el) => {
        let src = $(el).attr("src") || $(el).attr("data-old-hires") || "";
        if (src && !src.includes("sprite") && !src.includes("grey-pixel") && images.length < 10) {
          // Get high quality version
          src = src.replace(/\._[A-Z]+\d+_/, "");
          images.push({ src, alt: title });
        }
      });

      // Description
      const description = $("#productDescription").html() ||
                         $("#feature-bullets").html() ||
                         "";

      // Vendor
      const vendor = $("#bylineInfo").text().replace(/Visit the|Store|Brand:/gi, "").trim() || "Amazon";

      return {
        title,
        description,
        vendor,
        product_type: "",
        tags: ["amazon", "imported"],
        images: images.slice(0, 10),
        variants: [{
          title: "Default",
          price: price.toString(),
          sku: `AMZ-${Date.now()}`,
          option1: null,
          option2: null,
          option3: null,
          inventory_quantity: 100,
        }],
        options: [],
        source_url: url,
      };

    } catch (error) {
      console.error("Amazon scrape error:", error.message);
      throw new Error("Amazon scraping limited. Please try Shopify store URLs for best results.");
    }
  }

  async scrapeCollection(url, limit = 50) {
    throw new Error("Amazon collection import not available.");
  }
}

export default AmazonScraper;