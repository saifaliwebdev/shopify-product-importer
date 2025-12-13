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

// Middleware
app.use(compression());
app.use(morgan("dev"));

// CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

// Allow Shopify to embed app in iframe
app.use((req, res, next) => {
  const shop = req.query.shop || req.body?.shop || '';
  if (shop) {
    res.setHeader(
      'Content-Security-Policy',
      `frame-ancestors https://${shop} https://admin.shopify.com;`
    );
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
  shopify.processWebhooks({
    webhookHandlers: {},
  })
);

// API Routes (Protected)
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/api/import", importRoutes);
app.use("/api/products", productRoutes);
app.use("/api/settings", settingsRoutes);

// Get Session Info
app.get("/api/session", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    res.json({
      shop: session.shop,
      scope: session.scope,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve Frontend
app.use(shopify.ensureInstalledOnShop());
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// SPA Fallback
app.get("*", shopify.ensureInstalledOnShop(), (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`
  🚀 Product Importer App Running!
  ================================
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || "development"}
  `);
});

export default app;