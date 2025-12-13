import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
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

// Simple In-Memory Session Storage
class SimpleSessionStorage {
  constructor() {
    this.sessions = new Map();
  }

  async storeSession(session) {
    this.sessions.set(session.id, session);
    return true;
  }

  async loadSession(id) {
    return this.sessions.get(id);
  }

  async deleteSession(id) {
    this.sessions.delete(id);
    return true;
  }

  async deleteSessions(ids) {
    ids.forEach(id => this.sessions.delete(id));
    return true;
  }

  async findSessionsByShop(shop) {
    const results = [];
    this.sessions.forEach((session) => {
      if (session.shop === shop) {
        results.push(session);
      }
    });
    return results;
  }
}

const sessionStorage = new SimpleSessionStorage();

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