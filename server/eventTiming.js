import { Temporal } from "@js-temporal/polyfill";

// Offsets are optional except when the local clock time occurs twice.
function eventInstant(date, time, timezone, offset, label) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) {
    throw new Error(`${label} must have a valid date and time.`);
  }
  const local = Temporal.PlainDateTime.from(`${date}T${time}`, { overflow: "reject" });
  const earlier = local.toZonedDateTime(timezone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(timezone, { disambiguation: "later" });
  if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
    throw new Error(`${label} does not exist in this time zone because the clocks change.`);
  }
  if (offset !== undefined && offset !== null) {
    if (typeof offset !== "string" || !/^[+-]\d{2}:\d{2}$/.test(offset)) {
      throw new Error(`${label} offset must use the format +01:00.`);
    }
    if (earlier.offset === offset) return earlier;
    if (later.offset === offset) return later;
    throw new Error(`${label} offset does not match the event time zone.`);
  }
  if (earlier.epochNanoseconds !== later.epochNanoseconds) {
    throw new Error(`${label} occurs twice because the clocks change. Choose offset ${earlier.offset} or ${later.offset}.`);
  }
  return earlier;
}

export function resolveEventTiming(input) {
  const timezone = input.timezone;
  if (typeof timezone !== "string" || !timezone || /^[+-]/.test(timezone)) {
    throw new Error("Please provide an IANA event time zone, such as Europe/London.");
  }
  // Validate a named zone even when there is no registration deadline.
  new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
  const start = eventInstant(input.start_date, input.start_time, timezone, input.start_offset, "Start");
  const end = eventInstant(input.end_date, input.end_time, timezone, input.end_offset, "End");
  if (Temporal.Instant.compare(end.toInstant(), start.toInstant()) <= 0) {
    throw new Error("Event end must be strictly after its start.");
  }
  const rawDeadline = input.registration_deadline;
  const deadline = rawDeadline == null || rawDeadline === ""
    ? null : Temporal.Instant.from(rawDeadline);
  if (deadline && Temporal.Instant.compare(deadline, start.toInstant()) > 0) {
    throw new Error("Registration deadline cannot be after the event starts.");
  }
  return {
    starts_at: start.toInstant().toString(),
    ends_at: end.toInstant().toString(),
    start_offset: start.offset,
    end_offset: end.offset,
    registration_deadline: deadline?.toString() ?? null,
  };
}

export function eventTimingStatus(timing, now = Temporal.Now.instant().toString()) {
  const instant = Temporal.Instant.from(now);
  const start = Temporal.Instant.from(timing.starts_at);
  const end = Temporal.Instant.from(timing.ends_at);
  const close = Temporal.Instant.from(timing.registration_deadline ?? timing.starts_at);
  const lifecycle = Temporal.Instant.compare(instant, start) < 0 ? "upcoming"
    : Temporal.Instant.compare(instant, end) < 0 ? "ongoing" : "past";
  return {
    lifecycle,
    registration_open: Temporal.Instant.compare(instant, start) < 0 && Temporal.Instant.compare(instant, close) < 0,
  };
}

export function validateNewEventTiming(input, now = Temporal.Now.instant().toString()) {
  const timing = resolveEventTiming(input);
  const instant = Temporal.Instant.from(now);
  if (Temporal.Instant.compare(Temporal.Instant.from(timing.starts_at), instant) <= 0) {
    throw new Error("Events must start in the future.");
  }
  if (timing.registration_deadline && Temporal.Instant.compare(Temporal.Instant.from(timing.registration_deadline), instant) <= 0) {
    throw new Error("Registration deadline must be in the future.");
  }
  return timing;
}

// Compare resolved instants so a different string format cannot bypass locks.
export function validateEventTimingEdit(input, existing, now = Temporal.Now.instant().toString()) {
  const previous = resolveEventTiming(existing);
  const next = resolveEventTiming(input);
  const status = eventTimingStatus(previous, now);
  const startChanged = previous.starts_at !== next.starts_at || existing.timezone !== input.timezone;
  const endChanged = previous.ends_at !== next.ends_at;
  const deadlineChanged = previous.registration_deadline !== next.registration_deadline;

  if (status.lifecycle === "past") {
    if (startChanged || endChanged || deadlineChanged) {
      throw new Error("Past event timing and registration settings cannot be changed.");
    }
  } else if (status.lifecycle === "ongoing") {
    if (startChanged || deadlineChanged) {
      throw new Error("An ongoing event's start, time zone and registration deadline cannot be changed.");
    }
    if (Temporal.Instant.compare(Temporal.Instant.from(next.ends_at), Temporal.Instant.from(previous.ends_at)) < 0) {
      throw new Error("An ongoing event's end can only be extended.");
    }
  } else {
    const instant = Temporal.Instant.from(now);
    if (Temporal.Instant.compare(Temporal.Instant.from(next.starts_at), instant) <= 0) {
      throw new Error("Events must start in the future.");
    }
    // An unchanged expired deadline must not prevent unrelated edits.
    if (deadlineChanged && next.registration_deadline &&
        Temporal.Instant.compare(Temporal.Instant.from(next.registration_deadline), instant) <= 0) {
      throw new Error("A changed registration deadline must be in the future.");
    }
  }
  return next;
}
