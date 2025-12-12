import mongoose from "mongoose";

const importSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    index: true,
  },
  source_url: {
    type: String,
    required: true,
  },
  source_platform: {
    type: String,
    enum: ["shopify", "aliexpress", "amazon", "generic", "unknown"],
    default: "unknown",
  },
  import_type: {
    type: String,
    enum: ["single", "collection", "bulk"],
    default: "single",
  },
  product_id: String,
  product_title: String,
  product_handle: String,
  
  status: {
    type: String,
    enum: ["pending", "processing", "success", "failed", "partial"],
    default: "pending",
  },
  
  error: String,
  
  options: {
    status: { type: String, default: "draft" },
    priceMarkup: { type: Number, default: 0 },
    priceMarkupType: { type: String, default: "percentage" },
    downloadImages: { type: Boolean, default: true },
    collectionId: String,
  },
  
  stats: {
    images_imported: { type: Number, default: 0 },
    variants_imported: { type: Number, default: 0 },
    total_products: { type: Number, default: 0 },
    successful_products: { type: Number, default: 0 },
    failed_products: { type: Number, default: 0 },
  },
  
  job_id: String,
  completed_at: Date,
  
}, {
  timestamps: true,
});

// Indexes
importSchema.index({ shop: 1, createdAt: -1 });
importSchema.index({ shop: 1, status: 1 });
importSchema.index({ job_id: 1 });

export default mongoose.model("Import", importSchema);