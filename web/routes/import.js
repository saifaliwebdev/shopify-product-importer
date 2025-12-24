import express from 'express';
import ProductImporter from '../services/importer.js';
import { scrapeProduct } from '../services/scraper/index.js';
import { optimizeProductSEO } from '../services/aiOptimizer.js';
import Import from '../models/Import.js';

const router = express.Router();

// New preview endpoint with AI optimization
router.post('/preview', async (req, res) => {
  try {
    const { url } = req.body;
    const session = req.session;

    // Scrape product data
    const originalData = await scrapeProduct(url);

    // Get AI optimized version in parallel
    let aiData = null;
    try {
      aiData = await optimizeProductSEO(originalData);
    } catch (aiError) {
      console.error('AI optimization failed gracefully:', aiError.message);
    }

    res.json({
      success: true,
      original: originalData,
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

// Updated import endpoint to handle selections
// web/routes/import.js mein preview endpoint ko is tarah replace karein:

router.post('/preview', async (req, res) => {
  try {
    const { url, aiOptimize } = req.body; // Frontend se aiOptimize flag lein

    const scrapeResult = await scraper.scrapeProduct(url);
    if (!scrapeResult.success) {
      return res.status(400).json({ success: false, error: scrapeResult.error });
    }

    const originalProduct = scrapeResult.product;
    let aiData = null;

    // SIRF TAB AI CHALAYEIN JAB USER NAY ENABLE KIYA HO
    if (aiOptimize) {
      try {
        aiData = await optimizeProductSEO(originalProduct);
      } catch (aiError) {
        console.error('AI optimization failed:', aiError.message);
      }
    }

    res.json({
      success: true,
      product: originalProduct,
      original: originalProduct,
      aiOptimized: aiData && aiData.aiOptimized ? aiData : null
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
