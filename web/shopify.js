import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-01";

const HOST = process.env.HOST || "http://localhost:3000";
const hostName = HOST.replace(/https?:\/\//, "").replace(/\/$/, "");

console.log("=== Shopify Config ===");
console.log("HOST:", HOST);
console.log("hostName:", hostName);
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "SET" : "NOT SET");
console.log("====================");

// MongoDB Session Storage - Yeh state persist karega!
let sessionStorage;

try {
  sessionStorage = new MongoDBSessionStorage(
    process.env.MONGODB_URI,
    "product-importer"
  );
  console.log("✅ MongoDB Session Storage initialized");
} catch (error) {
  console.error("❌ MongoDB Session Storage failed:", error.message);
  // Fallback to simple storage
  sessionStorage = {
    sessions: new Map(),
    async storeSession(session) {
      this.sessions.set(session.id, session);
      return true;
    },
    async loadSession(id) {
      return this.sessions.get(id);
    },
    async deleteSession(id) {
      this.sessions.delete(id);
      return true;
    },
    async deleteSessions(ids) {
      ids.forEach(id => this.sessions.delete(id));
      return true;
    },
    async findSessionsByShop(shop) {
      return [...this.sessions.values()].filter(s => s.shop === shop);
    }
  };
}

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