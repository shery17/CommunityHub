export function pricingToForm(event) {
  return { pricing_mode: event.price == null ? "unspecified" : Number(event.price) === 0 ? "free" : "paid",
    price: event.price == null ? "" : String(event.price), currency: event.currency ?? "GBP" };
}

export function pricingPayload(form) {
  if (form.pricing_mode === "unspecified") return { price: null, currency: null };
  if (form.pricing_mode === "free") return { price: "0.00", currency: form.currency };
  const price = String(form.price).trim();
  if (form.pricing_mode !== "paid" || !/^\d{1,8}(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
    throw new Error("Enter a paid price greater than zero with at most two decimal places, or choose Free.");
  }
  return { price, currency: form.currency };
}

export function formatEventPrice(event) {
  if (event.price == null) return "Price not specified";
  if (Number(event.price) === 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: event.currency, currencyDisplay: "code" }).format(Number(event.price));
}
