import express from 'express';
import ProductImporter from '../services/importer.js';
import scraper from '../services/scraper/index.js'; // FIXED: Default import (No more crash)
import { optimizeProductSEO } from '../services/aiOptimizer.js';
import Import from '../models/Import.js';

const router = express.Router();

// Preview endpoint (Sirf ek baar)
// web/routes/import.js ka preview route replace karein
router.post('/preview', async (req, res) => {
  try {
    const { url, aiOptimize } = req.body;
    console.log('🔍 Preview Request - URL:', url, 'AI Optimize:', aiOptimize);

    const scrapeResult = await scraper.scrapeProduct(url);

    if (!scrapeResult.success) {
      return res.status(400).json({ success: false, error: scrapeResult.error });
    }

    const originalProduct = scrapeResult.product;
    let aiData = null;

    if (aiOptimize) {
      console.log('🤖 AI Optimization requested...');
      aiData = await optimizeProductSEO(originalProduct);
      console.log('✅ AI Data received:', {
        hasOptimizedTitle: !!aiData?.optimized_title,
        hasOptimizedDesc: !!aiData?.optimized_description,
        aiError: aiData?.aiError
      });
    }

    const response = {
      success: true,
      product: originalProduct,
      original: originalProduct,
      // AI data ko sahi format mein bhej rahe hain
      aiOptimizedData: aiData && !aiData.aiError ? {
        optimized_title: aiData.optimized_title || aiData.title,
        optimized_description: aiData.optimized_description || aiData.description,
        optimized_tags: aiData.optimized_tags || aiData.tags || []
      } : null
    };

    console.log('📤 Sending response with AI data:', !!response.aiOptimizedData);
    res.json(response);

  } catch (error) {
    console.error('❌ Preview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import endpoint
router.post('/single', async (req, res) => {
  try {
    const { url, options, selections } = req.body;
    const session = res.locals.shopify.session;

    const scrapeResult = await scraper.scrapeProduct(url);
    if (!scrapeResult.success) throw new Error("Could not fetch product for import");

    let productToImport = scrapeResult.product;

    // User selections apply karne ka logic (agar frontend title/desc bheje)
    if (selections) {
      if (selections.title === 'ai' && options.aiOptimize) {
        // AI logic already applied via importer if aiOptimize is true
      }
    }

    const importer = new ProductImporter();
    const result = await importer.importProduct(session, productToImport, options);

    res.json(result);

  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;