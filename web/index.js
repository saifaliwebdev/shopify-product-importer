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

// API Routes
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