import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Scraper from "../services/scraper/index.js";
import Importer from "../services/importer.js";
import { importQueue } from "../services/queue.js";
import Import from "../models/Import.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/import/single
 * Import single product from URL
 */
router.post("/single", async (req, res) => {
  try {
    const { url, options } = req.body;
    const session = res.locals.shopify.session;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("📦 Import request for URL:", url, "Shop:", session.shop);

    // 1. Scrape product
    const scrapeResult = await Scraper.scrapeProduct(url);

    if (!scrapeResult.success) {
      return res.status(400).json({
        error: "Failed to scrape product",
        details: scrapeResult.error
      });
    }

    console.log("✅ Scraping successful, product:", scrapeResult.product.title);

    // 2. Import to Shopify store
    const importResult = await Importer.importProduct(
      session,
      {
        ...scrapeResult.product,
        source_platform: scrapeResult.platform,
      },
      options || {}
    );

    if (!importResult.success) {
      return res.status(500).json({
        error: "Failed to import to Shopify",
        details: importResult.error
      });
    }

    console.log("✅ Import to Shopify successful");
    res.json(importResult);

  } catch (error) {
    console.error("❌ Import error:", error);

    // Fallback: save to database even if Shopify API fails
    try {
      const Import = (await import("../models/Import.js")).default;
      const session = res.locals.shopify.session;

      await Import.create({
        shop: session?.shop || "unknown",
        source_url: req.body.url,
        source_platform: "unknown",
        product_title: "Import failed - check logs",
        status: "failed",
        error: error.message,
        options: req.body.options || {},
      });

      console.log("📝 Import failure logged to database");
    } catch (dbError) {
      console.error("❌ Database logging failed:", dbError);
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/preview
 * Preview product before import (scrape only)
 */
router.post("/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("🔍 Preview request for URL:", url);
    const result = await Scraper.scrapeProduct(url);
    console.log("✅ Preview result:", result.success ? "Success" : "Failed");
    res.json(result);

  } catch (error) {
    console.error("❌ Preview error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/collection
 * Import entire collection
 */
router.post("/collection", async (req, res) => {
  try {
    const { url, limit = 50, options } = req.body;
    const session = res.locals.shopify.session;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Add to queue for background processing
    const job = await importQueue.add("collection-import", {
      url,
      limit,
      options,
      shop: session.shop,
      accessToken: session.accessToken,
    });

    res.json({
      success: true,
      message: "Collection import started",
      jobId: job.id,
    });

  } catch (error) {
    console.error("Collection import error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import/bulk
 * Bulk import from CSV/Excel file
 */
router.post("/bulk", upload.single("file"), async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const options = JSON.parse(req.body.options || "{}");

    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    // Parse file
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Extract URLs
    const urls = data
      .map(row => row.url || row.URL || row.link || row.Link)
      .filter(Boolean);

    if (urls.length === 0) {
      return res.status(400).json({ error: "No URLs found in file" });
    }

    // Add to queue
    const job = await importQueue.add("bulk-import", {
      urls,
      options,
      shop: session.shop,
      accessToken: session.accessToken,
    });

    res.json({
      success: true,
      message: `Bulk import started for ${urls.length} products`,
      jobId: job.id,
      totalUrls: urls.length,
    });

  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/import/status/:jobId
 * Get import job status
 */
router.get("/status/:jobId", async (req, res) => {
  try {
    const job = await importQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      id: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/import/history
 * Get import history
 */
router.get("/history", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const { page = 1, limit = 20, status } = req.query;

    const query = { shop: session.shop };
    if (status) query.status = status;

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
    res.status(500).json({ error: error.message });
  }
});

export default router;
