import { Temporal } from "@js-temporal/polyfill";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pool from "./db.js";
import { resolveEventTiming } from "./eventTiming.js";
import { getEventReadModel } from "./eventReadModel.js";

export function buildSeedEvents(now = Temporal.Now.instant().toString()) {
  const instant = Temporal.Instant.from(now);
  const base = Temporal.Instant.fromEpochMilliseconds(Math.floor(instant.epochMilliseconds / 1000) * 1000);
  const at = (hours) => base.add({ hours });
  const definitions = [
    {
      title: "Community Clean-Up",
      description: "Join local residents to help clean up our neighbourhood and make our community a better place.",
      location: "Leeds City Centre", category: "Volunteering", startHours: 48, endHours: 50,
      price: "0.00", currency: "GBP",
    },
    {
      title: "Local Football Meetup",
      description: "Meet local football enthusiasts for a friendly and welcoming game. All abilities are welcome.",
      location: "Roundhay Park, Leeds", category: "Sports", startHours: 72, endHours: 74, deadlineHours: 48,
      price: "5.00", currency: "GBP",
    },
    {
      title: "Community Food Market",
      description: "Discover local produce, meet independent traders and support businesses in our community.",
      location: "Leeds Kirkgate Market", category: "Social", startHours: 96, endHours: 144,
      price: "0.00", currency: "GBP",
    },
    {
      title: "Community Arts Weekend",
      description: "Explore local art and creative activities at this community exhibition.",
      location: "Leeds Community Centre", category: "Arts & Culture", startHours: -24, endHours: 24,
      price: "12.50", currency: "GBP",
    },
    {
      title: "Community Gardening Workshop",
      description: "A past workshop on growing food and caring for shared community gardens.",
      location: "Leeds Community Garden", category: "Education", startHours: -72, endHours: -70,
      price: "8.00", currency: "GBP",
    },
    {
      title: "Volunteer Welcome Session",
      description: "Meet local volunteer organisers. Advance registration for this session has closed.",
      location: "Leeds Community Centre", category: "Volunteering", startHours: 168, endHours: 170, deadlineHours: -1,
      price: "0.00", currency: "GBP",
    },
  ];

  return definitions.map(({ startHours, endHours, deadlineHours, ...details }) => {
    const start = at(startHours).toZonedDateTimeISO("Europe/London");
    const end = at(endHours).toZonedDateTimeISO("Europe/London");
    const event = {
      ...details,
      start_date: start.toPlainDate().toString(),
      start_time: start.toPlainTime().toString({ smallestUnit: "second" }),
      start_offset: start.offset,
      end_date: end.toPlainDate().toString(),
      end_time: end.toPlainTime().toString({ smallestUnit: "second" }),
      end_offset: end.offset,
      timezone: "Europe/London",
      registration_deadline: deadlineHours === undefined ? null : at(deadlineHours).toString(),
    };
    // Historical and closed-registration fixtures intentionally bypass the
    // future-only creation rule, but must still have valid timing and offsets.
    resolveEventTiming(event);
    return event;
  });
}

export const seedOrganiserEmail = "sample-organiser@communityhub.invalid";

export async function ensureSeedOrganiser(db) {
  await db.query("INSERT INTO users (name, email) VALUES ('CommunityHub Demo', $1) ON CONFLICT (email) DO NOTHING", [seedOrganiserEmail]);
  const { rows } = await db.query(
    "SELECT id FROM users WHERE email = $1 AND password_hash IS NULL AND google_subject IS NULL AND email_verified_at IS NULL",
    [seedOrganiserEmail]
  );
  if (!rows.length) throw new Error("The reserved sample organiser account has unexpected credentials.");
  return rows[0].id;
}

export async function seedEvents(db = pool, now = Temporal.Now.instant().toString()) {
  const events = buildSeedEvents(now);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const model = await getEventReadModel(client);
    if (!model.multiDay) {
      throw new Error("Seed events require the multi-day event schema. No data was changed; do not reset the database until the transition is ready.");
    }
    if (!model.hasCategory) throw new Error("Run npm run add-event-categories before seeding events.");
    if (!model.hasPricing) throw new Error("Run npm run add-event-pricing before seeding events.");
    // Serialize seed runs so the existence check also prevents concurrent rerun
    // duplicates. No sample events, users or registrations are overwritten.
    await client.query("SELECT pg_advisory_xact_lock(742018, 1)");
    const organiserId = await ensureSeedOrganiser(client);
    let inserted = 0;
    for (const event of events) {
      const result = await client.query(
        `INSERT INTO events (title, description, location, start_date, start_time,
           start_offset, end_date, end_time, end_offset, timezone, registration_deadline, category, price, currency, created_by)
         SELECT $1::text, $2::text, $3::text, $4::date, $5::time, $6::text,
           $7::date, $8::time, $9::text, $10::text, $11::timestamptz, $12::text, $13::numeric, $14::text, $15::integer
         WHERE NOT EXISTS (
           SELECT 1 FROM events WHERE title = $1 AND description = $2
             AND location = $3 AND (created_by = $15 OR created_by IS NULL)
         ) RETURNING id`,
        [event.title, event.description, event.location, event.start_date, event.start_time,
          event.start_offset, event.end_date, event.end_time, event.end_offset,
          event.timezone, event.registration_deadline, event.category, event.price, event.currency, organiserId]
      );
      inserted += result.rowCount;
    }
    await client.query("COMMIT");
    return { inserted, skipped: events.length - inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await seedEvents();
    console.log(`Sample events: ${result.inserted} inserted, ${result.skipped} already present.`);
  } catch (error) {
    console.error("Error inserting sample events:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
