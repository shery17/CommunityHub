import test from "node:test";
import assert from "node:assert/strict";
import { eventPricing } from "./eventPricing.js";

test("pricing distinguishes unspecified and free, normalizes decimals and defaults currency", () => {
  assert.deepEqual(eventPricing({}), { price: null, currency: null });
  assert.deepEqual(eventPricing({ price: 0 }), { price: "0.00", currency: "GBP" });
  assert.deepEqual(eventPricing({ price: " 012.5 ", currency: " eur " }), { price: "12.50", currency: "EUR" });
  assert.deepEqual(eventPricing({ price: "99999999.99", currency: "USD" }), { price: "99999999.99", currency: "USD" });
});

test("edits preserve omitted pricing and explicitly clear it", () => {
  const existing = { price: "15.99", currency: "USD" };
  assert.deepEqual(eventPricing({}, existing), existing);
  assert.deepEqual(eventPricing({ price: "20" }, existing), { price: "20.00", currency: "USD" });
  assert.deepEqual(eventPricing({ price: null }, existing), { price: null, currency: null });
});

test("pricing rejects invalid amounts, precision, currency and incomplete pairs", () => {
  for (const body of [{ price: -1 }, { price: "1.001" }, { price: "1e2" }, { price: "0x10" },
    { price: "NaN" }, { price: Infinity }, { price: "100000000" }, { price: "" }, { price: [] },
    { price: false }, { currency: "GBP" }, { price: "10", currency: null },
    { price: "10", currency: "AUD" }, { price: null, currency: "GBP" }]) {
    assert.throws(() => eventPricing(body));
  }
});
