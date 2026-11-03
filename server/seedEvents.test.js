import test from "node:test";
import assert from "node:assert/strict";
import { buildSeedEvents } from "./seedEvents.js";
import { resolveEventTiming, eventTimingStatus } from "./eventTiming.js";

test("seed scenarios remain valid in winter, summer and across both London DST transitions", () => {
  for (const now of ["2027-01-15T12:34:56.789Z", "2027-07-15T12:34:56Z",
    "2027-03-27T01:30:00Z", "2027-10-30T00:30:00Z"]) {
    const events = buildSeedEvents(now);
    assert.equal(events.length, 6);
    assert.equal(new Set(events.map(event => event.title)).size, 6);
    const byTitle = new Map(events.map(event => [event.title, event]));
    const status = title => eventTimingStatus(resolveEventTiming(byTitle.get(title)), now);
    for (const title of ["Community Clean-Up", "Local Football Meetup", "Community Food Market"]) {
      assert.deepEqual(status(title), { lifecycle: "upcoming", registration_open: true });
    }
    assert.deepEqual(status("Community Arts Weekend"), { lifecycle: "ongoing", registration_open: false });
    assert.deepEqual(status("Community Gardening Workshop"), { lifecycle: "past", registration_open: false });
    assert.deepEqual(status("Volunteer Welcome Session"), { lifecycle: "upcoming", registration_open: false });
    assert.equal(byTitle.get("Community Clean-Up").registration_deadline, null);
    assert.ok(byTitle.get("Local Football Meetup").registration_deadline);
    const market = byTitle.get("Community Food Market");
    assert.ok(market.end_date > market.start_date);
    for (const event of events) {
      assert.equal(event.timezone, "Europe/London");
      assert.match(event.start_offset, /^[+-]\d{2}:\d{2}$/);
      assert.match(event.end_offset, /^[+-]\d{2}:\d{2}$/);
    }
  }
});
