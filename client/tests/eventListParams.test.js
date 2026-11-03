import test from "node:test";
import assert from "node:assert/strict";
import { readEventListParams, changeEventListParams } from "../src/eventListParams.js";

test("shared links restore every filter and pagination value", () => {
  const params = new URLSearchParams({ q: "Food & music", location: "Leeds", date: "2028-05-11",
    category: "Arts & Culture", status: "all", page: "2", page_size: "3" });
  assert.deepEqual(readEventListParams(new URLSearchParams(params.toString())), {
    q: "Food & music", location: "Leeds", date: "2028-05-11", category: "Arts & Culture",
    pricing: "all", availability: "all", status: "all", page: "2", page_size: "3",
  });
});

test("filter/page-size changes reset page one while retaining other filters", () => {
  const original = new URLSearchParams("q=market&location=Leeds&status=all&page=4&page_size=3");
  const changed = changeEventListParams(original, { category: "Social" });
  assert.equal(changed.has("page"), false);
  assert.equal(changed.get("q"), "market");
  assert.equal(changed.get("location"), "Leeds");
  assert.equal(changed.get("category"), "Social");
  assert.equal(original.get("page"), "4");
  assert.equal(changeEventListParams(original, { page_size: "24" }).has("page"), false);
  assert.equal(changeEventListParams(original, { pricing: "paid" }).has("page"), false);
  assert.equal(readEventListParams(new URLSearchParams("pricing=paid")).pricing, "paid");
});

test("page navigation retains filters and canonical defaults stay out of the URL", () => {
  const params = new URLSearchParams("q=market&category=Social&page_size=3");
  const second = changeEventListParams(params, { page: 2 }, { resetPage: false });
  assert.equal(second.get("page"), "2");
  assert.equal(second.get("category"), "Social");
  const first = changeEventListParams(second, { page: 1, status: "upcoming" }, { resetPage: false });
  assert.equal(first.has("page"), false);
  assert.equal(first.has("status"), false);
  assert.equal(first.get("q"), "market");
});

test("malformed shared-link values reach API validation rather than being silently replaced", () => {
  const values = readEventListParams(new URLSearchParams("page=bad&page_size=101&status=unknown&date=invalid"));
  assert.equal(values.page, "bad");
  assert.equal(values.page_size, "101");
  assert.equal(values.status, "unknown");
  assert.equal(values.date, "invalid");
  assert.equal(readEventListParams(new URLSearchParams()).page_size, "12");
});
