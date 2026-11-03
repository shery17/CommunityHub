import test from "node:test";
import assert from "node:assert/strict";
import { pricingToForm, pricingPayload, formatEventPrice } from "../src/eventPricing.js";
import { eventToForm, buildEventPayload } from "../src/eventFormTiming.js";

test("pricing forms retain exact decimals and currency across edit and clear", () => {
  const event = { title: "Market", description: "Example", location: "Leeds", category: null,
    start_date: "2028-05-10", start_time: "10:00", end_date: "2028-05-11", end_time: "12:00",
    timezone: "Europe/London", start_offset: "+01:00", end_offset: "+01:00", price: "12.50", currency: "EUR" };
  const form = eventToForm(event);
  assert.equal(form.pricing_mode, "paid");
  assert.equal(form.price, "12.50");
  assert.equal(buildEventPayload(form, true).currency, "EUR");
  assert.equal(buildEventPayload(form, true).price, "12.50");
  assert.deepEqual(pricingPayload({ ...form, pricing_mode: "unspecified" }), { price: null, currency: null });
  assert.deepEqual(pricingPayload({ ...form, pricing_mode: "free" }), { price: "0.00", currency: "EUR" });
});

test("free and unknown prices stay distinct and paid amounts require positive two-decimal values", () => {
  assert.equal(pricingToForm({ price: null }).pricing_mode, "unspecified");
  assert.equal(pricingToForm({ price: "0.00", currency: "GBP" }).pricing_mode, "free");
  for (const price of ["0", "-1", "1.001", "Infinity", "1e2", ""]) {
    assert.throws(() => pricingPayload({ pricing_mode: "paid", price, currency: "GBP" }));
  }
});

test("price display labels currencies and never labels an unknown price free", () => {
  assert.equal(formatEventPrice({}), "Price not specified");
  assert.equal(formatEventPrice({ price: null, currency: null }), "Price not specified");
  assert.equal(formatEventPrice({ price: "0.00", currency: "GBP" }), "Free");
  assert.match(formatEventPrice({ price: "12.50", currency: "EUR" }), /^EUR\s12\.50$/);
  assert.match(formatEventPrice({ price: "5.00", currency: "USD" }), /^USD\s5\.00$/);
});
