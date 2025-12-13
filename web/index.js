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

// Initialize
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Trust proxy
app.set("trust proxy", 1);

// Middleware
app.use(compression());
app.use(morgan("dev"));

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Headers for iframe
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    `frame-ancestors https://*.myshopify.com https://admin.shopify.com;`
  );
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ========================================
// STATIC FILES - SABSE PEHLE (No Auth!)
// ========================================
const distPath = path.join(__dirname, "../frontend/dist");

// Favicon
app.get("/favicon.ico", (req, res) => {
  res.status(204).end(); // No favicon, return empty
});

// All static assets
app.use("/assets", express.static(path.join(distPath, "assets")));

// Other static files
app.use(express.static(distPath, { index: false }));

// ========================================
// HEALTH CHECK
// ========================================
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========================================
// SHOPIFY AUTH
// ========================================
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

// Webhooks
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({
    webhookHandlers: {},
  })
);

// ========================================
// API ROUTES (Protected)
// ========================================
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/api/import", importRoutes);
app.use("/api/products", productRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/session", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    res.json({ shop: session.shop, scope: session.scope });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// FRONTEND (Auth Required)
// ========================================
app.get("*", shopify.ensureInstalledOnShop(), async (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;