import test from "node:test";
import assert from "node:assert/strict";
import { parseEventPagination } from "./eventPagination.js";
import { EventSearchError } from "./eventSearch.js";

test("pagination is opt-in and defaults to page one with twelve events", () => {
  assert.equal(parseEventPagination({}), null);
  assert.deepEqual(parseEventPagination({ page: "1" }), { page: 1, pageSize: 12, offset: 0 });
  assert.deepEqual(parseEventPagination({ page_size: "3" }), { page: 1, pageSize: 3, offset: 0 });
  assert.deepEqual(parseEventPagination({ page: "3", page_size: "24" }), { page: 3, pageSize: 24, offset: 48 });
});

test("pagination rejects ambiguous, fractional, negative and oversized inputs", () => {
  for (const input of [{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: "01" },
    { page: "1e3" }, { page: "" }, { page: ["1", "2"] }, { page: "1000001" },
    { page_size: "0" }, { page_size: "101" }, { page_size: {} }, { page_size: " 12 " }]) {
    assert.throws(() => parseEventPagination(input), EventSearchError);
  }
});
