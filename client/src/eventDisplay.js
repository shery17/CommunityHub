import { Temporal } from "@js-temporal/polyfill";

function legacyDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "long", year: "numeric",
  });
}

function legacyTime(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, hour, minute)).toLocaleTimeString("en-GB", {
    timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function formatEventInstant(value, timezone) {
  const instant = Temporal.Instant.from(value).toZonedDateTimeISO(timezone);
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
  return `${label} (UTC${instant.offset})`;
}

export function eventSchedule(event) {
  if (!event.starts_at) return {
    multiDay: false, date: legacyDate(event.date), time: legacyTime(event.time),
  };
  return {
    multiDay: true, start: formatEventInstant(event.starts_at, event.timezone),
    end: formatEventInstant(event.ends_at, event.timezone), timezone: event.timezone,
    deadline: event.registration_deadline ? formatEventInstant(event.registration_deadline, event.timezone) : null,
  };
}

export function eventCardTiming(event) {
  if (!event.starts_at) return `${legacyDate(event.date)} · ${legacyTime(event.time)}`;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.timezone, day: "numeric", month: "short", year: "numeric",
  });
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: event.timezone, hour: "numeric", minute: "2-digit", hour12: true,
  });
  const dates = date.format(start) === date.format(end) ? date.format(start) : date.formatRange(start, end);
  return `${dates} · Starts at ${time.format(start)}`;
}

export function eventRegistrationLabel(event, availability) {
  if (event.cancelled_at) return "Cancelled";
  if (!availability.registrationOpen) return "Registration closed";
  if (event.capacity != null && Number(event.attendee_count ?? 0) >= event.capacity) return "Full";
  return "Registration open";
}

export function eventAvailability(event, now = Date.now()) {
  if (!event) return { lifecycle: null, registrationOpen: false, cancellationOpen: false };
  if (!event.starts_at) {
    const started = new Date(`${String(event.date).slice(0, 10)}T${event.time}`).getTime() <= now;
    return { lifecycle: null, registrationOpen: event.registration_open !== false && !started,
      cancellationOpen: event.cancellation_open !== false };
  }
  // Only explicit backend instants are used. The clock can close controls while
  // a page stays open, but must never reopen a backend-reported closed state.
  const localLifecycle = now >= Date.parse(event.ends_at) ? "past" : now >= Date.parse(event.starts_at) ? "ongoing" : "upcoming";
  const stages = ["upcoming", "ongoing", "past"];
  const lifecycle = stages[Math.max(stages.indexOf(localLifecycle), stages.indexOf(event.lifecycle))];
  const closesAt = Math.min(Date.parse(event.starts_at), Date.parse(event.registration_closes_at ?? event.registration_deadline ?? event.starts_at));
  return { lifecycle,
    registrationOpen: !event.cancelled_at && lifecycle === "upcoming" && event.registration_open !== false && now < closesAt,
    cancellationOpen: !event.cancelled_at && lifecycle !== "past" && event.cancellation_open !== false && now < Date.parse(event.ends_at) };
}

