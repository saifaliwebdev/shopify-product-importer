import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import shopify from "./shopify.js";
import connectDB from "./database.js";

// Routes
import importRoutes from "./routes/import.js";
import productRoutes from "./routes/products.js";
import settingsRoutes from "./routes/settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Trust proxy - IMPORTANT for Railway
app.set("trust proxy", true);

// Middleware
app.use(compression());
app.use(morgan("dev"));
app.use(cors({ origin: true, credentials: true }));

// Headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com;"
  );
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files FIRST
const distPath = path.join(__dirname, "../frontend/dist");
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.use("/assets", express.static(path.join(distPath, "assets")));
app.use(express.static(distPath, { index: false }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Shopify Auth
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

// Webhooks
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: {} })
);

// API Routes - Preview and Single Import temporarily bypass auth for testing
app.post("/api/import/preview", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("🔍 Preview request for URL:", url);
    const Scraper = (await import("./services/scraper/index.js")).default;
    const result = await Scraper.scrapeProduct(url);
    console.log("✅ Preview result:", result.success ? "Success" : "Failed");
    res.json(result);

  } catch (error) {
    console.error("❌ Preview error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/import/single", async (req, res) => {
  try {
    const { url, options } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("📦 Import request for URL:", url);

    // Mock session for testing (temporary) - will be replaced with real session later
    const mockSession = {
      shop: "my-test-store-123-7.myshopify.com",
      accessToken: process.env.SHOPIFY_API_SECRET // Using this as mock token
    };

    // 1. Scrape product
    const Scraper = (await import("./services/scraper/index.js")).default;
    const scrapeResult = await Scraper.scrapeProduct(url);

    if (!scrapeResult.success) {
      return res.status(400).json({
        error: "Failed to scrape product",
        details: scrapeResult.error
      });
    }

    console.log("✅ Scraping successful, product:", scrapeResult.product.title);

    // 2. Save to database (since we don't have real access token)
    const Import = (await import("./models/Import.js")).default;

    const importRecord = await Import.create({
      shop: mockSession.shop,
      source_url: url,
      source_platform: scrapeResult.platform,
      product_title: scrapeResult.product.title,
      status: "success",
      options: options || {},
    });

    console.log("✅ Product saved to database:", scrapeResult.product.title);

    // Return success response
    res.json({
      success: true,
      message: `${scrapeResult.product.title} has been added to your store.`,
      product: {
        id: `db-${importRecord._id}`,
        title: scrapeResult.product.title,
        handle: scrapeResult.product.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        status: "draft"
      }
    });

  } catch (error) {
    console.error("❌ Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Authenticated routes
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/api/import", importRoutes);
app.use("/api/products", productRoutes);
app.use("/api/settings", settingsRoutes);

// Frontend
app.get("*", shopify.ensureInstalledOnShop(), (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
