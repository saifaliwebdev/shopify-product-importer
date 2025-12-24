import express from 'express';
import ProductImporter from '../services/importer.js';
import scraper from '../services/scraper/index.js'; // FIXED: Default import (No more crash)
import { optimizeProductSEO } from '../services/aiOptimizer.js';
import Import from '../models/Import.js';

const router = express.Router();

// Preview endpoint (Sirf ek baar)
router.post('/preview', async (req, res) => {
  try {
    const { url, aiOptimize } = req.body; // Frontend se flag lein

    // Scrape data using the default export
    const scrapeResult = await scraper.scrapeProduct(url);

    if (!scrapeResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: scrapeResult.error || "Failed to fetch product" 
      });
    }

    const originalProduct = scrapeResult.product;
    let aiData = null;

    // SIRF TAB AI CHALAYEIN JAB USER NAY ENABLE KIYA HO
    if (aiOptimize) {
      try {
        console.log("🤖 Running AI optimization for preview...");
        aiData = await optimizeProductSEO(originalProduct);
      } catch (aiError) {
        console.error('AI optimization failed:', aiError.message);
      }
    }

    res.json({
      success: true,
      product: originalProduct, // For images and variants
      original: originalProduct, // For comparison
      aiOptimized: aiData && aiData.aiOptimized ? aiData : null
    });

  } catch (error) {
    console.error('Preview error:', error.message);
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