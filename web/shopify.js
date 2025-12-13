import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04";

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
  console.error("❌ MongoDB Session Storage initialization failed:", error.message);
  console.log("⚠️  Falling back to in-memory session storage");

  // Fallback to simple storage
  sessionStorage = {
    sessions: new Map(),
    async storeSession(session) {
      console.log(`📝 Storing session in memory: ${session.id}`);
      this.sessions.set(session.id, session);
      return true;
    },
    async loadSession(id) {
      const session = this.sessions.get(id);
      console.log(`📖 Loading session from memory: ${id} - ${session ? 'found' : 'not found'}`);
      return session;
    },
    async deleteSession(id) {
      console.log(`🗑️  Deleting session from memory: ${id}`);
      this.sessions.delete(id);
      return true;
    },
    async deleteSessions(ids) {
      ids.forEach(id => {
        console.log(`🗑️  Deleting session from memory: ${id}`);
        this.sessions.delete(id);
      });
      return true;
    },
    async findSessionsByShop(shop) {
      const sessions = [...this.sessions.values()].filter(s => s.shop === shop);
      console.log(`🔍 Found ${sessions.length} sessions for shop: ${shop}`);
      return sessions;
    }
  };
}

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-04",
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
