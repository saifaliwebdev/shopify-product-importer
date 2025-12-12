import express from "express";
import Settings from "../models/Settings.js";

const router = express.Router();

/**
 * GET /api/settings
 * Get shop settings
 */
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const settings = await Settings.getForShop(session.shop);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/settings
 * Update shop settings
 */
router.put("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const updates = req.body;

    const settings = await Settings.findOneAndUpdate(
      { shop: session.shop },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/settings/usage
 * Get usage stats
 */
router.get("/usage", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const settings = await Settings.getForShop(session.shop);

    res.json({
      totalImports: settings.usage.totalImports,
      monthlyImports: settings.usage.monthlyImports,
      monthlyLimit: settings.subscription.monthlyLimit,
      plan: settings.subscription.plan,
      remaining: settings.subscription.monthlyLimit - settings.usage.monthlyImports,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;