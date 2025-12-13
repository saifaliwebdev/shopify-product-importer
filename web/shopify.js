import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";

// Get host without protocol
const HOST = process.env.HOST || "localhost:3000";
const hostName = HOST.replace(/https?:\/\//, "").replace(/\/$/, "");

console.log("=== Shopify Config ===");
console.log("HOST:", HOST);
console.log("hostName:", hostName);
console.log("API Key:", process.env.SHOPIFY_API_KEY ? "SET" : "NOT SET");
console.log("API Secret:", process.env.SHOPIFY_API_SECRET ? "SET" : "NOT SET");
console.log("====================");

// MongoDB Session Storage
const sessionStorage = new MongoDBSessionStorage(
  process.env.MONGODB_URI,
  "product-importer"
);

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-01",
    restResources,
    scopes: process.env.SCOPES?.split(",") || [
      "read_products",
      "write_products",
      "read_inventory",
      "write_inventory",
    ],
    hostName: hostName,
    hostScheme: HOST.startsWith("https") ? "https" : "http",
    isEmbeddedApp: true,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage,
});

export default shopify;