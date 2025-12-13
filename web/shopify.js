import "@shopify/shopify-api/adapters/node";
import { shopifyApp, MemorySessionStorage } from "@shopify/shopify-app-express";
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

// Use Memory Session Storage (Simple & Reliable)
const sessionStorage = new MemorySessionStorage();

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
    hostScheme: "https",
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