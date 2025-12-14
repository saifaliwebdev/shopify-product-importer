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

    // Use GraphQL to get collections with proper GID format
    const client = new shopify.api.clients.Graphql({ session });
    
    const response = await client.query({
      data: `{
        collections(first: 100) {
          edges {
            node {
              id
              title
              handle
              productsCount
            }
          }
        }
      }`,
    });

    const collections = response.body?.data?.collections?.edges || [];
    
    // Transform to match expected format with GID
    const formattedCollections = collections.map(({ node }) => ({
      id: node.id, // This is already in gid://shopify/Collection/123 format
      title: node.title,
      handle: node.handle,
      productsCount: node.productsCount || 0,
    }));

    console.log("📦 Collections fetched:", formattedCollections.length);
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
