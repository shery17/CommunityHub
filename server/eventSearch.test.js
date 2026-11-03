import test from "node:test";
import assert from "node:assert/strict";
import { parseEventSearch, eventDayBounds, EventSearchError } from "./eventSearch.js";

test("search input trims strings and validates real calendar dates and limits", () => {
  assert.deepEqual(parseEventSearch({}), { q: "", location: "", date: "" });
  assert.deepEqual(parseEventSearch({ q: "  Food  ", location: " Leeds ", date: " 2028-02-29 " }),
    { q: "Food", location: "Leeds", date: "2028-02-29" });
  for (const input of [{ q: [] }, { location: {} }, { date: ["2028-05-10"] },
    { q: "x".repeat(201) }, { location: "x".repeat(256) }, { date: "2027-02-29" },
    { date: "2028-02-30" }, { date: "2028-5-1" }, { date: "0000-01-01" }]) {
    assert.throws(() => parseEventSearch(input), EventSearchError);
  }
  assert.equal(parseEventSearch({ date: "9999-12-31" }).date, "9999-12-31");
});

test("event-zone calendar days retain 23/25-hour DST boundaries", () => {
  const spring = eventDayBounds("2028-03-26", "Europe/London");
  assert.equal(spring.end - spring.start, 23 * 3600);
  const autumn = eventDayBounds("2028-10-29", "Europe/London");
  assert.equal(autumn.end - autumn.start, 25 * 3600);
});

test("repeated midnight uses its first occurrence; skipped dates have no duration", () => {
  const repeated = eventDayBounds("2028-11-05", "America/Havana");
  assert.equal(repeated.start, Date.parse("2028-11-05T04:00:00Z") / 1000);
  assert.equal(repeated.end - repeated.start, 25 * 3600);
  const skipped = eventDayBounds("2011-12-30", "Pacific/Apia");
  assert.equal(skipped.end, skipped.start);
});
