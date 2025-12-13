import express from "express";
import Product from "../models/Product.js";
import shopify from "../shopify.js";

const router = express.Router();

/**
 * GET /api/products
 * Get imported products list
 */
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.find({ shop: session.shop })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({ shop: session.shop });

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/products/collections
 * Get shop collections for dropdown
 */
router.get("/collections", async (req, res) => {
  try {
    const session = res.locals.shopify.session;

    // Use REST API instead of GraphQL for better reliability
    const collections = await shopify.api.rest.CustomCollection.all({
      session: session,
      limit: 100,
    });

    // Transform to match expected format
    const formattedCollections = collections.map(collection => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      productsCount: collection.products_count || 0,
    }));

    res.json(formattedCollections);

  } catch (error) {
    console.error("Collections error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/products/:id
 * Delete imported product record
 */
router.delete("/:id", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    
    await Product.findOneAndDelete({
      _id: req.params.id,
      shop: session.shop,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
