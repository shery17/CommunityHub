import { distanceSql } from "./eventCoordinates.js";
import { Temporal } from "@js-temporal/polyfill";

export class EventSearchError extends Error {}

export function parseEventSearch(query) {
  const result = {};
  for (const [name, limit] of [["q", 200], ["location", 255], ["date", 10]]) {
    const value = query[name] ?? "";
    if (typeof value !== "string" || value.trim().length > limit) {
      throw new EventSearchError(`${name === "q" ? "Keyword" : name === "location" ? "Location" : "Date"} must be a single value of ${limit} characters or fewer.`);
    }
    result[name] = value.trim();
  }
  if (result.date) {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) throw new Error();
      const day = Temporal.PlainDate.from(result.date, { overflow: "reject" });
      if (day.year < 1) throw new Error();
    } catch {
      throw new EventSearchError("Date must be a real calendar date in YYYY-MM-DD format.");
    }
  }
  return result;
}

export function eventDayBounds(date, timezone) {
  const day = Temporal.PlainDate.from(date);
  return {
    start: day.toZonedDateTime(timezone).epochMilliseconds / 1000,
    end: day.add({ days: 1 }).toZonedDateTime(timezone).epochMilliseconds / 1000,
  };
}

export async function buildEventSearch(db, model, { status, category, pricing = "all", q, location, date, origin }) {
  const values = [];
  const bind = value => { values.push(value); return `$${values.length}`; };
  const clauses = [`(${model.filters[status]})`];
  if (category) clauses.push(`e.category = ${bind(category)}`);
  if (pricing === "free") clauses.push("e.price = 0");
  if (pricing === "paid") clauses.push("e.price > 0");
  if (q) {
    const param = bind(q);
    // Literal substring search: %, _ and backslashes are not wildcard syntax.
    clauses.push(`(strpos(lower(e.title), lower(${param}::text)) > 0 OR strpos(lower(e.description), lower(${param}::text)) > 0)`);
  }
  if (location) {
    const param = bind(location);
    const fields = model.hasStructuredLocation ? ["location", "address", "city", "postcode", "country"] : ["location"];
    clauses.push(`(${fields.map(field => `strpos(lower(COALESCE(e.${field}, '')), lower(${param}::text)) > 0`).join(" OR ")})`);
  }
  let distance = null;
  if (origin && origin.radius !== "all") {
    distance = distanceSql(bind(origin.latitude), bind(origin.longitude));
    clauses.push("e.latitude IS NOT NULL AND e.longitude IS NOT NULL", `${distance} <= ${bind(Number(origin.radius))}::double precision`);
  }
  let join = "";
  if (date && !model.multiDay) clauses.push(`e.date = ${bind(date)}::date`);
  else if (date) {
    // Resolve each relevant zone's day boundary using the same Temporal policy
    // as event validation. A calendar day may last 23/25 hours, start after a
    // midnight gap, or include both occurrences of a repeated midnight.
    const zones = await db.query(`SELECT DISTINCT e.timezone FROM events e WHERE ${clauses.join(" AND ")}`, [...values]);
    const bounds = zones.rows.map(row => ({ timezone: row.timezone, ...eventDayBounds(date, row.timezone) }));
    join = `JOIN unnest(${bind(bounds.map(value => value.timezone))}::text[],
      ${bind(bounds.map(value => value.start))}::double precision[],
      ${bind(bounds.map(value => value.end))}::double precision[])
      AS search_day(timezone, start_epoch, end_epoch) ON search_day.timezone = e.timezone`;
    clauses.push(`search_day.end_epoch > search_day.start_epoch`,
      `${model.startsAt} < to_timestamp(search_day.end_epoch)`,
      `${model.endsAt} > to_timestamp(search_day.start_epoch)`);
  }
  if (origin?.radius === "all") distance = distanceSql(bind(origin.latitude), bind(origin.longitude));
  return { join, where: clauses.join(" AND "), values, distance };
}
