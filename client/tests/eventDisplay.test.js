import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { eventSchedule, formatEventInstant, eventAvailability } from "../src/eventDisplay.js";

const event = { title: "Community Market", description: "Local crafts and food", location: "Leeds",
  starts_at: "2028-05-10T09:00:00Z", ends_at: "2028-05-12T11:00:00Z", timezone: "Europe/London",
  registration_deadline: "2028-05-09T11:00:00Z", lifecycle: "upcoming", registration_open: true, cancellation_open: true };

test("schedules use event-local times and label UTC offsets independently of the viewer zone", () => {
  const original = process.env.TZ;
  try {
    let previous;
    for (const zone of ["America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      const schedule = eventSchedule(event);
      assert.equal(schedule.timezone, "Europe/London");
      assert.match(schedule.start, /10 May 2028.*10:00 am.*UTC\+01:00/);
      assert.match(schedule.end, /12 May 2028.*0?12:00 pm.*UTC\+01:00/);
      assert.match(schedule.deadline, /9 May 2028.*0?12:00 pm.*UTC\+01:00/);
      if (previous) assert.deepEqual(schedule, previous);
      previous = schedule;
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("repeated London clock times display distinct UTC offsets", () => {
  assert.match(formatEventInstant("2028-10-29T00:30:00Z", "Europe/London"), /1:30 am.*UTC\+01:00/);
  assert.match(formatEventInstant("2028-10-29T01:30:00Z", "Europe/London"), /1:30 am.*UTC\+00:00/);
});

test("availability closes at exact cutoffs and preserves backend closed states", () => {
  const before = Date.parse("2028-05-09T10:59:59Z");
  assert.equal(eventAvailability(event, before).registrationOpen, true);
  assert.equal(eventAvailability(event, Date.parse(event.registration_deadline)).registrationOpen, false);
  assert.deepEqual(eventAvailability(event, Date.parse(event.starts_at)), { lifecycle: "ongoing", registrationOpen: false, cancellationOpen: true });
  assert.deepEqual(eventAvailability(event, Date.parse(event.ends_at)), { lifecycle: "past", registrationOpen: false, cancellationOpen: false });
  assert.equal(eventAvailability({ ...event, registration_open: false }, before).registrationOpen, false);
  assert.equal(eventAvailability({ ...event, lifecycle: "past", cancellation_open: false }, before).cancellationOpen, false);
  assert.equal(eventAvailability({ ...event, lifecycle: "ongoing" }, before).lifecycle, "ongoing");
});

test("legacy event displays keep the original date/time and cancellation policy", () => {
  const legacy = { date: "2028-05-10T00:00:00.000Z", time: "10:30:00" };
  assert.deepEqual(eventSchedule(legacy), { multiDay: false, date: "10 May 2028", time: "10:30 am" });
  assert.deepEqual(eventAvailability({ ...legacy, registration_open: false }, Date.parse("2030-01-01")), {
    lifecycle: null, registrationOpen: false, cancellationOpen: true,
  });
});

