import test from "node:test";
import assert from "node:assert/strict";
import { resolveEventTiming, validateNewEventTiming, validateEventTimingEdit, eventTimingStatus } from "./eventTiming.js";

const event = {
  start_date: "2027-05-10", start_time: "10:00",
  end_date: "2027-05-12", end_time: "12:00", timezone: "Europe/London",
};
const now = "2027-05-01T00:00:00Z";

test("multi-day London event resolves British Summer Time", () => {
  const timing = validateNewEventTiming(event, now);
  assert.equal(timing.starts_at, "2027-05-10T09:00:00Z");
  assert.equal(timing.ends_at, "2027-05-12T11:00:00Z");
  assert.equal(timing.registration_deadline, null);
});

test("other event zones are supported independently of server time zone", () => {
  assert.equal(resolveEventTiming({ ...event, timezone: "America/New_York" }).starts_at, "2027-05-10T14:00:00Z");
});

test("invalid dates, times, zones and reversed durations are rejected", () => {
  for (const patch of [
    { start_date: "2027-02-30" }, { start_time: "24:00" },
    { timezone: "Not/AZone" }, { timezone: "+01:00" },
    { end_date: event.start_date, end_time: event.start_time },
    { end_date: "2027-05-09" },
  ]) assert.throws(() => resolveEventTiming({ ...event, ...patch }));
});

test("DST gap is rejected even when an offset is supplied", () => {
  const gap = { ...event, start_date: "2027-03-28", start_time: "01:30" };
  assert.throws(() => resolveEventTiming(gap), /does not exist/);
  assert.throws(() => resolveEventTiming({ ...gap, start_offset: "+00:00" }), /does not exist/);
});

test("DST repetition requires a matching explicit offset", () => {
  const repeated = { ...event, start_date: "2027-10-31", start_time: "01:30", end_date: "2027-11-01" };
  assert.throws(() => resolveEventTiming(repeated), /occurs twice/);
  assert.equal(resolveEventTiming({ ...repeated, start_offset: "+01:00" }).starts_at, "2027-10-31T00:30:00Z");
  assert.equal(resolveEventTiming({ ...repeated, start_offset: "+00:00" }).starts_at, "2027-10-31T01:30:00Z");
  assert.throws(() => resolveEventTiming({ ...repeated, start_offset: "+02:00" }), /does not match/);
});

test("creation rejects starts and deadlines at or before now", () => {
  assert.throws(() => validateNewEventTiming(event, "2027-05-10T09:00:00Z"), /start in the future/);
  assert.throws(() => validateNewEventTiming({ ...event, registration_deadline: now }, now), /deadline must be in the future/);
});

test("deadline must identify an instant and may equal but not exceed start", () => {
  assert.throws(() => resolveEventTiming({ ...event, registration_deadline: "2027-05-09T12:00:00" }));
  assert.throws(() => resolveEventTiming({ ...event, registration_deadline: "2027-05-10T10:00:00Z" }), /cannot be after/);
  assert.equal(resolveEventTiming({ ...event, registration_deadline: "2027-05-10T10:00:00+01:00" }).registration_deadline, "2027-05-10T09:00:00Z");
});

test("lifecycle and registration use exact boundaries", () => {
  const timing = resolveEventTiming(event);
  assert.deepEqual(eventTimingStatus(timing, "2027-05-10T08:59:59Z"), { lifecycle: "upcoming", registration_open: true });
  assert.deepEqual(eventTimingStatus(timing, timing.starts_at), { lifecycle: "ongoing", registration_open: false });
  assert.deepEqual(eventTimingStatus(timing, timing.ends_at), { lifecycle: "past", registration_open: false });
  const earlyClose = { ...timing, registration_deadline: "2027-05-09T12:00:00Z" };
  assert.deepEqual(eventTimingStatus(earlyClose, earlyClose.registration_deadline), { lifecycle: "upcoming", registration_open: false });
});

test("upcoming edits preserve expired deadlines but cannot set a new expired one", () => {
  const existing = { ...event, registration_deadline: "2027-05-02T00:00:00Z" };
  validateEventTimingEdit({ ...existing, end_time: "13:00" }, existing, "2027-05-03T00:00:00Z");
  assert.throws(() => validateEventTimingEdit({ ...existing, registration_deadline: "2027-05-01T00:00:00Z" }, existing, "2027-05-03T00:00:00Z"), /must be in the future/);
});

test("ongoing events permit end extensions and lock the start and deadline", () => {
  const during = "2027-05-11T00:00:00Z";
  validateEventTimingEdit({ ...event, end_time: "13:00" }, event, during);
  assert.throws(() => validateEventTimingEdit({ ...event, end_time: "11:00" }, event, during), /only be extended/);
  assert.throws(() => validateEventTimingEdit({ ...event, start_time: "11:00" }, event, during), /cannot be changed/);
  assert.throws(() => validateEventTimingEdit({ ...event, registration_deadline: "2027-05-09T00:00:00Z" }, event, during), /cannot be changed/);
});

test("past event timing stays locked; unchanged timing remains valid", () => {
  const after = "2027-05-13T00:00:00Z";
  validateEventTimingEdit(event, event, after);
  assert.throws(() => validateEventTimingEdit({ ...event, end_time: "13:00" }, event, after), /cannot be changed/);
});
