import { eventCoordinates, parseEventRadius } from "./eventCoordinates.js";
import { createGeocoder, GeocodingError } from "./geocoding.js";
import { eventLocation } from "./eventLocation.js";
import express from "express";
import cors from "cors";
import pool from "./db.js";
import auth from "./auth.js";
import requireAuth from "./middleware/requireAuth.js";
import { getEventReadModel } from "./eventReadModel.js";
import { EVENT_CATEGORIES } from "./eventCategories.js";
import { parseEventSearch, buildEventSearch, EventSearchError } from "./eventSearch.js";
import { parseEventPagination, paginatedEvents } from "./eventPagination.js";
import { eventPricing, PRICING_CONFIG } from "./eventPricing.js";
import {
  validateNewEventTiming,
  validateEventTimingEdit,
  eventTimingStatus,
} from "./eventTiming.js";

const app = express();
const findPlaces = createGeocoder();

app.use(cors());
app.use(express.json());
app.use("/api/auth", auth);

// Keep the existing forms working until the database and frontend transition.
function usesMultiDayTiming(body) {
  return body && ["start_date", "start_time", "start_offset", "end_date",
    "end_time", "end_offset", "timezone", "registration_deadline"]
    .some((field) => Object.hasOwn(body, field));
}

function validateEventFields(body) {
  if (body?.category !== undefined && body.category !== null && !EVENT_CATEGORIES.includes(body.category)) {
    return "Please choose a valid event category, or leave it blank.";
  }
  for (const [field, limit] of [["title", 200], ["description", null], ["location", 255]]) {
    if (typeof body?.[field] !== "string" || !body[field].trim()) {
      return "Please provide all required event fields.";
    }
    if (limit && body[field].trim().length > limit) {
      return `${field === "title" ? "Title" : "Location"} must be ${limit} characters or fewer.`;
    }
  }
  return null;
}

function eventCapacity(body, existing = null) {
  if (!Object.hasOwn(body, "capacity")) return existing;
  if (body.capacity === null) return null;
  if (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 2147483647) {
    throw new Error("Capacity must be a positive whole number or null.");
  }
  return body.capacity;
}

function eventWriteValues(body, timing) {
  return [body.title.trim(), body.description.trim(), body.start_date,
    body.start_time, timing.start_offset, body.end_date, body.end_time,
    timing.end_offset, body.timezone, timing.registration_deadline, body.location.trim()];
}

function eventWriteResponse(event, timing, attendeeCount) {
  return { ...event, start_date: String(event.start_date), end_date: String(event.end_date),
    ...timing, ...eventTimingStatus(timing),
    ...(event.cancelled_at ? { registration_open: false, cancellation_open: false } : {}), attendee_count: attendeeCount };
}

async function createMultiDayEvent(req, res) {
  const fieldError = validateEventFields(req.body);
  if (fieldError) return res.status(400).json({ message: fieldError });
  let timing;
  let pricing;
  let locationDetails;
  let coordinates;
  let capacity;
  const model = await getEventReadModel(pool);
  try {
    timing = validateNewEventTiming(req.body);
    pricing = eventPricing(req.body);
    capacity = eventCapacity(req.body);
    if (!model.hasCapacity && capacity !== null) throw new Error("Install the capacity schema update first.");
    locationDetails = eventLocation(req.body);
    coordinates = eventCoordinates(req.body);
    if (!model.hasCoordinates && coordinates.latitude !== null) throw new Error("Install the event coordinates schema update first.");
    if (!model.hasStructuredLocation && Object.values(locationDetails).some(value => value !== null)) {
      throw new Error("Location details require the structured location schema update.");
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const capacityParameter = 16 + (model.hasStructuredLocation ? 4 : 0) + (model.hasCoordinates ? 3 : 0);
  const result = await pool.query(
    `INSERT INTO events
      (title, description, start_date, start_time, start_offset,
       end_date, end_time, end_offset, timezone, registration_deadline, location, created_by, category, price, currency${model.hasStructuredLocation ? ", address, city, postcode, country" : ""}${model.hasCoordinates ? ", latitude, longitude, place_label" : ""}${model.hasCapacity ? ", capacity" : ""})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15${model.hasStructuredLocation ? ", $16, $17, $18, $19" : ""}${model.hasCoordinates ? ", $20, $21, $22" : ""}${model.hasCapacity ? `, $${capacityParameter}` : ""})
     RETURNING *, to_char(start_date, 'YYYY-MM-DD') AS start_date,
       to_char(end_date, 'YYYY-MM-DD') AS end_date`,
    [...eventWriteValues(req.body, timing), req.user.userId, req.body.category ?? null, pricing.price, pricing.currency,
      ...(model.hasStructuredLocation ? Object.values(locationDetails) : []), ...(model.hasCoordinates ? Object.values(coordinates) : []), ...(model.hasCapacity ? [capacity] : [])]
  );
  return res.status(201).json(eventWriteResponse(result.rows[0], timing, 0));
}

async function editMultiDayEvent(req, res) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT *, to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM events WHERE id = $1 FOR UPDATE`, [req.params.id]
    );
    const existing = found.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Event not found." });
    }
    if (Number(existing.created_by) !== Number(req.user.userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You can only edit events you created." });
    }
    const hasStructuredLocation = ["address", "city", "postcode", "country"].every(field => Object.hasOwn(existing, field));
    const hasCoordinates = hasStructuredLocation && ["latitude", "longitude", "place_label"].every(field => Object.hasOwn(existing, field));
    const fieldError = validateEventFields(req.body);
    let timing;
    let pricing;
    let locationDetails;
    let coordinates;
    let capacity;
    const hasCapacity = Object.hasOwn(existing, "capacity");
    try {
      if (fieldError) throw new Error(fieldError);
      pricing = eventPricing(req.body, existing);
      capacity = eventCapacity(req.body, existing.capacity ?? null);
      if (!hasCapacity && capacity !== null) throw new Error("Install the capacity schema update first.");
      locationDetails = eventLocation(req.body, existing);
      coordinates = eventCoordinates(req.body, existing);
      if (!hasCoordinates && coordinates.latitude !== null) throw new Error("Install the event coordinates schema update first.");
      if (!hasStructuredLocation && Object.values(locationDetails).some(value => value !== null)) {
        throw new Error("Location details require the structured location schema update.");
      }
      timing = validateEventTimingEdit(req.body, {
        ...existing,
        registration_deadline: existing.registration_deadline?.toISOString() ?? null,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: error.message });
    }
    const count = await client.query(
      "SELECT COUNT(*)::integer AS attendee_count FROM event_attendees WHERE event_id = $1",
      [req.params.id]
    );
    if (capacity !== null && capacity < count.rows[0].attendee_count) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Capacity cannot be lower than the current number of attendees." });
    }
    const capacityParameter = 17 + (hasStructuredLocation ? 4 : 0) + (hasCoordinates ? 3 : 0);
    const result = await client.query(
      `UPDATE events SET title = $1, description = $2,
         start_date = $3, start_time = $4, start_offset = $5,
         end_date = $6, end_time = $7, end_offset = $8,
         timezone = $9, registration_deadline = $10, location = $11, category = $14,
         price = $15, currency = $16${hasStructuredLocation ? ", address = $17, city = $18, postcode = $19, country = $20" : ""}${hasCoordinates ? ", latitude = $21, longitude = $22, place_label = $23" : ""}${hasCapacity ? `, capacity = $${capacityParameter}` : ""}
       WHERE id = $12 AND created_by = $13
       RETURNING *, to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date, 'YYYY-MM-DD') AS end_date`,
      [...eventWriteValues(req.body, timing), req.params.id, req.user.userId,
        Object.hasOwn(req.body, "category") ? req.body.category : existing.category ?? null, pricing.price, pricing.currency,
        ...(hasStructuredLocation ? Object.values(locationDetails) : []), ...(hasCoordinates ? Object.values(coordinates) : []), ...(hasCapacity ? [capacity] : [])]
    );
    await client.query("COMMIT");
    return res.json(eventWriteResponse(result.rows[0], timing, count.rows[0].attendee_count));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function registrationState(db, model, eventId, userId) {
  const result = await db.query(
    `SELECT ${model.attendanceFields}, ${model.hasCapacity ? "e.capacity" : "NULL::integer AS capacity"},
     ${model.hasEventCancellation ? "e.cancelled_at" : "NULL::timestamptz AS cancelled_at"},
     (SELECT COUNT(*)::integer FROM event_attendees WHERE event_id = e.id) AS attendee_count, EXISTS (
       SELECT 1 FROM event_attendees ea
       WHERE ea.event_id = e.id AND ea.user_id = $2
     ) AS registered FROM events e WHERE e.id = $1`, [eventId, userId]
  );
  return result.rows[0];
}

async function changeRegistration(req, res, cancel = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const model = await getEventReadModel(client);
    // Serialize attendance changes with event edits/deletion. Recheck timing in
    // the mutation itself after acquiring the lock, not just in a UI/status read.
    const locked = await client.query("SELECT id FROM events WHERE id = $1 FOR UPDATE", [req.params.id]);
    const finish = async (status, body) => {
      await client.query("COMMIT");
      return res.status(status).json(body);
    };
    if (!locked.rowCount) return await finish(404, { message: "Event not found." });
    const state = await registrationState(client, model, req.params.id, req.user.userId);
    if (state.cancelled_at) return await finish(403, { ...state, code: "EVENT_CANCELLED", message: "This event has been cancelled." });
    const closedMessage = model.multiDay
      ? "Registration is closed because its deadline or the event start has been reached."
      : "Registration is closed because this event has already started.";
    const cancellationMessage = "Registration cannot be cancelled because this event has ended.";
    if (cancel && !state.registered) {
      return await finish(404, { message: "You are not registered for this event." });
    }
    if (cancel ? !state.cancellation_open : !state.registration_open) {
      return await finish(403, { message: cancel ? cancellationMessage : closedMessage });
    }

    if (!cancel && state.registered) {
      return await finish(409, { code: "ALREADY_REGISTERED", message: "You are already registered for this event.", ...state });
    }
    if (!cancel && state.capacity !== null && state.attendee_count >= state.capacity) {
      return await finish(409, { code: "EVENT_FULL", message: "This event is full.", ...state });
    }

    const result = cancel
      ? await client.query(
        `DELETE FROM event_attendees ea USING events e
         WHERE ea.event_id = e.id AND e.id = $2 AND ea.user_id = $1
           AND (${model.cancellationOpen}) RETURNING ea.id`,
        [req.user.userId, req.params.id])
      : await client.query(
        `INSERT INTO event_attendees (user_id, event_id)
         SELECT $1, e.id FROM events e WHERE e.id = $2 AND (${model.registrationOpen})
         ON CONFLICT (user_id, event_id) DO NOTHING RETURNING id`,
        [req.user.userId, req.params.id]);
    if (!result.rowCount) {
      const latest = await registrationState(client, model, req.params.id, req.user.userId);
      if (cancel) {
        return await finish(latest.registered ? 403 : 404, {
          message: latest.registered ? cancellationMessage : "You are not registered for this event.",
        });
      }
      return await finish(latest.registration_open ? 409 : 403, {
        message: latest.registration_open ? "You are already registered for this event." : closedMessage,
      });
    }
    return await finish(cancel ? 200 : 201, {
      message: cancel ? "Registration cancelled successfully." : "Successfully registered for the event.",
      ...(await registrationState(client, model, req.params.id, req.user.userId)),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Validate that an event has a real, future date and time.
function validateEventDateTime(date, time) {
  if (
    typeof date !== "string" ||
    typeof time !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)
  ) {
    return "Please provide a valid event date and time.";
  }

  const eventDateTime = new Date(`${date}T${time}`);

  if (
    Number.isNaN(eventDateTime.getTime()) ||
    eventDateTime.getFullYear() !== Number(date.slice(0, 4)) ||
    eventDateTime.getMonth() + 1 !== Number(date.slice(5, 7)) ||
    eventDateTime.getDate() !== Number(date.slice(8, 10))
  ) {
    return "Please provide a valid event date and time.";
  }

  if (eventDateTime.getTime() <= Date.now()) {
    return "Events must be scheduled for a future date and time.";
  }

  return null;
}

// Basic API health check.
app.get("/", (req, res) => {
  res.send("CommunityHub API is running!");
});

// Test the PostgreSQL connection.
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connection works!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const textAndDate = parseEventSearch(req.query);
    const pagination = parseEventPagination(req.query);
    let origin;
    try { origin = parseEventRadius(req.query); } catch(error) { throw new EventSearchError(error.message); }
    const status = req.query.status ?? "upcoming";
    if (typeof status !== "string" || !["upcoming", "ongoing", "past", "all"].includes(status)) {
      return res.status(400).json({ message: "Status must be upcoming, ongoing, past or all." });
    }
    const model = await getEventReadModel(pool);
    if (!Object.hasOwn(model.filters, status)) {
      return res.status(400).json({ message: "Ongoing and past filters require the multi-day event schema." });
    }
    const category = req.query.category ?? "";
    const pricing = req.query.pricing ?? "all";
    if (typeof pricing !== "string" || !["all", "free", "paid"].includes(pricing)) {
      return res.status(400).json({ message: "Pricing must be all, free or paid." });
    }
    if (pricing !== "all" && !model.hasPricing) {
      return res.status(400).json({ message: "Pricing filters require the pricing schema update." });
    }
    if (typeof category !== "string" || (category && !EVENT_CATEGORIES.includes(category))) {
      return res.status(400).json({ message: "Please choose a valid event category." });
    }
    if (category && !model.hasCategory) {
      return res.status(400).json({ message: "Category filtering requires the category schema update." });
    }
    if (origin && !model.hasCoordinates) throw new EventSearchError("Distance search requires the event coordinates schema update.");
    const availability = req.query.availability ?? "all";
    if (availability !== "all" && availability !== "joinable") {
      throw new EventSearchError("Availability must be all or joinable.");
    }
    const search = await buildEventSearch(pool, model, { status, category, pricing, availability, origin, ...textAndDate });
    if (pagination) return res.json(await paginatedEvents(pool, model, search, pagination));
    const result = await pool.query(`
      SELECT ${model.fields}${search.distance ? `, ${search.distance} AS distance_miles` : ""}
      FROM events e
      ${search.join}
      WHERE ${search.where}
      ORDER BY ${model.orderBy} ASC, e.id ASC;
    `, search.values);

    res.json(result.rows);
  } catch (error) {
    if (error instanceof EventSearchError) return res.status(400).json({ message: error.message });
    console.error("Error fetching events:", error);

    res.status(500).json({
      message: "Failed to fetch events",
    });
  }
});

app.get("/api/places", async (req, res) => {
  try { res.json({ places: await findPlaces(req.query.q) }); }
  catch(error) {
    if (error instanceof GeocodingError) {
      if (error.status === 429) res.set("Retry-After","1");
      return res.status(error.status).json({message:error.message});
    }
    res.status(503).json({message:"Place lookup is temporarily unavailable."});
  }
});

// Let creation forms use the active format even when the event list is empty.
app.get("/api/events/config", async (req, res) => {
  try {
    const model = await getEventReadModel(pool);
    return res.json({ multi_day: model.multiDay, default_timezone: "Europe/London",
      categories: model.hasCategory ? EVENT_CATEGORIES : [], pricing: model.hasPricing ? PRICING_CONFIG : null, structured_location: model.hasStructuredLocation, coordinates: model.hasCoordinates, capacity: model.hasCapacity });
  } catch (error) {
    console.error("Error loading event configuration:", error);
    return res.status(500).json({ message: "Unable to load the event form. Please try again." });
  }
});

// Get an individual event.
app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        message: "Invalid event ID",
      });
    }

    const model = await getEventReadModel(pool);
    const result = await pool.query(
      `SELECT ${model.fields}
      FROM events e
      WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching event:", error);

    res.status(500).json({
      message: "Failed to fetch event",
    });
  }
});

// Edit an event (owner only).
app.put("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    if (usesMultiDayTiming(req.body)) return await editMultiDayEvent(req, res);

    const { title, description, date, time, location } = req.body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !date ||
      !time ||
      typeof location !== "string" ||
      !location.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required event fields.",
      });
    }

    // NEW: Prevent editing an event to a past date/time.
    const dateTimeError = validateEventDateTime(date, time);

    if (dateTimeError) {
      return res.status(400).json({
        message: dateTimeError,
      });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           date = $3,
           time = $4,
           location = $5
       WHERE id = $6 AND created_by = $7
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        date,
        time,
        location.trim(),
        eventId,
        req.user.userId,
      ]
    );

    if (result.rowCount === 0) {
      const event = await pool.query(
        "SELECT id FROM events WHERE id = $1",
        [eventId]
      );

      if (event.rowCount === 0) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      return res.status(403).json({
        message: "You can only edit events you created.",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating event:", error);

    if (error.code === "42703") {
      return res.status(503).json({ message: "The event format does not match the database schema. The multi-day transition is not yet complete." });
    }

    return res.status(500).json({
      message: "Failed to update event.",
    });
  }
});

// Delete an event (owner only).
app.post("/api/events/:id/cancel", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ message: "Invalid event ID." });
  }
  try {
    const model = await getEventReadModel(pool);
    if (!model.hasEventCancellation) return res.status(400).json({ message: "Event cancellation is unavailable." });
    // UPDATE takes the same row lock used by registration and withdrawal.
    const result = await pool.query(
      `UPDATE events SET cancelled_at = COALESCE(cancelled_at, clock_timestamp())
       WHERE id = $1 AND created_by = $2 RETURNING cancelled_at`,
      [id, req.user.userId]
    );
    if (!result.rowCount) {
      const found = await pool.query("SELECT 1 FROM events WHERE id = $1", [id]);
      return found.rowCount
        ? res.status(403).json({ message: "You can only cancel events you created." })
        : res.status(404).json({ message: "Event not found." });
    }
    return res.json({ cancelled_at: result.rows[0].cancelled_at, registration_open: false, cancellation_open: false });
  } catch (error) {
    console.error("Error cancelling event:", error);
    return res.status(500).json({ message: "Unable to cancel event." });
  }
});

app.delete("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    const result = await pool.query(
      `DELETE FROM events
       WHERE id = $1 AND created_by = $2
       RETURNING id`,
      [eventId, req.user.userId]
    );

    if (result.rowCount === 0) {
      const event = await pool.query(
        "SELECT id FROM events WHERE id = $1",
        [eventId]
      );

      if (event.rowCount === 0) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      return res.status(403).json({
        message: "You can only delete events you created.",
      });
    }

    return res.json({
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting event:", error);

    return res.status(500).json({
      message: "Failed to delete event.",
    });
  }
});

// Create an event (authenticated users only).
app.post("/api/events", requireAuth, async (req, res) => {
  try {
    if (usesMultiDayTiming(req.body)) return await createMultiDayEvent(req, res);

    const fieldError = validateEventFields(req.body);
    if (fieldError) return res.status(400).json({ message: fieldError });
    const { title, description, date, time, location } = req.body;

    if (
      !title?.trim() ||
      !description?.trim() ||
      !date ||
      !time ||
      !location?.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required event fields.",
      });
    }

    // NEW: Prevent creating events in the past.
    const dateTimeError = validateEventDateTime(date, time);

    if (dateTimeError) {
      return res.status(400).json({
        message: dateTimeError,
      });
    }

    const result = await pool.query(
      `INSERT INTO events
        (title, description, date, time, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        date,
        time,
        location.trim(),
        req.user.userId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating event:", error);

    if (error.code === "42703") {
      return res.status(503).json({ message: "The event format does not match the database schema. The multi-day transition is not yet complete." });
    }

    return res.status(500).json({
      message: "Failed to create event.",
    });
  }
});

// Check the authenticated user's attendance, including for past events.
app.get("/api/events/:id/attendees", requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ message: "Invalid event ID." });
  }
  try {
    const result = await pool.query(
      `SELECT e.created_by, a.id AS registration_id, a.created_at AS registered_at, u.name
       FROM events e
       LEFT JOIN event_attendees a ON a.event_id = e.id AND e.created_by = $2
       LEFT JOIN users u ON u.id = a.user_id
       WHERE e.id = $1
       ORDER BY a.created_at, a.id`,
      [id, req.user.userId]
    );
    if (!result.rowCount) return res.status(404).json({ message: "Event not found." });
    if (result.rows[0].created_by === null || Number(result.rows[0].created_by) !== Number(req.user.userId)) {
      return res.status(403).json({ message: "Only the event organiser can view attendees." });
    }
    res.set("Cache-Control", "private, no-store");
    return res.json({ attendees: result.rows.filter(row => row.registration_id !== null)
      .map(({ registration_id, name, registered_at }) => ({ registration_id, name, registered_at })) });
  } catch (error) {
    console.error("Error loading attendees:", error);
    return res.status(500).json({ message: "Unable to load attendees." });
  }
});

app.get("/api/events/:id/registration", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const model = await getEventReadModel(pool);
    const state = await registrationState(pool, model, eventId, req.user.userId);

    if (!state) {
      return res.status(404).json({ message: "Event not found." });
    }

    return res.json({ ...state, can_cancel: state.registered && state.cancellation_open });
  } catch (error) {
    console.error("Error checking registration status:", error);
    return res.status(500).json({
      message: "Failed to check registration status.",
    });
  }
});

app.post("/api/events/:id/register", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Validate the event ID.
    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    return await changeRegistration(req, res);
  } catch (error) {
    console.error("Error registering for event:", error);

    return res.status(500).json({
      message: "Failed to register for the event.",
    });
  }
});

// Get events the logged-in user has registered for.
app.get("/api/users/me/events", requireAuth, async (req, res) => {
  try {
    const model = await getEventReadModel(pool);
    const result = await pool.query(
      `SELECT ${model.fields},
         ea.created_at AS registered_at
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
       WHERE ea.user_id = $1
       ORDER BY ${model.orderBy} ASC, e.id ASC`,
      [req.user.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching registered events:", error);

    return res.status(500).json({
      message: "Failed to load your registered events.",
    });
  }
});

// Cancel an event registration.
app.delete("/api/events/:id/register", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    return await changeRegistration(req, res, true);
  } catch (error) {
    console.error("Error cancelling registration:", error);

    return res.status(500).json({
      message: "Failed to cancel registration.",
    });
  }
});

app.get("/api/users/me/created-events", requireAuth, async (req, res) => {
  try {
    const model = await getEventReadModel(pool);
    const result = await pool.query(
      `SELECT ${model.fields}
       FROM events e
       WHERE e.created_by = $1
       ORDER BY ${model.orderBy} DESC, e.id DESC`,
      [req.user.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching created events:", error);

    return res.status(500).json({
      message: "Failed to load your created events.",
    });
  }
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
