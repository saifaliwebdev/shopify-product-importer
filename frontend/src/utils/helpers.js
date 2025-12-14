// Format price - show without currency symbol since source stores have different currencies
export function formatPrice(amount, currency = null) {
  // If no currency specified, just format the number
  if (!currency) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch (e) {
    // Fallback for invalid currency codes
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

// Format date
export function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// Format relative time
export function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(date);
}

// Truncate text
export function truncate(text, length = 50) {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// Validate URL
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Get domain from URL
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch (_) {
    return "";
  }
}

// Detect platform from URL
export function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes("aliexpress")) return "AliExpress";
  if (urlLower.includes("amazon")) return "Amazon";
  if (urlLower.includes("myshopify")) return "Shopify";
  if (urlLower.includes("ebay")) return "eBay";
  if (urlLower.includes("etsy")) return "Etsy";
  
  return "Other";
}

// Get platform badge color
export function getPlatformColor(platform) {
  const colors = {
    AliExpress: "warning",
    Amazon: "info",
    Shopify: "success",
    eBay: "attention",
    Etsy: "critical",
    Other: "new",
  };
  return colors[platform] || "new";
}

// Get status badge color
export function getStatusColor(status) {
  const colors = {
    success: "success",
    completed: "success",
    failed: "critical",
    pending: "attention",
    processing: "info",
    partial: "warning",
  };
  return colors[status] || "new";
}
