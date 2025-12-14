/**
 * Currency conversion utilities
 */

// Exchange rates (approximate, should be updated regularly)
const EXCHANGE_RATES = {
  // Base: USD
  USD: 1.0,
  EUR: 0.85,
  GBP: 0.73,
  CAD: 1.25,
  AUD: 1.35,
  JPY: 110.0,
  CHF: 0.92,
  CNY: 6.45,
  INR: 74.5,
  PKR: 278.0, // Pakistani Rupee
  BDT: 85.0,  // Bangladeshi Taka
  LKR: 200.0, // Sri Lankan Rupee
  NPR: 118.0, // Nepali Rupee
  AED: 3.67,  // UAE Dirham
  SAR: 3.75,  // Saudi Riyal
  QAR: 3.64,  // Qatari Riyal
  KWD: 0.30,  // Kuwaiti Dinar
  BHD: 0.38,  // Bahraini Dinar
  OMR: 0.38,  // Omani Rial
  JOD: 0.71,  // Jordanian Dinar
  EGP: 15.7,  // Egyptian Pound
  ZAR: 14.8,  // South African Rand
  NGN: 410.0, // Nigerian Naira
  KES: 100.0, // Kenyan Shilling
  GHS: 6.0,   // Ghanaian Cedi
  UGX: 3700,  // Ugandan Shilling
  TZS: 2300,  // Tanzanian Shilling
  RWF: 1000,  // Rwandan Franc
  ETB: 45.0,  // Ethiopian Birr
  DZD: 135.0, // Algerian Dinar
  MAD: 9.0,   // Moroccan Dirham
  TND: 3.1,   // Tunisian Dinar
  XAF: 600.0, // Central African Franc
  XOF: 600.0, // West African Franc
  CDF: 2000,  // Congolese Franc
  ZMW: 17.0,  // Zambian Kwacha
  MWK: 800.0, // Malawian Kwacha
  MZN: 63.0,  // Mozambican Metical
  ZWL: 322.0, // Zimbabwean Dollar
  BWP: 11.0,  // Botswana Pula
  NAD: 14.8,  // Namibian Dollar
  SZL: 14.8,  // Swazi Lilangeni
  LSL: 14.8,  // Lesotho Loti
  MUR: 43.0,  // Mauritian Rupee
  SCR: 13.5,  // Seychellois Rupee
  KMF: 450.0, // Comorian Franc
  DJF: 178.0, // Djiboutian Franc
  SOS: 580.0, // Somali Shilling
  SDG: 450.0, // Sudanese Pound
  SSP: 130.0, // South Sudanese Pound
  ERN: 15.0,  // Eritrean Nakfa
  YER: 250.0, // Yemeni Rial
  SYP: 1300,  // Syrian Pound
  LBP: 1500,  // Lebanese Pound
  JOD: 0.71,  // Jordanian Dinar (duplicate)
  ILS: 3.5,   // Israeli Shekel
  TRY: 8.5,   // Turkish Lira
  IRR: 42000, // Iranian Rial
  IQD: 1460,  // Iraqi Dinar
  AFN: 71.0,  // Afghan Afghani
  PKR: 278.0, // Pakistani Rupee (duplicate)
  // Add more as needed
};

/**
 * Convert price from one currency to another
 */
function convertCurrency(amount, fromCurrency, toCurrency) {
  const fromRate = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1;
  const toRate = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1;

  // Convert to USD first, then to target currency
  const usdAmount = amount / fromRate;
  const convertedAmount = usdAmount * toRate;

  return convertedAmount;
}

/**
 * Detect currency from price and context
 */
function detectCurrency(price, context = {}) {
  const priceNum = parseFloat(price);

  // High prices (> 10000) are likely PKR or other high-value currencies
  if (priceNum > 10000) {
    // Check context clues
    if (context.url?.includes('.pk') || context.vendor?.toLowerCase().includes('pakistan')) {
      return 'PKR';
    }
    if (context.url?.includes('.bd') || context.vendor?.toLowerCase().includes('bangladesh')) {
      return 'BDT';
    }
    if (context.url?.includes('.lk') || context.vendor?.toLowerCase().includes('sri lanka')) {
      return 'LKR';
    }
    if (context.url?.includes('.np') || context.vendor?.toLowerCase().includes('nepal')) {
      return 'NPR';
    }
    // Default to PKR for high prices if no context
    return 'PKR';
  }

  // Medium prices (1000-10000) could be INR, EGP, etc.
  if (priceNum > 1000) {
    if (context.url?.includes('.in') || context.vendor?.toLowerCase().includes('india')) {
      return 'INR';
    }
    if (context.url?.includes('.eg') || context.vendor?.toLowerCase().includes('egypt')) {
      return 'EGP';
    }
  }

  // Low prices are likely USD or EUR
  return 'USD';
}

/**
 * Smart price conversion for import
 */
function convertPriceForImport(price, sourceContext, targetCurrency = 'USD') {
  const detectedCurrency = detectCurrency(price, sourceContext);

  if (detectedCurrency === targetCurrency) {
    return parseFloat(price);
  }

  const convertedPrice = convertCurrency(parseFloat(price), detectedCurrency, targetCurrency);
  return convertedPrice;
}

export {
  convertCurrency,
  detectCurrency,
  convertPriceForImport,
  EXCHANGE_RATES,
};
