import express from 'express';
import ProductImporter from '../services/importer.js';
import scraper from '../services/scraper/index.js'; // FIXED: Default import
import { optimizeProductSEO } from '../services/aiOptimizer.js';
import Import from '../models/Import.js';

const router = express.Router();

// Preview endpoint
router.post('/preview', async (req, res) => {
  try {
    const { url } = req.body;

    // Scrape product data using the default exported instance
    const scrapeResult = await scraper.scrapeProduct(url);

    if (!scrapeResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: scrapeResult.error || "Failed to scrape product" 
      });
    }

    const originalProduct = scrapeResult.product;

    // Get AI optimized version
    let aiData = null;
    try {
      // AI ko original product data bhej rahe hain
      aiData = await optimizeProductSEO(originalProduct);
    } catch (aiError) {
      console.error('AI optimization failed gracefully:', aiError.message);
    }

    // Response structure for Frontend
    res.json({
      success: true,
      product: originalProduct, // Yeh images aur variants ke liye hai
      original: originalProduct, // Yeh comparison ke liye hai
      aiOptimized: aiData?.aiOptimized ? aiData : null
    });

  } catch (error) {
    console.error('Preview error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// Import endpoint
router.post('/single', async (req, res) => {
  try {
    const { url, options, selections } = req.body;
    const session = res.locals.shopify.session; // Shopify app session

    // Pehle product ko phir se scrape karein ya frontend se data lein
    const scrapeResult = await scraper.scrapeProduct(url);
    if (!scrapeResult.success) throw new Error("Could not fetch product for import");

    let productToImport = scrapeResult.product;

    // Agar AI selections hain to wo apply karein
    if (selections) {
      // Note: Backend logic ke mutabiq optimizeProductSEO pehle hi ho chuka hoga preview mein
      // Lekin safety ke liye yahan check kar sakte hain
    }

    const importer = new ProductImporter();
    const result = await importer.importProduct(session, productToImport, options);

    res.json(result);

  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

export default router;