import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    index: true,
  },
  
  // Shopify Product Info
  shopify_product_id: {
    type: String,
    required: true,
  },
  shopify_handle: String,
  
  // Source Info
  source_url: String,
  source_platform: String,
  source_product_id: String,
  
  // Product Data
  title: String,
  vendor: String,
  product_type: String,
  
  // Sync Info
  last_synced: Date,
  auto_sync: { type: Boolean, default: false },
  sync_interval: { type: Number, default: 24 }, // hours
  
  // Price Info (for tracking)
  original_price: Number,
  imported_price: Number,
  current_price: Number,
  
}, {
  timestamps: true,
});

// Indexes
productSchema.index({ shop: 1, shopify_product_id: 1 }, { unique: true });
productSchema.index({ shop: 1, source_url: 1 });

export default mongoose.model("Product", productSchema);