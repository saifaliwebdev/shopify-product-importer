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
router.post('/', async (req, res) => {
  try {
    const { productData, options, selections } = req.body;
    const session = req.session;

    // Apply user selections
    const finalProductData = {
      ...productData,
      title: selections?.title || productData.title,
      description: selections?.description || productData.description,
      tags: selections?.tags || productData.tags
    };

    const importer = new ProductImporter();
    const result = await importer.importProduct(session, finalProductData, options);

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
