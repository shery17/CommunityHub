export const PRICING_CONFIG = Object.freeze({ default_currency: "GBP", currencies: Object.freeze(["GBP", "EUR", "USD"]) });
export const priceCheckSql = "price IS NULL OR (price >= 0 AND price <= 99999999.99)";
export const priceCurrencyCheckSql = "(price IS NULL AND currency IS NULL) OR (price IS NOT NULL AND currency IS NOT NULL AND currency IN ('GBP', 'EUR', 'USD'))";

export function eventPricing(body, existing = { price: null, currency: null }) {
  if (!Object.hasOwn(body, "price") && !Object.hasOwn(body, "currency")) {
    return { price: existing.price ?? null, currency: existing.currency ?? null };
  }
  if (body.price === null && (body.currency === null || body.currency === undefined)) return { price: null, currency: null };
  if (typeof body.price !== "string" && typeof body.price !== "number") {
    throw new Error("Provide a price when changing pricing, or null to leave it unspecified.");
  }
  const value = String(body.price).trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) {
    throw new Error("Price must be between 0 and 99999999.99, with at most two decimal places.");
  }
  const currency = body.currency === undefined ? existing.currency ?? "GBP"
    : typeof body.currency === "string" ? body.currency.trim().toUpperCase() : body.currency;
  if (!PRICING_CONFIG.currencies.includes(currency)) throw new Error("Choose GBP, EUR or USD as the event currency.");
  const [whole, fraction = ""] = value.split(".");
  return { price: `${Number(whole)}.${fraction.padEnd(2, "0")}`, currency };
}
