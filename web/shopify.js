import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";

const isDev = process.env.NODE_ENV === "development";

// Memory Session Storage (for testing)
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
    hostName: process.env.HOST?.replace(/https?:\/\//, "") || "localhost:3000",
    hostScheme: isDev ? "http" : "https",
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
