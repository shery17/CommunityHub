import test from "node:test";
import assert from "node:assert/strict";
import { emptyEventForm, buildEventPayload, eventToForm, localTimeChoices, changeEventForm, eventTimingLocks } from "../src/eventFormTiming.js";

const form = { ...emptyEventForm, title: "Market", description: "A community market", location: "Leeds",
  start_date: "2028-05-10", start_time: "10:00", end_date: "2028-05-12", end_time: "12:00" };

test("new payload contains event timing and no legacy/UI fields", () => {
  const payload = buildEventPayload(form, true, { creating: true, now: Date.parse("2028-05-01T00:00Z") });
  assert.equal(payload.start_offset, "+01:00");
  assert.equal(payload.end_offset, "+01:00");
  assert.equal(payload.registration_deadline, null);
  assert.equal(payload.timezone, "Europe/London");
  for (const key of ["date", "time", "deadline_local", "deadline_offset"]) assert.ok(!Object.hasOwn(payload, key));
});

test("deadlines resolve in the event zone and round-trip without losing precision", () => {
  const payload = buildEventPayload({ ...form, deadline_local: "2028-05-09T12:30:15.123" }, true);
  assert.equal(payload.registration_deadline, "2028-05-09T11:30:15.123Z");
  const loaded = eventToForm({ ...payload, start_time: "10:00:37", start_date: form.start_date });
  assert.equal(loaded.start_time, "10:00:37");
  assert.equal(loaded.deadline_local, "2028-05-09T12:30:15.123");
  assert.equal(buildEventPayload(loaded, true).registration_deadline, payload.registration_deadline);
  assert.equal(buildEventPayload({ ...loaded, deadline_local: "" }, true).registration_deadline, null);
});

test("a nonexistent local time is rejected and repeated times require a choice", () => {
  assert.match(localTimeChoices("2028-03-26", "01:30", "Europe/London").error, /does not exist/);
  const repeated = { ...form, start_date: "2028-10-29", start_time: "01:45",
    end_date: "2028-10-29", end_time: "01:15", end_offset: "+00:00" };
  assert.equal(localTimeChoices(repeated.start_date, repeated.start_time, repeated.timezone).options.length, 2);
  assert.throws(() => buildEventPayload(repeated, true), /choose which occurrence/);
  assert.equal(buildEventPayload({ ...repeated, start_offset: "+01:00" }, true).start_offset, "+01:00");
  assert.throws(() => buildEventPayload({ ...repeated, start_offset: "+00:00" }, true), /strictly after/);
});

test("ambiguous deadlines retain their selected occurrence when editing", () => {
  const loaded = eventToForm({ ...form, start_offset: "+00:00", end_offset: "+00:00",
    start_date: "2028-11-01", end_date: "2028-11-02", registration_deadline: "2028-10-29T01:30:00Z" });
  assert.equal(loaded.deadline_offset, "+00:00");
  assert.equal(buildEventPayload(loaded, true).registration_deadline, "2028-10-29T01:30:00Z");
  assert.throws(() => buildEventPayload({ ...loaded, deadline_offset: "" }, true), /choose which occurrence/);
});

test("changing timing clears stale offset choices", () => {
  const selected = { ...form, start_offset: "+01:00", end_offset: "+01:00", deadline_offset: "+00:00" };
  assert.equal(changeEventForm(selected, "start_time", "11:00").start_offset, "");
  assert.equal(changeEventForm(selected, "end_date", "2028-05-13").end_offset, "");
  assert.equal(changeEventForm(selected, "deadline_local", "2028-05-09T12:00").deadline_offset, "");
  const changedZone = changeEventForm(selected, "timezone", "America/New_York");
  assert.equal(changedZone.start_offset, "");
  assert.equal(changedZone.end_offset, "");
  assert.equal(changedZone.deadline_offset, "");
  assert.equal(buildEventPayload(changedZone, true).start_offset, "-04:00");
});

test("creation rejects past starts/deadlines and deadlines after start", () => {
  assert.throws(() => buildEventPayload(form, true, { creating: true, now: Date.parse("2028-05-10T09:00Z") }), /start in the future/);
  assert.throws(() => buildEventPayload({ ...form, deadline_local: "2028-05-01T12:00" }, true,
    { creating: true, now: Date.parse("2028-05-02T00:00Z") }), /deadline must be in the future/);
  assert.throws(() => buildEventPayload({ ...form, deadline_local: "2028-05-11T12:00" }, true), /cannot be after/);
  assert.equal(buildEventPayload({ ...form, deadline_local: "2028-05-10T10:00" }, true).registration_deadline, "2028-05-10T09:00:00Z");
});

test("edit locks follow exact start/end boundaries without locking legacy events", () => {
  const event = { starts_at: "2028-05-10T09:00Z", ends_at: "2028-05-12T11:00Z" };
  assert.deepEqual(eventTimingLocks(event, Date.parse("2028-05-10T08:59:59Z")), { start: false, end: false, deadline: false, past: false });
  assert.deepEqual(eventTimingLocks(event, Date.parse(event.starts_at)), { start: true, end: false, deadline: true, past: false });
  assert.deepEqual(eventTimingLocks(event, Date.parse(event.ends_at)), { start: true, end: true, deadline: true, past: true });
  assert.equal(eventTimingLocks({ date: "2020-01-01", time: "10:00" }).start, false);
});

test("legacy edit round-trip sends only the original format", () => {
  const legacy = { title: "Legacy", description: "Description", location: "Leeds", date: "2028-05-10T00:00:00.000Z", time: "10:00:35" };
  assert.deepEqual(buildEventPayload(eventToForm(legacy), false), { ...legacy, date: "2028-05-10" });
});

test("category selections round-trip and an empty selection clears the category", () => {
  const payload = buildEventPayload({ ...form, category: "Arts & Culture" }, true);
  assert.equal(payload.category, "Arts & Culture");
  assert.equal(eventToForm(payload).category, "Arts & Culture");
  assert.equal(buildEventPayload(changeEventForm(eventToForm(payload), "category", ""), true).category, null);
});
