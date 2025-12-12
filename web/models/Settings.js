import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Default Import Settings
  defaults: {
    status: { type: String, default: "draft" },
    priceMarkup: { type: Number, default: 0 },
    priceMarkupType: { type: String, default: "percentage" },
    downloadImages: { type: Boolean, default: true },
    defaultCollection: String,
    autoPublish: { type: Boolean, default: false },
  },
  
  // Naming Rules
  naming: {
    prefixTitle: String,
    suffixTitle: String,
    removeWords: [String],
    replaceVendor: String,
  },
  
  // Description Rules
  description: {
    keepOriginal: { type: Boolean, default: true },
    appendText: String,
    prependText: String,
    removeLinks: { type: Boolean, default: true },
  },
  
  // Image Settings
  images: {
    maxImages: { type: Number, default: 10 },
    compressImages: { type: Boolean, default: false },
    addWatermark: { type: Boolean, default: false },
    watermarkText: String,
  },
  
  // Inventory
  inventory: {
    defaultQuantity: { type: Number, default: 100 },
    trackInventory: { type: Boolean, default: false },
    continueSellingWhenOutOfStock: { type: Boolean, default: true },
  },
  
  // Usage Stats
  usage: {
    totalImports: { type: Number, default: 0 },
    monthlyImports: { type: Number, default: 0 },
    lastImportDate: Date,
  },
  
  // Subscription (for future)
  subscription: {
    plan: { type: String, default: "free" },
    monthlyLimit: { type: Number, default: 10 },
    expiresAt: Date,
  },
  
}, {
  timestamps: true,
});

// Get or create settings for shop
settingsSchema.statics.getForShop = async function(shop) {
  let settings = await this.findOne({ shop });
  if (!settings) {
    settings = await this.create({ shop });
  }
  return settings;
};

export default mongoose.model("Settings", settingsSchema);