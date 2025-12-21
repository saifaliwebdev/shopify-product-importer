import { Queue } from 'bullmq';
import Importer from './importer.js';
import Scraper from '../services/scraper/index.js';

// Real queue implementation using BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
};

export const importQueue = new Queue('import-queue', { connection });

// Process bulk imports
importQueue.process('bulk-import', async (job) => {
  const { urls, options, shop, accessToken } = job.data;
  const importer = new Importer();
  
  const session = {
    shop: shop,
    accessToken: accessToken
  };

  const results = await importer.bulkImport(session, urls.map(url => ({ source_url: url })), options);
  return results;
});

// Process collection imports
importQueue.process('collection-import', async (job) => {
  const { url, limit, options, shop, accessToken } = job.data;
  const importer = new Importer();
  const scraper = new Scraper();
  
  const session = {
    shop: shop,
    accessToken: accessToken
  };

  // 1. Scrape collection
  const scrapeResult = await scraper.scrapeCollection(url, limit);
  
  if (!scrapeResult.success) {
    throw new Error(`Collection scrape failed: ${scrapeResult.error}`);
  }

  // 2. Import all products
  const results = await importer.bulkImport(
    session, 
    scrapeResult.products.map(p => ({
      ...p,
      source_platform: scrapeResult.platform
    })), 
    options
  );

  return {
    ...results,
    collectionUrl: url
  };
});
