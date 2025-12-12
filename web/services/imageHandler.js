import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import crypto from "crypto";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class ImageHandler {
  /**
   * Process images - download and re-upload to Cloudinary
   */
  async processImages(images) {
    const processedImages = [];

    for (const image of images) {
      try {
        const processed = await this.uploadImage(image.src, image.alt);
        if (processed) {
          processedImages.push(processed);
        }
      } catch (error) {
        console.error(`Failed to process image: ${error.message}`);
        // Keep original if processing fails
        processedImages.push(image);
      }
    }

    return processedImages;
  }

  /**
   * Upload single image to Cloudinary
   */
  async uploadImage(url, alt = "") {
    try {
      // Generate unique public_id
      const hash = crypto.createHash("md5").update(url).digest("hex");
      const publicId = `product-imports/${hash}`;

      // Check if already uploaded
      try {
        const existing = await cloudinary.api.resource(publicId);
        if (existing) {
          return {
            src: existing.secure_url,
            alt,
          };
        }
      } catch (e) {
        // Not found, continue to upload
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(url, {
        public_id: publicId,
        folder: "product-imports",
        resource_type: "image",
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      });

      return {
        src: result.secure_url,
        alt,
      };

    } catch (error) {
      console.error(`Image upload error: ${error.message}`);
      return null;
    }
  }

  /**
   * Download image as base64 (alternative approach)
   */
  async downloadAsBase64(url) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const base64 = Buffer.from(response.data, "binary").toString("base64");
      const mimeType = response.headers["content-type"] || "image/jpeg";
      
      return `data:${mimeType};base64,${base64}`;

    } catch (error) {
      console.error(`Image download error: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate image URL
   */
  async validateImage(url) {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      const contentType = response.headers["content-type"] || "";
      return contentType.startsWith("image/");
    } catch (error) {
      return false;
    }
  }
}

export default ImageHandler;