import { Temporal } from "@js-temporal/polyfill";
import { pricingToForm, pricingPayload } from "./eventPricing.js";

export const emptyEventForm = {
  title: "", description: "", location: "", date: "", time: "",
  category: "",
  pricing_mode: "unspecified", price: "", currency: "GBP",
  start_date: "", start_time: "", start_offset: "",
  end_date: "", end_time: "", end_offset: "", timezone: "Europe/London",
  deadline_local: "", deadline_offset: "",
};

export function localTimeChoices(date, time, timezone) {
  if (!date || !time || !timezone) return { options: [], error: "" };
  try {
    const local = Temporal.PlainDateTime.from(`${date}T${time}`, { overflow: "reject" });
    const earlier = local.toZonedDateTime(timezone, { disambiguation: "earlier" });
    const later = local.toZonedDateTime(timezone, { disambiguation: "later" });
    if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
      return { options: [], error: "This time does not exist because the clocks go forward. Choose another time." };
    }
    const choices = earlier.epochNanoseconds === later.epochNanoseconds ? [earlier] : [earlier, later];
    return {
      options: choices.map((value, index) => ({
        offset: value.offset, instant: value.toInstant().toString(),
        label: `${index === 0 ? "First" : "Second"} occurrence (UTC${value.offset})`,
      })),
      error: "",
    };
  } catch {
    return { options: [], error: "Choose a valid date, time and event time zone." };
  }
}

function selectedTime(date, time, timezone, offset, label) {
  const { options, error } = localTimeChoices(date, time, timezone);
  if (error) throw new Error(`${label}: ${error}`);
  if (!options.length) throw new Error(`Please provide the ${label.toLowerCase()} date and time.`);
  const selected = offset ? options.find(option => option.offset === offset)
    : options.length === 1 ? options[0] : null;
  if (!selected) throw new Error(`${label}: choose which occurrence of this repeated time you mean.`);
  return selected;
}

const locationToForm = event => ({ ...Object.fromEntries(["address", "city", "postcode", "country"].map(field => [field, event[field] ?? ""])),
  ...(Object.hasOwn(event,"latitude") ? {latitude:event.latitude,longitude:event.longitude,place_label:event.place_label} : {}) });

export function eventToForm(event) {
  if (!event.start_date) {
    return { ...emptyEventForm, ...pricingToForm(event), ...locationToForm(event), capacity: event.capacity ?? "", title: event.title ?? "", description: event.description ?? "",
      location: event.location ?? "", category: event.category ?? "", date: String(event.date ?? "").slice(0, 10), time: event.time ?? "" };
  }
  const deadline = event.registration_deadline
    ? Temporal.Instant.from(event.registration_deadline).toZonedDateTimeISO(event.timezone) : null;
  return { ...emptyEventForm, ...pricingToForm(event), ...locationToForm(event), capacity: event.capacity ?? "", title: event.title ?? "", description: event.description ?? "",
    location: event.location ?? "", category: event.category ?? "", start_date: event.start_date, start_time: event.start_time,
    start_offset: event.start_offset, end_date: event.end_date, end_time: event.end_time,
    end_offset: event.end_offset, timezone: event.timezone,
    deadline_local: deadline?.toPlainDateTime().toString({ smallestUnit: "millisecond" }) ?? "",
    deadline_offset: deadline?.offset ?? "" };
}

export function changeEventForm(previous, name, value) {
  const next = { ...previous, [name]: value };
  if (["location","address","city","postcode","country"].includes(name) && Object.hasOwn(previous,"latitude")) {
    next.latitude=null; next.longitude=null; next.place_label=null;
  }
  if (name === "timezone") {
    next.start_offset = "";
    next.end_offset = "";
    next.deadline_offset = "";
  } else if (name === "start_date" || name === "start_time") next.start_offset = "";
  else if (name === "end_date" || name === "end_time") next.end_offset = "";
  else if (name === "deadline_local") next.deadline_offset = "";
  return next;
}

export function buildEventPayload(form, multiDay, { creating = false, now = Date.now() } = {}) {
  const details = { title: form.title, description: form.description, location: form.location };
  if (!multiDay) return { ...details, date: form.date, time: form.time };
  const start = selectedTime(form.start_date, form.start_time, form.timezone, form.start_offset, "Start");
  const end = selectedTime(form.end_date, form.end_time, form.timezone, form.end_offset, "End");
  if (Temporal.Instant.compare(Temporal.Instant.from(end.instant), Temporal.Instant.from(start.instant)) <= 0) {
    throw new Error("Event end must be strictly after its start.");
  }
  const [deadlineDate, deadlineTime] = form.deadline_local.split("T");
  const deadline = form.deadline_local
    ? selectedTime(deadlineDate, deadlineTime, form.timezone, form.deadline_offset, "Registration deadline") : null;
  if (deadline && Temporal.Instant.compare(Temporal.Instant.from(deadline.instant), Temporal.Instant.from(start.instant)) > 0) {
    throw new Error("Registration deadline cannot be after the event starts.");
  }
  if (creating && Date.parse(start.instant) <= now) throw new Error("Events must start in the future.");
  if (creating && deadline && Date.parse(deadline.instant) <= now) throw new Error("Registration deadline must be in the future.");
  return { ...details, ...(Object.hasOwn(form, "capacity") ? { capacity: form.capacity === "" ? null : Number(form.capacity) } : {}), ...(Object.hasOwn(form,"latitude") ? {latitude:form.latitude,longitude:form.longitude,place_label:form.place_label} : {}), ...Object.fromEntries(["address", "city", "postcode", "country"].filter(field => Object.hasOwn(form, field)).map(field => [field, form[field].trim() || null])), ...pricingPayload(form), category: form.category || null, start_date: form.start_date, start_time: form.start_time, start_offset: start.offset,
    end_date: form.end_date, end_time: form.end_time, end_offset: end.offset,
    timezone: form.timezone, registration_deadline: deadline?.instant ?? null };
}

export function eventTimingLocks(event, now = Date.now()) {
  const started = Boolean(event?.starts_at && Date.parse(event.starts_at) <= now);
  const past = Boolean(event?.ends_at && Date.parse(event.ends_at) <= now);
  return { start: started, end: past, deadline: started, past };
}
