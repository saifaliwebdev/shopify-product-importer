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

    // ✅ Apply user selections (AI vs Original)
    if (selections && options.aiOptimize) {
      console.log('🔄 Applying user selections:', selections);

      // Get AI optimized data
      const aiData = await optimizeProductSEO(productToImport);

      if (aiData && !aiData.aiError) {
        // Apply title selection
        if (selections.title === 'ai' && aiData.optimized_title) {
          productToImport.title = aiData.optimized_title;
          console.log('✅ Using AI title');
        }

        // Apply description selection
        if (selections.description === 'ai' && aiData.optimized_description) {
          productToImport.description = aiData.optimized_description;
          console.log('✅ Using AI description');
        }

        // Apply tags selection
        if (selections.tags === 'ai' && aiData.optimized_tags) {
          productToImport.tags = aiData.optimized_tags;
          console.log('✅ Using AI tags');
        }
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

// Get import history
router.get('/history', async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { page = 1, limit = 20, status } = req.query;

    const query = { shop: session.shop };

    // Filter by status if provided
    if (status) {
      const statuses = status.split(',');
      query.status = { $in: statuses };
    }

    const imports = await Import.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Import.countDocuments(query);

    res.json({
      imports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('❌ History fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;