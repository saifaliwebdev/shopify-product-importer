import Queue from "bull";
import Scraper from "./scraper/index.js";
import Importer from "./importer.js";

// Create Redis-backed queue
export const importQueue = new Queue("product-import", {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Process collection imports
 */
importQueue.process("collection-import", async (job) => {
  const { url, limit, options, shop, accessToken } = job.data;
  
  const session = { shop, accessToken };
  
  // Update progress
  job.progress(5);

  // 1. Scrape collection
  const scrapeResult = await Scraper.scrapeCollection(url, limit);
  
  if (!scrapeResult.success) {
    throw new Error(scrapeResult.error);
  }

  job.progress(20);

  const products = scrapeResult.products;
  const total = products.length;
  let imported = 0;
  let failed = 0;
  const errors = [];

  // 2. Import each product
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      const result = await Importer.importProduct(
        session,
        {
          ...product,
          source_platform: scrapeResult.platform,
        },
        options
      );

      if (result.success) {
        imported++;
      } else {
        failed++;
        errors.push({ title: product.title, error: result.error });
      }
    } catch (error) {
      failed++;
      errors.push({ title: product.title, error: error.message });
    }

    // Update progress
    const progress = 20 + Math.floor((i + 1) / total * 80);
    job.progress(progress);

    // Rate limiting
    await delay(600);
  }

  return {
    total,
    imported,
    failed,
    errors,
  };
});

/**
 * Process bulk URL imports
 */
importQueue.process("bulk-import", async (job) => {
  const { urls, options, shop, accessToken } = job.data;
  
  const session = { shop, accessToken };
  
  const total = urls.length;
  let imported = 0;
  let failed = 0;
  const errors = [];

  job.progress(5);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    try {
      // Scrape
      const scrapeResult = await Scraper.scrapeProduct(url);
      
      if (!scrapeResult.success) {
        failed++;
        errors.push({ url, error: scrapeResult.error });
        continue;
      }

      // Import
      const result = await Importer.importProduct(
        session,
        {
          ...scrapeResult.product,
          source_platform: scrapeResult.platform,
        },
        options
      );

      if (result.success) {
        imported++;
      } else {
        failed++;
        errors.push({ url, error: result.error });
      }
    } catch (error) {
      failed++;
      errors.push({ url, error: error.message });
    }

    // Update progress
    const progress = 5 + Math.floor((i + 1) / total * 95);
    job.progress(progress);

    // Rate limiting
    await delay(800);
  }

  return {
    total,
    imported,
    failed,
    errors,
  };
});

// Event handlers
importQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result);
});

importQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}