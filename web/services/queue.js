// import { Queue, Worker } from 'bullmq';
// import Importer from './importer.js';
// import Scraper from '../services/scraper/index.js';

// const connection = {
//   // Use 127.0.0.1 instead of localhost to avoid IPv6 issues
//   host: process.env.REDIS_HOST || '127.0.0.1',
//   port: process.env.REDIS_PORT || 6379,
//   retryStrategy: (times) => {
//     console.log(`Redis connection attempt ${times}`);
//     return Math.min(times * 1000, 5000);
//   }
// };

// // Verify Redis connection
// (async () => {
//   try {
//     const testQueue = new Queue('connection-test', { connection });
//     await testQueue.waitUntilReady();  // Correct method for connection check
//     console.log('✅ Redis connection established');
//     await testQueue.close();
//   } catch (error) {
//     console.error('❌ Redis connection failed:', error.message);
//     console.log('Please ensure Redis is running and check these settings:');
//     console.log('- REDIS_HOST:', process.env.REDIS_HOST || '127.0.0.1 (default)');
//     console.log('- REDIS_PORT:', process.env.REDIS_PORT || '6379 (default)');
//     console.log('\nFor Windows users:');
//     console.log('1. Install Redis via WSL or Docker');
//     console.log('2. Alternatively use a cloud Redis service');
//     console.log('3. Ensure Redis server is running before starting the app');
//     process.exit(1);
//   }
// })();

// // Export the queue for adding jobs
// export const importQueue = new Queue('import-queue', { connection });

// // Create worker for bulk imports
// const bulkImportWorker = new Worker('import-queue', async (job) => {
//   if (job.name === 'bulk-import') {
//     const { urls, options, shop, accessToken } = job.data;
//     const importer = new Importer();
    
//     const session = {
//       shop: shop,
//       accessToken: accessToken
//     };

//     return await importer.bulkImport(session, urls.map(url => ({ source_url: url })), options);
//   }
// }, { connection });

// // Create worker for collection imports
// const collectionImportWorker = new Worker('import-queue', async (job) => {
//   if (job.name === 'collection-import') {
//     const { url, limit, options, shop, accessToken } = job.data;
//     const importer = new Importer();
//     const scraper = new Scraper();
    
//     const session = {
//       shop: shop,
//       accessToken: accessToken
//     };

//     // 1. Scrape collection
//     const scrapeResult = await scraper.scrapeCollection(url, limit);
    
//     if (!scrapeResult.success) {
//       throw new Error(`Collection scrape failed: ${scrapeResult.error}`);
//     }

//     // 2. Import all products
//     const results = await importer.bulkImport(
//       session, 
//       scrapeResult.products.map(p => ({
//         ...p,
//         source_platform: scrapeResult.platform
//       })), 
//       options
//     );

//     return {
//       ...results,
//       collectionUrl: url
//     };
//   }
// }, { connection });

// // Handle worker errors
// bulkImportWorker.on('failed', (job, err) => {
//   console.error(`Bulk import job ${job.id} failed:`, err);
// });

// collectionImportWorker.on('failed', (job, err) => {
//   console.error(`Collection import job ${job.id} failed:`, err);
// });
