// Simple image handler - just validates and returns URLs
// Cloudinary upload disabled for now

class ImageHandler {
  /**
   * Process images - validate URLs
   */
  async processImages(images) {
    const validImages = [];

    for (const image of images) {
      if (image.src && image.src.startsWith("http")) {
        validImages.push({
          src: image.src,
          alt: image.alt || "",
        });
      }
    }

    return validImages;
  }

  /**
   * Validate image URL
   */
  // async validateImage(url) {
  //   try {
  //     const response = await fetch(url, { method: "HEAD", timeout: 5000 });
  //     const contentType = response.headers.get("content-type") || "";
  //     return contentType.startsWith("image/");
  //   } catch (error) {
  //     return false;
  //   }
  // }

  async validateImage(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      method: "HEAD",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const contentType = response.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch (error) {
    console.log("Image validation failed:", url);
    return false;
  }
}
}

export default ImageHandler;