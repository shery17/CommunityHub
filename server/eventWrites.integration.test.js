import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolveEventTiming, eventTimingStatus } from "./eventTiming.js";
import { seedEvents, buildSeedEvents } from "./seedEvents.js";
import { EVENT_CATEGORIES } from "./eventCategories.js";
import { addEventCategories } from "./addEventCategories.js";
import { PRICING_CONFIG } from "./eventPricing.js";
import { addEventPricing } from "./addEventPricing.js";
import { addEventLocations } from "./addEventLocations.js";
import { addEventCoordinates } from "./addEventCoordinates.js";

// Opt in: requires the configured development PostgreSQL connection.
// All DDL and fixtures stay in a new schema inside one rolled-back transaction.
test("event routes against PostgreSQL", { skip: process.env.RUN_DB_TESTS !== "1" }, async (t) => {
  const { default: express } = await import("express");
  const { default: jwt } = await import("jsonwebtoken");
  const { default: pool } = await import("./db.js");
  const client = await pool.connect();
  const originalListen = express.application.listen;
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalSecret = process.env.JWT_SECRET;
  let listener;
  try {
    await client.query("BEGIN");
    const schema = `event_write_test_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
    const tables = [...sql.matchAll(/CREATE TABLE \w+ \([\s\S]*?\n\);/g)];
    assert.equal(tables.length, 3);
    for (const [definition] of tables) await client.query(definition);

    // Route transactions become savepoints within the outer test transaction.
    let attendanceTestInstant = null;
    let beforeAttendanceMutation = null;
    function routeQuery(sql, values) {
      if (beforeAttendanceMutation && /^(INSERT INTO event_attendees|DELETE FROM event_attendees ea USING events e)/.test(sql)) {
        const hook = beforeAttendanceMutation;
        beforeAttendanceMutation = null;
        hook();
      }
      // Freeze only route clocks, not fixture setup, for exact-boundary tests.
      if (attendanceTestInstant) {
        sql = sql.replace(/\b(statement_timestamp|clock_timestamp)\(\)/g,
          `TIMESTAMPTZ '${attendanceTestInstant}'`);
      }
      return client.query(sql, values);
    }
    pool.query = routeQuery;
    pool.connect = async () => ({
      query: (sql, values) => routeQuery({
        BEGIN: "SAVEPOINT event_edit", COMMIT: "RELEASE SAVEPOINT event_edit",
        ROLLBACK: "ROLLBACK TO SAVEPOINT event_edit",
      }[sql] ?? sql, values),
      release() {},
    });
    express.application.listen = function () {
      listener = originalListen.call(this, 0, "127.0.0.1");
      return listener;
    };
    process.env.JWT_SECRET = randomUUID();
    await import("./server.js");
    if (!listener.listening) await new Promise(resolve => listener.once("listening", resolve));
    const base = `http://127.0.0.1:${listener.address().port}/api/events`;
    const users = (await client.query(`INSERT INTO users (name, email, password_hash)
      VALUES ('Owner', 'owner@example.invalid', 'unused'),
        ('Other', 'other@example.invalid', 'unused') RETURNING id`)).rows;
    const token = id => jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: "1m" });
    const ownerToken = token(users[0].id);
    const otherToken = token(users[1].id);
    const futureYear = new Date().getUTCFullYear() + 2;
    const payload = {
      title: " Multi-day event ", description: " Test description ", location: " Leeds ",
      start_date: `${futureYear}-05-10`, start_time: "10:00",
      end_date: `${futureYear}-05-12`, end_time: "12:00", timezone: "Europe/London",
    };
    async function request(method, path, body, auth = ownerToken) {
      const response = await fetch(path.startsWith("/api/") ? new URL(path, base) : `${base}${path}`, {
        method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    }
    let id;
    await t.test("creation requires auth and validates text, timing and zones", async () => {
      const config = await request("GET", "/config");
      assert.equal(config.status, 200);
      assert.deepEqual(config.body, { multi_day: true, default_timezone: "Europe/London", categories: EVENT_CATEGORIES, pricing: PRICING_CONFIG, structured_location: true, coordinates: true });
      assert.equal((await request("POST", "", payload, null)).status, 401);
      for (const patch of [
        { title: 123 }, { title: "x".repeat(201) }, { location: "x".repeat(256) },
        { start_date: `${futureYear}-02-30` }, { timezone: "Not/AZone" },
        { end_date: payload.start_date, end_time: payload.start_time },
        { start_date: "2020-01-01", end_date: "2020-01-02" },
        { registration_deadline: `${futureYear}-05-11T12:00:00Z` },
        { registration_deadline: "2020-01-01T00:00:00Z" },
      ]) assert.equal((await request("POST", "", { ...payload, ...patch })).status, 400, JSON.stringify(patch));
      const created = await request("POST", "", payload);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      id = created.body.id;
      assert.equal(created.body.title, "Multi-day event");
      assert.equal(created.body.start_date, payload.start_date);
      assert.equal(created.body.start_offset, "+01:00");
      assert.equal(created.body.end_offset, "+01:00");
      assert.equal(created.body.starts_at, `${futureYear}-05-10T09:00:00Z`);
      assert.equal(created.body.lifecycle, "upcoming");
      assert.equal(created.body.registration_open, true);
      assert.equal(created.body.attendee_count, 0);
      assert.equal(created.body.created_by, users[0].id);
    });

    await t.test("editing protects ownership and preserves attendance", async () => {
      assert.equal((await request("PUT", `/${id}`, payload, null)).status, 401);
      assert.equal((await request("PUT", "/abc", payload)).status, 400);
      assert.equal((await request("PUT", "/2147483647", payload)).status, 404);
      assert.equal((await request("PUT", `/${id}`, payload, otherToken)).status, 403);
      await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [id, users[1].id]);
      const edited = await request("PUT", `/${id}`, { ...payload, title: "Updated", registration_deadline: `${futureYear}-05-09T12:00:00+01:00` });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.attendee_count, 1);
      assert.equal(edited.body.registration_deadline, `${futureYear}-05-09T11:00:00Z`);
      const unchanged = await request("PUT", `/${id}`, { ...payload, registration_deadline: edited.body.registration_deadline });
      assert.equal(unchanged.status, 200, JSON.stringify(unchanged.body));
    });

    await t.test("categories validate on writes, preserve omitted values and allow clearing", async () => {
      for (const category of EVENT_CATEGORIES) {
        const created = await request("POST", "", { ...payload, category });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        assert.equal(created.body.category, category);
      }
      const edited = await request("PUT", `/${id}`, { ...payload, category: "Education" });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.category, "Education");
      assert.equal(edited.body.attendee_count, 1);
      assert.equal((await request("PUT", `/${id}`, payload)).body.category, "Education");
      assert.equal((await request("PUT", `/${id}`, { ...payload, category: "Social" }, otherToken)).status, 403);
      for (const category of ["sports", "Unknown", [], {}, 1, ""]) {
        assert.equal((await request("POST", "", { ...payload, category })).status, 400);
        assert.equal((await request("PUT", `/${id}`, { ...payload, category })).status, 400);
      }
      const cleared = await request("PUT", `/${id}`, { ...payload, category: null });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.category, null);
      await client.query("SAVEPOINT invalid_category");
      try {
        await assert.rejects(client.query("UPDATE events SET category = 'Unknown' WHERE id = $1", [id]), { code: "23514" });
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT invalid_category");
        await client.query("RELEASE SAVEPOINT invalid_category");
      }
    });

    await t.test("structured locations validate, preserve, clear and participate in paginated search", async () => {
      const created = await request("POST", "", { ...payload, address: " 12 Example Road ", city: " LocationCityFixture ", postcode: " AB1 2CD ", country: " United Kingdom " });
      assert.equal(created.status, 201);
      const eventId = created.body.id;
      assert.equal(created.body.city, "LocationCityFixture");
      await client.query("INSERT INTO event_attendees (user_id,event_id) VALUES ($1,$2)", [users[1].id,eventId]);
      const edited = await request("PUT", `/${eventId}`, payload);
      assert.equal(edited.status,200);
      assert.equal(edited.body.address,"12 Example Road");
      assert.equal(edited.body.attendee_count,1);
      for (const term of ["locationcityfixture", "EXAMPLE ROAD", "AB1 2CD", "United Kingdom"]) {
        const found=await request("GET", `?location=${encodeURIComponent(term)}&page=1&page_size=3`);
        assert.ok(found.body.events.some(event=>event.id===eventId));
      }
      assert.equal((await request("PUT", `/${eventId}`, { ...payload, city:"Changed" }, otherToken)).status,403);
      for (const bad of [{city:[]},{address:123},{postcode:true},{country:{}},{city:"x".repeat(101)},
        {address:"x".repeat(256)},{postcode:"x".repeat(33)},{country:"x".repeat(101)}]) {
        assert.equal((await request("POST", "", {...payload,...bad})).status,400);
        assert.equal((await request("PUT", `/${eventId}`, {...payload,...bad})).status,400);
      }
      const cleared=await request("PUT", `/${eventId}`, {...payload,city:null,address:"  ",postcode:null,country:null});
      assert.equal(cleared.status,200);
      assert.equal(cleared.body.city,null);
      assert.equal(cleared.body.address,null);
      assert.equal((await request("GET","?location=LocationCityFixture")).body.length,0);
      await client.query("DELETE FROM event_attendees WHERE event_id=$1",[eventId]);
    });

    await t.test("pricing writes distinguish free, paid and unknown and preserve omitted pricing", async () => {
      const free = await request("POST", "", { ...payload, price: 0 });
      assert.equal(free.status, 201);
      assert.equal(free.body.price, "0.00");
      assert.equal(free.body.currency, "GBP");
      const paid = await request("POST", "", { ...payload, price: "12.50", currency: "EUR" });
      assert.equal(paid.status, 201);
      assert.equal(paid.body.price, "12.50");
      const unknown = await request("POST", "", payload);
      assert.equal(unknown.body.price, null);
      assert.equal(unknown.body.currency, null);
      const edit = await request("PUT", `/${id}`, { ...payload, price: "9.99", currency: "USD" });
      assert.equal(edit.status, 200);
      assert.equal(edit.body.attendee_count, 1);
      assert.equal((await request("PUT", `/${id}`, payload)).body.price, "9.99");
      assert.equal((await request("PUT", `/${id}`, { ...payload, price: "10" })).body.currency, "USD");
      assert.equal((await request("PUT", `/${id}`, { ...payload, price: "10", currency: "GBP" }, otherToken)).status, 403);
      for (const pricing of [{ price: -1 }, { price: "1.001" }, { price: "1e2" }, { price: [] }, { price: false },
        { price: "100000000" }, { price: "10", currency: "AUD" }, { price: null, currency: "GBP" }, { currency: "EUR" }]) {
        assert.equal((await request("POST", "", { ...payload, ...pricing })).status, 400);
        assert.equal((await request("PUT", `/${id}`, { ...payload, ...pricing })).status, 400);
      }
      const cleared = await request("PUT", `/${id}`, { ...payload, price: null });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.price, null);
      assert.equal(cleared.body.currency, null);
      for (const clause of ["price = -1, currency = 'GBP'", "price = 'NaN'::numeric, currency = 'GBP'",
        "price = 5, currency = NULL", "price = NULL, currency = 'GBP'", "price = 5, currency = 'AUD'"]) {
        await client.query("SAVEPOINT invalid_price");
        try { await assert.rejects(client.query(`UPDATE events SET ${clause} WHERE id = $1`, [id]), { code: "23514" }); }
        finally {
          await client.query("ROLLBACK TO SAVEPOINT invalid_price");
          await client.query("RELEASE SAVEPOINT invalid_price");
        }
      }
    });

    function utcFields(delta) {
      const iso = new Date(Date.now() + delta).toISOString();
      return [iso.slice(0, 10), iso.slice(11, 19)];
    }
    await t.test("ongoing and past edits enforce timing locks", async () => {
      const day = 86400000;
      const [startDate, startTime] = utcFields(-day);
      const [endDate, endTime] = utcFields(day);
      await client.query(`UPDATE events SET start_date = $1, start_time = $2, start_offset = '+00:00',
        end_date = $3, end_time = $4, end_offset = '+00:00', timezone = 'UTC', registration_deadline = NULL WHERE id = $5`,
      [startDate, startTime, endDate, endTime, id]);
      const ongoing = { ...payload, start_date: startDate, start_time: startTime, end_date: endDate, end_time: endTime, timezone: "UTC" };
      assert.equal((await request("PUT", `/${id}`, { ...ongoing, start_date: utcFields(-2 * day)[0] })).status, 400);
      const shortened = { ...ongoing, end_date: utcFields(0)[0], end_time: utcFields(0)[1] };
      assert.equal((await request("PUT", `/${id}`, shortened)).status, 400);
      const extended = { ...ongoing, end_date: utcFields(2 * day)[0], end_time: utcFields(2 * day)[1] };
      assert.equal((await request("PUT", `/${id}`, extended)).status, 200);
      const [pastEndDate, pastEndTime] = utcFields(-day / 2);
      await client.query("UPDATE events SET end_date = $1, end_time = $2 WHERE id = $3", [pastEndDate, pastEndTime, id]);
      const past = { ...ongoing, end_date: pastEndDate, end_time: pastEndTime };
      assert.equal((await request("PUT", `/${id}`, { ...past, title: "Historical description edit" })).status, 200);
      assert.equal((await request("PUT", `/${id}`, extended)).status, 400);
    });

    await t.test("DST repeated-time choices survive storage and constraints use instants", async () => {
      const lastSunday = new Date(Date.UTC(futureYear, 9, 31));
      lastSunday.setUTCDate(31 - lastSunday.getUTCDay());
      const date = lastSunday.toISOString().slice(0, 10);
      const repeated = { ...payload, start_date: date, end_date: date, start_time: "01:45", end_time: "01:15" };
      assert.equal((await request("POST", "", repeated)).status, 400);
      const created = await request("POST", "", { ...repeated, start_offset: "+01:00", end_offset: "+00:00", registration_deadline: `${date}T00:45:00Z` });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const stored = (await client.query("SELECT start_offset, end_offset FROM events WHERE id = $1", [created.body.id])).rows[0];
      assert.deepEqual(stored, { start_offset: "+01:00", end_offset: "+00:00" });
    });

    await t.test("database rejects invalid offsets, durations and late deadlines independently of the API", async () => {
      const created = await request("POST", "", payload);
      assert.equal(created.status, 201);
      for (const clause of [
        "start_offset = '+02:00'", "end_offset = '+00:00'", "start_offset = 'bad'",
        "end_date = start_date, end_time = start_time, end_offset = start_offset",
        "registration_deadline = ((end_date + end_time - end_offset::interval) AT TIME ZONE 'UTC')",
      ]) {
        await client.query("SAVEPOINT invalid_constraint");
        try {
          await assert.rejects(client.query(`UPDATE events SET ${clause} WHERE id = $1`, [created.body.id]));
        } finally {
          await client.query("ROLLBACK TO SAVEPOINT invalid_constraint");
          await client.query("RELEASE SAVEPOINT invalid_constraint");
        }
      }
    });

    async function insertEvent(overrides = {}, ownerId = users[0].id) {
      const body = { ...payload, ...overrides };
      const timing = resolveEventTiming(body);
      return (await client.query(`INSERT INTO events
        (title, description, location, start_date, start_time, start_offset,
         end_date, end_time, end_offset, timezone, registration_deadline, created_by, category, price, currency)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [body.title, body.description, body.location, body.start_date, body.start_time,
        timing.start_offset, body.end_date, body.end_time, timing.end_offset,
        body.timezone, timing.registration_deadline, ownerId, body.category ?? null, body.price ?? null, body.currency ?? null])).rows[0].id;
    }

    let upcomingId, ongoingId, pastId, deadlineClosedId;
    await t.test("listing defaults to upcoming and supports lifecycle filters with absolute-time sorting", async () => {
      const day = 86400000;
      const [yesterday, yesterdayTime] = utcFields(-day);
      const [tomorrow, tomorrowTime] = utcFields(day);
      const [twoDaysAgo, twoDaysAgoTime] = utcFields(-2 * day);
      const [threeDaysAgo, threeDaysAgoTime] = utcFields(-3 * day);
      upcomingId = await insertEvent();
      ongoingId = await insertEvent({ timezone: "UTC", start_date: yesterday, start_time: yesterdayTime,
        end_date: tomorrow, end_time: tomorrowTime });
      pastId = await insertEvent({ timezone: "UTC", start_date: threeDaysAgo, start_time: threeDaysAgoTime,
        end_date: twoDaysAgo, end_time: twoDaysAgoTime });
      deadlineClosedId = await insertEvent({ registration_deadline: `${yesterday}T${yesterdayTime}Z` });
      const defaultList = await request("GET", "");
      assert.equal(defaultList.status, 200, JSON.stringify(defaultList.body));
      assert.ok(defaultList.body.some(event => event.id === upcomingId));
      assert.ok(defaultList.body.some(event => event.id === deadlineClosedId));
      assert.ok(defaultList.body.every(event => event.lifecycle === "upcoming"));
      for (const [status, expected] of [["ongoing", ongoingId], ["past", pastId]]) {
        const list = await request("GET", `?status=${status}`);
        assert.equal(list.status, 200, JSON.stringify(list.body));
        assert.ok(list.body.some(event => event.id === expected));
        assert.ok(list.body.every(event => event.lifecycle === status));
        assert.ok(list.body.every(event => !event.registration_open));
      }
      // Wall-clock ordering differs: 09:00 Tokyo is earlier than 08:00 New York.
      const tokyoId = await insertEvent({ timezone: "Asia/Tokyo", start_time: "09:00" });
      const newYorkId = await insertEvent({ timezone: "America/New_York", start_time: "08:00" });
      const all = await request("GET", "?status=all");
      assert.equal(all.status, 200);
      assert.ok(all.body.findIndex(event => event.id === tokyoId) < all.body.findIndex(event => event.id === newYorkId));
      assert.ok(all.body.some(event => event.id === ongoingId));
      assert.ok(all.body.some(event => event.id === pastId));
      for (let i = 1; i < all.body.length; i++) {
        assert.ok(Date.parse(all.body[i - 1].starts_at) <= Date.parse(all.body[i].starts_at));
      }
      assert.equal((await request("GET", "?status=unknown")).status, 400);
      assert.equal((await request("GET", "?status=past&status=all")).status, 400);
    });

    await t.test("details preserve event-local dates, deadlines and attendee totals across database zones", async () => {
      await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2), ($1, $3)",
        [upcomingId, users[0].id, users[1].id]);
      for (const timezone of ["America/Los_Angeles", "Asia/Tokyo"]) {
        await client.query("SELECT set_config('TimeZone', $1, true)", [timezone]);
        const detail = await request("GET", `/${upcomingId}`);
        assert.equal(detail.status, 200, JSON.stringify(detail.body));
        assert.equal(detail.body.start_date, payload.start_date);
        assert.equal(detail.body.end_date, payload.end_date);
        assert.equal(detail.body.timezone, "Europe/London");
        assert.equal(detail.body.start_offset, "+01:00");
        assert.equal(detail.body.attendee_count, 2);
        assert.equal(Date.parse(detail.body.starts_at), Date.parse(`${futureYear}-05-10T09:00:00Z`));
        assert.equal(Date.parse(detail.body.ends_at), Date.parse(`${futureYear}-05-12T11:00:00Z`));
        assert.equal(detail.body.registration_deadline, null);
        assert.equal(detail.body.registration_closes_at, detail.body.starts_at);
        assert.deepEqual({ lifecycle: detail.body.lifecycle, registration_open: detail.body.registration_open },
          eventTimingStatus(detail.body));
      }
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      const closed = await request("GET", `/${deadlineClosedId}`);
      assert.equal(closed.body.lifecycle, "upcoming");
      assert.equal(closed.body.registration_open, false);
      assert.equal(closed.body.registration_closes_at, closed.body.registration_deadline);
      assert.equal((await request("GET", `/${pastId}`)).body.lifecycle, "past");
      assert.equal((await request("GET", "/abc")).status, 400);
      assert.equal((await request("GET", "/2147483647")).status, 404);
    });

    await t.test("profile reads retain history, registration timestamps and user isolation", async () => {
      for (const eventId of [ongoingId, pastId]) {
        await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [eventId, users[1].id]);
      }
      const otherCreatedId = await insertEvent({ title: "Other organiser" }, users[1].id);
      assert.equal((await request("GET", "/api/users/me/events", undefined, null)).status, 401);
      assert.equal((await request("GET", "/api/users/me/created-events", undefined, null)).status, 401);
      const registered = await request("GET", "/api/users/me/events", undefined, otherToken);
      assert.equal(registered.status, 200, JSON.stringify(registered.body));
      assert.deepEqual(new Set(registered.body.map(event => event.id)), new Set([id, pastId, ongoingId, upcomingId]));
      for (let i = 1; i < registered.body.length; i++) {
        assert.ok(Date.parse(registered.body[i - 1].starts_at) <= Date.parse(registered.body[i].starts_at));
      }
      assert.ok(registered.body.every(event => event.registered_at));
      assert.equal(registered.body.find(event => event.id === upcomingId).attendee_count, 2);
      assert.equal(registered.body.find(event => event.id === pastId).lifecycle, "past");
      const created = await request("GET", "/api/users/me/created-events");
      assert.equal(created.status, 200);
      assert.ok(!created.body.some(event => event.id === otherCreatedId));
      assert.ok(created.body.some(event => event.id === pastId));
      assert.ok(created.body.some(event => event.id === ongoingId));
      for (let i = 1; i < created.body.length; i++) {
        assert.ok(Date.parse(created.body[i - 1].starts_at) >= Date.parse(created.body[i].starts_at));
      }
      const otherCreated = await request("GET", "/api/users/me/created-events", undefined, otherToken);
      assert.deepEqual(otherCreated.body.map(event => event.id), [otherCreatedId]);
    });

    await t.test("category filtering combines with lifecycle and handles ampersands and invalid input", async () => {
      const sportsId = await insertEvent({ category: "Sports" });
      const pastSportsId = await insertEvent({ category: "Sports", timezone: "UTC",
        start_date: "2020-01-01", start_time: "10:00", end_date: "2020-01-02", end_time: "10:00" });
      const upcoming = await request("GET", "?category=Sports");
      assert.equal(upcoming.status, 200);
      assert.ok(upcoming.body.some(event => event.id === sportsId));
      assert.ok(!upcoming.body.some(event => event.id === pastSportsId));
      assert.ok(upcoming.body.every(event => event.category === "Sports" && event.lifecycle === "upcoming"));
      const past = await request("GET", "?status=past&category=Sports");
      assert.deepEqual(past.body.map(event => event.id), [pastSportsId]);
      const arts = await request("GET", `?status=all&category=${encodeURIComponent("Arts & Culture")}`);
      assert.equal(arts.status, 200);
      assert.ok(arts.body.length > 0);
      assert.ok(arts.body.every(event => event.category === "Arts & Culture"));
      const all = await request("GET", "?status=all&category=");
      assert.ok(all.body.some(event => event.category === null));
      for (const query of ["?category=Unknown", "?category=Sports&category=Social", "?category=%27%20OR%201%3D1--"]) {
        assert.equal((await request("GET", query)).status, 400);
      }
    });

    await t.test("keyword and location search use separate literal case-insensitive predicates", async () => {
      const titleId = await insertEvent({ title: "SearchNeedle gathering", description: "A workshop", location: "Harrogate", category: "Sports" });
      const descriptionId = await insertEvent({ title: "Something different", description: "Meet for SEARCHNEEDLE activities", location: "York", category: "Education" });
      const locationOnlyId = await insertEvent({ title: "Local gathering", description: "Another workshop", location: "SearchNeedle venue" });
      const searched = await request("GET", "?status=all&q=searchneedle");
      assert.equal(searched.status, 200, JSON.stringify(searched.body));
      assert.deepEqual(new Set(searched.body.map(event => event.id)), new Set([titleId, descriptionId]));
      assert.ok(!searched.body.some(event => event.id === locationOnlyId));
      assert.deepEqual((await request("GET", "?status=all&q=SearchNeedle&location=HARROGATE&category=Sports")).body.map(event => event.id), [titleId]);
      assert.equal((await request("GET", "?status=all&q=SearchNeedle&location=York&category=Sports")).body.length, 0);
      assert.deepEqual((await request("GET", "?status=all&location=searchneedle")).body.map(event => event.id), [locationOnlyId]);
      const literalId = await insertEvent({ title: "100% Local_Fun\\Club", description: "Literal search fixture", location: "Venue_100%" });
      for (const q of ["%", "_", "\\", "100% "]) {
        const response = await request("GET", `?status=all&q=${encodeURIComponent(q)}`);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.map(event => event.id), [literalId]);
      }
      assert.deepEqual((await request("GET", `?status=all&q=${encodeURIComponent("' OR 1=1--")}`)).body, []);
    });

    await t.test("date search includes overlapping dates and excludes midnight-only endings", async () => {
      const base = { title: "DateOverlapFixture multi-day", start_date: "2028-05-10", start_time: "10:00",
        end_date: "2028-05-12", end_time: "12:00", category: "Social" };
      const spanning = await insertEvent(base);
      const midnight = await insertEvent({ ...base, title: "DateOverlapFixture midnight ending", end_time: "00:00" });
      const startsNextDay = await insertEvent({ ...base, title: "DateOverlapFixture next day", start_date: "2028-05-12", start_time: "00:00" });
      const query = "?status=all&q=DateOverlapFixture&location=Leeds&category=Social";
      const inside = await request("GET", `${query}&date=2028-05-11`);
      assert.equal(inside.status, 200, JSON.stringify(inside.body));
      assert.deepEqual(new Set(inside.body.map(event => event.id)), new Set([spanning, midnight]));
      assert.deepEqual(new Set((await request("GET", `${query}&date=2028-05-12`)).body.map(event => event.id)), new Set([spanning, startsNextDay]));
      assert.deepEqual((await request("GET", `${query}&date=2028-05-13`)).body, []);
      assert.deepEqual((await request("GET", "?q=NothingMatchesThisSearch&date=2028-05-11")).body, []);
    });

    await t.test("date search follows each event zone independently of the database zone", async () => {
      const tokyo = await insertEvent({ title: "ZoneDateFixture Tokyo", timezone: "Asia/Tokyo", start_date: "2028-05-10", start_time: "09:30", end_date: "2028-05-10", end_time: "10:30" });
      const newYork = await insertEvent({ title: "ZoneDateFixture New York", timezone: "America/New_York", start_date: "2028-05-09", start_time: "20:30", end_date: "2028-05-09", end_time: "21:30" });
      try {
        for (const zone of ["America/Los_Angeles", "Asia/Tokyo"]) {
          await client.query("SELECT set_config('TimeZone', $1, true)", [zone]);
          assert.deepEqual((await request("GET", "?status=all&q=ZoneDateFixture&date=2028-05-10")).body.map(event => event.id), [tokyo]);
          assert.deepEqual((await request("GET", "?status=all&q=ZoneDateFixture&date=2028-05-09")).body.map(event => event.id), [newYork]);
        }
      } finally { await client.query("SET LOCAL TIME ZONE 'UTC'"); }
    });

    await t.test("date SQL handles DST changes, repeated midnight and skipped local dates", async () => {
      const spring = await insertEvent({ title: "SpringDateFixture", start_date: "2028-03-26", start_time: "00:00", end_date: "2028-03-27", end_time: "00:00" });
      const autumn = await insertEvent({ title: "AutumnDateFixture", start_date: "2028-10-29", start_time: "00:00", end_date: "2028-10-30", end_time: "00:00" });
      const repeated = await insertEvent({ title: "RepeatedMidnightFixture", timezone: "America/Havana", start_date: "2028-11-05", start_time: "00:10", start_offset: "-04:00", end_date: "2028-11-05", end_time: "00:20", end_offset: "-04:00" });
      const skipped = await insertEvent({ title: "SkippedDateFixture", timezone: "Pacific/Apia", start_date: "2011-12-29", start_time: "23:00", end_date: "2011-12-31", end_time: "01:00" });
      for (const [q, date, id] of [["SpringDateFixture", "2028-03-26", spring], ["AutumnDateFixture", "2028-10-29", autumn],
        ["RepeatedMidnightFixture", "2028-11-05", repeated], ["SkippedDateFixture", "2011-12-29", skipped], ["SkippedDateFixture", "2011-12-31", skipped]]) {
        const response = await request("GET", `?status=all&q=${q}&date=${date}`);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.deepEqual(response.body.map(event => event.id), [id]);
      }
      for (const [q, date] of [["SpringDateFixture", "2028-03-27"], ["AutumnDateFixture", "2028-10-30"], ["SkippedDateFixture", "2011-12-30"]]) {
        assert.deepEqual((await request("GET", `?status=all&q=${q}&date=${date}`)).body, []);
      }
    });

    await t.test("search rejects invalid query input and supports empty and extreme valid dates", async () => {
      for (const query of ["?q=a&q=b", "?location=a&location=b", "?date=2028-05-10&date=2028-05-11", "?date=2027-02-29",
        "?date=2028-02-30", "?date=0000-01-01", "?date=bad", `?q=${"x".repeat(201)}`, `?location=${"x".repeat(256)}`]) {
        assert.equal((await request("GET", query)).status, 400, query);
      }
      assert.equal((await request("GET", "?q=&location=&date=")).status, 200);
      assert.deepEqual((await request("GET", "?status=all&date=9999-12-31")).body, []);
      assert.deepEqual((await request("GET", "?status=all&date=0001-01-01")).body, []);
    });

    await t.test("pagination returns consistent totals and stable, non-overlapping filtered pages", async () => {
      const ids = [];
      for (let index = 0; index < 7; index++) ids.push(await insertEvent({
        title: `PaginationFixture ${index}`, location: "Pagination test venue", category: "Social",
      }));
      await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2), ($1, $3)", [ids[0], users[0].id, users[1].id]);
      const query = `?status=all&q=PaginationFixture&location=Pagination&category=Social&date=${futureYear}-05-11`;
      const unpaged = await request("GET", query);
      assert.ok(Array.isArray(unpaged.body));
      assert.deepEqual(unpaged.body.map(event => event.id), ids);
      const seen = [];
      for (let page = 1; page <= 3; page++) {
        const result = await request("GET", `${query}&page=${page}&page_size=3`);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.deepEqual(result.body.pagination, { page, page_size: 3, total: 7, total_pages: 3,
          has_previous: page > 1, has_next: page < 3 });
        assert.deepEqual(result.body.events.map(event => event.id), ids.slice((page - 1) * 3, page * 3));
        assert.ok(result.body.events.every(event => event.category === "Social" && event.start_date === payload.start_date));
        seen.push(...result.body.events.map(event => event.id));
        if (page === 1) assert.equal(result.body.events[0].attendee_count, 2);
      }
      assert.deepEqual(seen, ids);
      assert.equal(new Set(seen).size, 7);
      const defaultSize = await request("GET", `${query}&page=1`);
      assert.equal(defaultSize.body.pagination.page_size, 12);
      assert.equal(defaultSize.body.events.length, 7);
    });

    await t.test("pagination retains totals for empty/out-of-range pages and rejects bad parameters", async () => {
      const query = "?status=all&q=PaginationFixture&page_size=3";
      const outside = await request("GET", `${query}&page=99`);
      assert.equal(outside.status, 200, JSON.stringify(outside.body));
      assert.deepEqual(outside.body.events, []);
      assert.deepEqual(outside.body.pagination, { page: 99, page_size: 3, total: 7, total_pages: 3, has_previous: true, has_next: false });
      const empty = await request("GET", "?q=NoPaginationMatchesHere&page=2&page_size=3");
      assert.equal(empty.status, 200);
      assert.deepEqual(empty.body.events, []);
      assert.deepEqual(empty.body.pagination, { page: 2, page_size: 3, total: 0, total_pages: 0, has_previous: false, has_next: false });
      for (const query of ["?page=0", "?page=-1", "?page=1.5", "?page=1&page=2", "?page_size=101",
        "?page_size=3&page_size=12", "?page=1000001", "?page=", "?page_size=bad"]) {
        assert.equal((await request("GET", query)).status, 400, query);
      }
    });

    await t.test("free/paid filters compose with search, dates, categories and pagination", async () => {
      const base = { title: "PriceFilterFixture", category: "Sports" };
      const free = await insertEvent({ ...base, price: "0.00", currency: "GBP" });
      const paid = await insertEvent({ ...base, price: "10.50", currency: "USD" });
      const euro = await insertEvent({ ...base, price: "12.00", currency: "EUR" });
      const unknown = await insertEvent(base);
      const query = `?q=PriceFilterFixture&location=Leeds&category=Sports&date=${futureYear}-05-11`;
      const all = await request("GET", query);
      assert.deepEqual(new Set(all.body.map(event => event.id)), new Set([free, paid, euro, unknown]));
      assert.deepEqual((await request("GET", `${query}&pricing=free`)).body.map(event => event.id), [free]);
      const firstPaid = await request("GET", `${query}&pricing=paid&page=1&page_size=1`);
      assert.equal(firstPaid.status, 200, JSON.stringify(firstPaid.body));
      assert.equal(firstPaid.body.pagination.total, 2);
      assert.deepEqual(firstPaid.body.events.map(event => event.id), [paid]);
      assert.deepEqual((await request("GET", `${query}&pricing=paid&page=2&page_size=1`)).body.events.map(event => event.id), [euro]);
      for (const query of ["?pricing=unknown", "?pricing=free&pricing=paid"]) {
        assert.equal((await request("GET", query)).status, 400);
      }
    });

    await t.test("attendance endpoints enforce auth, event IDs, duplicates and user isolation", async () => {
      const eventId = await insertEvent();
      for (const [method, suffix] of [["GET", "registration"], ["POST", "register"], ["DELETE", "register"]]) {
        assert.equal((await request(method, `/${eventId}/${suffix}`, undefined, null)).status, 401);
        assert.equal((await request(method, `/abc/${suffix}`)).status, 400);
        assert.equal((await request(method, `/2147483647/${suffix}`)).status, 404);
      }
      let state = await request("GET", `/${eventId}/registration`);
      assert.equal(state.body.registered, false);
      assert.equal(state.body.registration_open, true);
      assert.equal(state.body.can_cancel, false);
      assert.equal((await request("DELETE", `/${eventId}/register`)).status, 404);
      assert.equal((await request("POST", `/${eventId}/register`)).status, 201);
      assert.equal((await request("POST", `/${eventId}/register`)).status, 409);
      state = await request("GET", `/${eventId}/registration`);
      assert.equal(state.body.registered, true);
      assert.equal(state.body.can_cancel, true);
      const other = await request("GET", `/${eventId}/registration`, undefined, otherToken);
      assert.equal(other.body.registered, false);
      assert.equal((await request("DELETE", `/${eventId}/register`, undefined, otherToken)).status, 404);
      assert.equal((await request("GET", `/${eventId}`)).body.attendee_count, 1);
    });

    await t.test("registration closes exactly at a deadline or start, preserving existing attendance", async () => {
      try {
        const deadline = `${futureYear}-05-10T08:00:00Z`;
        const eventId = await insertEvent({ registration_deadline: deadline });
        attendanceTestInstant = `${futureYear}-05-10T07:59:59Z`;
        assert.equal((await request("POST", `/${eventId}/register`)).status, 201);
        attendanceTestInstant = deadline;
        const state = await request("GET", `/${eventId}/registration`);
        assert.equal(state.body.registered, true);
        assert.equal(state.body.lifecycle, "upcoming");
        assert.equal(state.body.registration_open, false);
        assert.equal(state.body.can_cancel, true);
        assert.equal((await request("POST", `/${eventId}/register`, undefined, otherToken)).status, 403);
        assert.equal((await request("GET", `/${eventId}`)).body.attendee_count, 1);
        for (const registration_deadline of [null, `${futureYear}-05-10T09:00:00Z`]) {
          const startsId = await insertEvent({ registration_deadline });
          attendanceTestInstant = `${futureYear}-05-10T08:59:59Z`;
          assert.equal((await request("POST", `/${startsId}/register`)).status, 201);
          attendanceTestInstant = `${futureYear}-05-10T09:00:00Z`;
          assert.equal((await request("POST", `/${startsId}/register`, undefined, otherToken)).status, 403);
          const started = await request("GET", `/${startsId}/registration`);
          assert.equal(started.body.lifecycle, "ongoing");
          assert.equal(started.body.registration_open, false);
          assert.equal(started.body.registered, true);
        }
      } finally { attendanceTestInstant = null; }
    });

    await t.test("cancellation is allowed before and during events but ends exactly at event end", async () => {
      try {
        const eventId = await insertEvent();
        attendanceTestInstant = `${futureYear}-05-10T08:00:00Z`;
        assert.equal((await request("POST", `/${eventId}/register`)).status, 201);
        assert.equal((await request("DELETE", `/${eventId}/register`)).status, 200);
        assert.equal((await request("POST", `/${eventId}/register`)).status, 201);
        assert.equal((await request("POST", `/${eventId}/register`, undefined, otherToken)).status, 201);
        attendanceTestInstant = `${futureYear}-05-10T09:00:00Z`;
        assert.equal((await request("DELETE", `/${eventId}/register`)).status, 200);
        assert.equal((await request("GET", `/${eventId}`)).body.attendee_count, 1);
        attendanceTestInstant = `${futureYear}-05-12T11:00:00Z`;
        const past = await request("GET", `/${eventId}/registration`, undefined, otherToken);
        assert.equal(past.body.lifecycle, "past");
        assert.equal(past.body.registered, true);
        assert.equal(past.body.cancellation_open, false);
        assert.equal(past.body.can_cancel, false);
        assert.equal((await request("DELETE", `/${eventId}/register`, undefined, otherToken)).status, 403);
        assert.equal((await request("GET", `/${eventId}`)).body.attendee_count, 1);
        const history = await request("GET", "/api/users/me/events", undefined, otherToken);
        assert.ok(history.body.some(event => event.id === eventId));
      } finally { attendanceTestInstant = null; }
    });

    await t.test("mutations recheck a cutoff reached after the initial status read", async () => {
      try {
        const eventId = await insertEvent();
        attendanceTestInstant = `${futureYear}-05-10T08:59:59Z`;
        beforeAttendanceMutation = () => { attendanceTestInstant = `${futureYear}-05-10T09:00:00Z`; };
        assert.equal((await request("POST", `/${eventId}/register`)).status, 403);
        assert.equal((await request("GET", `/${eventId}`)).body.attendee_count, 0);
        attendanceTestInstant = `${futureYear}-05-10T08:59:59Z`;
        assert.equal((await request("POST", `/${eventId}/register`)).status, 201);
        attendanceTestInstant = `${futureYear}-05-12T10:59:59Z`;
        beforeAttendanceMutation = () => { attendanceTestInstant = `${futureYear}-05-12T11:00:00Z`; };
        assert.equal((await request("DELETE", `/${eventId}/register`)).status, 403);
        assert.equal((await request("GET", `/${eventId}/registration`)).body.registered, true);
      } finally { attendanceTestInstant = null; beforeAttendanceMutation = null; }
    });

    await t.test("registration uses the selected occurrence of a repeated DST clock time", async () => {
      try {
        const lastSunday = new Date(Date.UTC(futureYear, 9, 31));
        lastSunday.setUTCDate(31 - lastSunday.getUTCDay());
        const date = lastSunday.toISOString().slice(0, 10);
        const body = { start_date: date, end_date: date, start_time: "01:30", end_time: "02:30", end_offset: "+00:00" };
        const earlier = await insertEvent({ ...body, start_offset: "+01:00" });
        const later = await insertEvent({ ...body, start_offset: "+00:00" });
        attendanceTestInstant = `${date}T00:45:00Z`;
        assert.equal((await request("POST", `/${earlier}/register`)).status, 403);
        assert.equal((await request("POST", `/${later}/register`)).status, 201);
      } finally { attendanceTestInstant = null; }
    });

    let seedIds;
    await t.test("seeds insert valid lifecycle examples and reruns preserve schedules and attendance", async () => {
      const seedNow = new Date().toISOString();
      assert.deepEqual(await seedEvents(pool, seedNow), { inserted: 6, skipped: 0 });
      const definitions = buildSeedEvents(seedNow);
      const seeded = (await client.query("SELECT id, title, start_date::text, start_time::text FROM events WHERE created_by IS NULL")).rows;
      assert.equal(seeded.length, 6);
      seedIds = seeded.map(event => event.id);
      for (const sample of seeded) {
        const expected = definitions.find(event => event.title === sample.title);
        assert.ok(expected);
        const detail = await request("GET", `/${sample.id}`);
        assert.equal(detail.status, 200, JSON.stringify(detail.body));
        assert.deepEqual({ lifecycle: detail.body.lifecycle, registration_open: detail.body.registration_open },
          eventTimingStatus(resolveEventTiming(expected), seedNow));
        assert.equal(detail.body.start_offset, expected.start_offset);
        assert.equal(detail.body.end_offset, expected.end_offset);
        assert.equal(detail.body.created_by, null);
        assert.equal(detail.body.category, expected.category);
        assert.equal(detail.body.price, expected.price);
        assert.equal(detail.body.currency, expected.currency);
      }
      const sampleId = seedIds[0];
      await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)", [sampleId, users[1].id]);
      // A later rerun must not move existing samples to freshly generated dates.
      const later = new Date(Date.parse(seedNow) + 30 * 86400000).toISOString();
      assert.deepEqual(await seedEvents(pool, later), { inserted: 0, skipped: 6 });
      assert.deepEqual((await client.query("SELECT id, title, start_date::text, start_time::text FROM events WHERE created_by IS NULL")).rows, seeded);
      assert.equal((await request("GET", `/${sampleId}`)).body.attendee_count, 1);
    });

    await t.test("a seed failure rolls back the entire batch", async () => {
      await client.query("DELETE FROM events WHERE id = ANY($1::integer[])", [seedIds]);
      const before = (await client.query("SELECT COUNT(*)::integer AS count FROM events")).rows[0].count;
      const failingDb = { connect: async () => {
        const connection = await pool.connect();
        let inserts = 0;
        return {
          query(sql, values) {
            if (sql.startsWith("INSERT INTO events") && ++inserts === 3) throw new Error("Simulated seed failure");
            return connection.query(sql, values);
          },
          release: () => connection.release(),
        };
      } };
      await assert.rejects(seedEvents(failingDb), /Simulated seed failure/);
      assert.equal((await client.query("SELECT COUNT(*)::integer AS count FROM events")).rows[0].count, before);
      assert.equal((await client.query("SELECT COUNT(*)::integer AS count FROM events WHERE created_by IS NULL")).rows[0].count, 0);
    });

    await t.test("category update preserves existing data and is repeatable", async () => {
      await seedEvents(pool);
      const snapshotSql = `SELECT id, title, start_date::text, start_time::text,
        end_date::text, end_time::text, registration_deadline::text, created_by FROM events ORDER BY id`;
      const before = (await client.query(snapshotSql)).rows;
      const registrations = (await client.query("SELECT * FROM event_attendees ORDER BY id")).rows;
      // Simulate the installed timing schema before categories existed.
      await client.query("ALTER TABLE events DROP COLUMN category");
      assert.equal((await request("GET", "/config")).body.categories.length, 0);
      assert.equal((await request("GET", "?category=Sports")).status, 400);
      assert.deepEqual(await addEventCategories(pool), { backfilled: 6 });
      assert.deepEqual((await client.query(snapshotSql)).rows, before);
      assert.deepEqual((await client.query("SELECT * FROM event_attendees ORDER BY id")).rows, registrations);
      assert.equal((await client.query("SELECT COUNT(*)::integer AS count FROM events WHERE created_by IS NULL AND category IS NOT NULL")).rows[0].count, 6);
      assert.deepEqual(await addEventCategories(pool), { backfilled: 0 });
      assert.deepEqual((await client.query(snapshotSql)).rows, before);
    });

    await t.test("pricing schema update preserves event data and backfills only known unowned samples", async () => {
      const snapshot = "SELECT id, title, category, start_date::text, start_time::text, end_date::text, end_time::text, created_by FROM events ORDER BY id";
      const before = (await client.query(snapshot)).rows;
      const attendance = (await client.query("SELECT * FROM event_attendees ORDER BY id")).rows;
      await client.query("ALTER TABLE events DROP COLUMN price, DROP COLUMN currency");
      assert.equal((await request("GET", "/config")).body.pricing, null);
      assert.equal((await request("GET", "?pricing=free")).status, 400);
      assert.deepEqual(await addEventPricing(pool), { backfilled: 6 });
      assert.deepEqual((await client.query(snapshot)).rows, before);
      assert.deepEqual((await client.query("SELECT * FROM event_attendees ORDER BY id")).rows, attendance);
      assert.equal((await client.query("SELECT COUNT(*)::integer AS count FROM events WHERE created_by IS NULL AND price IS NOT NULL")).rows[0].count, 6);
      assert.equal((await client.query("SELECT COUNT(*)::integer AS count FROM events WHERE created_by IS NOT NULL AND price IS NOT NULL")).rows[0].count, 0);
      assert.deepEqual(await addEventPricing(pool), { backfilled: 0 });
    });

    await t.test("location update preserves data and is repeatable with preceding-schema compatibility", async () => {
      await client.query("ALTER TABLE events DROP COLUMN address, DROP COLUMN city, DROP COLUMN postcode, DROP COLUMN country");
      assert.equal((await request("GET","/config")).body.structured_location,false);
      const created=await request("POST","",payload);
      assert.equal(created.status,201);
      assert.equal((await request("PUT",`/${created.body.id}`,payload)).status,200);
      assert.equal((await request("PUT",`/${created.body.id}`,{...payload,city:"Leeds"})).status,400);
      const before=(await client.query("SELECT to_jsonb(e) AS data FROM events e ORDER BY id")).rows;
      const attendees=(await client.query("SELECT * FROM event_attendees ORDER BY id")).rows;
      await addEventLocations(); await addEventLocations();
      assert.equal((await request("GET","/config")).body.structured_location,true);
      assert.deepEqual((await client.query("SELECT to_jsonb(e)-'address'-'city'-'postcode'-'country' AS data FROM events e ORDER BY id")).rows,before);
      assert.deepEqual((await client.query("SELECT * FROM event_attendees ORDER BY id")).rows,attendees);
      assert.equal((await client.query("SELECT count(*)::integer AS n FROM events WHERE city IS NOT NULL OR address IS NOT NULL OR postcode IS NOT NULL OR country IS NOT NULL")).rows[0].n,0);
    });

    await t.test("radius search filters before counting and paging, with a 10-mile default", async () => {
      const fixture = { ...payload, title: "RadiusFixture", price: "0.00", category: "Social" };
      const ids = [];
      for (const point of [{ latitude: 0.05, longitude: 0 }, { latitude: 0.10, longitude: 0 },
        { latitude: 0.20, longitude: 0 }, {}, { latitude: 0, longitude: 179.98 }]) {
        const created = await request("POST", "", { ...fixture, ...point });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        ids.push(created.body.id);
      }
      const filters = `?q=RadiusFixture&category=Social&pricing=free&date=${futureYear}-05-11`;
      const origin = `${filters}&origin_lat=0&origin_lon=0`;
      const all = await request("GET", filters);
      assert.deepEqual(all.body.map(event => event.id), ids);
      const defaultRadius = await request("GET", origin);
      assert.equal(defaultRadius.status, 200, JSON.stringify(defaultRadius.body));
      assert.deepEqual(defaultRadius.body.map(event => event.id), ids.slice(0, 2));
      assert.ok(Math.abs(defaultRadius.body[0].distance_miles - 3.455) < 0.01);
      const firstPage = await request("GET", `${origin}&page=1&page_size=1`);
      assert.equal(firstPage.status, 200, JSON.stringify(firstPage.body));
      assert.equal(firstPage.body.pagination.total, 2);
      assert.deepEqual(firstPage.body.events.map(event => event.id), ids.slice(0, 1));
      const secondPage = await request("GET", `${origin}&page=2&page_size=1`);
      assert.deepEqual(secondPage.body.events.map(event => event.id), ids.slice(1, 2));
      assert.deepEqual((await request("GET", `${origin}&radius=5`)).body.map(event => event.id), ids.slice(0, 1));
      assert.deepEqual((await request("GET", `${origin}&radius=25`)).body.map(event => event.id), ids.slice(0, 3));
      const any = await request("GET", `${origin}&radius=all&page=1&page_size=12`);
      assert.equal(any.status, 200, JSON.stringify(any.body));
      assert.equal(any.body.pagination.total, 5);
      assert.equal(any.body.events.find(event => event.id === ids[3]).distance_miles, null);
      const acrossDateLine = await request("GET", `${filters}&origin_lat=0&origin_lon=-179.98&radius=5`);
      assert.deepEqual(acrossDateLine.body.map(event => event.id), [ids[4]]);
      for (const params of ["radius=5", "origin_lat=0", "origin_lat=91&origin_lon=0", "origin_lat=0&origin_lon=181",
        "origin_lat=0&origin_lon=0&radius=20", "origin_lat=0&origin_lat=1&origin_lon=0", "origin_lat=&origin_lon=0"]) {
        assert.equal((await request("GET", `?${params}`)).status, 400);
      }
    });

    await t.test("event map points require valid pairs and are cleared by address changes", async () => {
      const point = { latitude: 53.8, longitude: -1.55, place_label: " Example venue " };
      const created = await request("POST", "", { ...payload, ...point, city: "Leeds" });
      assert.equal(created.status, 201);
      const path = `/${created.body.id}`;
      assert.equal(created.body.place_label, "Example venue");
      const unchanged = await request("PUT", path, { ...payload, city: " Leeds " });
      assert.equal(unchanged.body.latitude, point.latitude);
      assert.equal((await request("PUT", path, { ...payload, ...point }, otherToken)).status, 403);
      for (const bad of [{ latitude: 10 }, { latitude: null, longitude: 0 }, { latitude: "NaN", longitude: 0 },
        { latitude: 0, longitude: [] }, { latitude: -91, longitude: 0 }, { place_label: "Orphan label" }]) {
        assert.equal((await request("POST", "", { ...payload, ...bad })).status, 400);
        assert.equal((await request("PUT", path, { ...payload, ...bad })).status, 400);
      }
      const moved = await request("PUT", path, { ...payload, city: "York" });
      assert.equal(moved.status, 200);
      assert.equal(moved.body.latitude, null);
      assert.equal(moved.body.longitude, null);
      assert.equal(moved.body.place_label, null);
      await client.query("SAVEPOINT invalid_coordinate");
      await assert.rejects(client.query("UPDATE events SET latitude=0 WHERE id=$1", [created.body.id]), { code: "23514" });
      await client.query("ROLLBACK TO SAVEPOINT invalid_coordinate");
    });

    await t.test("coordinate schema update is repeatable and does not infer positions", async () => {
      await client.query("ALTER TABLE events DROP COLUMN latitude, DROP COLUMN longitude, DROP COLUMN place_label");
      assert.equal((await request("GET", "/config")).body.coordinates, false);
      assert.equal((await request("GET", "?origin_lat=0&origin_lon=0")).status, 400);
      const before = (await client.query("SELECT to_jsonb(e) AS data FROM events e ORDER BY id")).rows;
      await addEventCoordinates();
      await addEventCoordinates();
      assert.equal((await request("GET", "/config")).body.coordinates, true);
      const after = await client.query("SELECT to_jsonb(e)-'latitude'-'longitude'-'place_label' AS data FROM events e ORDER BY id");
      assert.deepEqual(after.rows, before);
      assert.equal((await client.query("SELECT 1 FROM events WHERE latitude IS NOT NULL")).rowCount, 0);
    });

    await t.test("legacy create and edit still work on the original schema", async () => {
      // This affects only the isolated test schema, never public tables.
      await client.query("DROP TABLE event_attendees; DROP TABLE events");
      await client.query(`CREATE TABLE events (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL, date DATE NOT NULL, time TIME NOT NULL,
        location VARCHAR(255) NOT NULL, created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await client.query(`CREATE TABLE event_attendees (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id INTEGER REFERENCES users(id),
        event_id INTEGER REFERENCES events(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, event_id))`);
      const legacy = { title: "Legacy", description: "Original form", date: `${futureYear}-05-10`, time: "10:00", location: "Leeds" };
      assert.deepEqual((await request("GET", "/config")).body, { multi_day: false, default_timezone: "Europe/London", categories: [], pricing: null, structured_location: false, coordinates: false });
      const created = await request("POST", "", legacy);
      assert.equal(created.status, 201);
      assert.equal((await request("PUT", `/${created.body.id}`, { ...legacy, title: "Legacy edited" })).status, 200);
      assert.equal((await request("PUT", `/${created.body.id}`, legacy, otherToken)).status, 403);
      const pastLegacy = (await client.query(`INSERT INTO events (title, description, date, time, location, created_by)
        VALUES ('Legacy history', 'Past event', '2020-01-01', '10:00', 'Leeds', $1) RETURNING id`, [users[0].id])).rows[0].id;
      await client.query("INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2), ($3, $2)",
        [created.body.id, users[1].id, pastLegacy]);
      const listed = await request("GET", "");
      assert.equal(listed.status, 200, JSON.stringify(listed.body));
      assert.deepEqual(listed.body.map(event => event.id), [created.body.id]);
      assert.equal(listed.body[0].attendee_count, 1);
      assert.ok(listed.body[0].date && listed.body[0].time);
      assert.equal((await request("GET", "?status=all")).body.length, 2);
      const legacyPage = await request("GET", "?status=all&page=1&page_size=1");
      assert.equal(legacyPage.status, 200);
      assert.equal(legacyPage.body.pagination.total, 2);
      assert.deepEqual(legacyPage.body.events.map(event => event.id), [pastLegacy]);
      assert.equal((await request("GET", "?status=ongoing")).status, 400);
      assert.deepEqual((await request("GET", `?q=legacy&location=LEEDS&date=${futureYear}-05-10`)).body.map(event => event.id), [created.body.id]);
      assert.deepEqual((await request("GET", "?status=all&date=2020-01-01")).body.map(event => event.id), [pastLegacy]);
      assert.equal((await request("GET", `/${pastLegacy}`)).status, 200);
      const registered = await request("GET", "/api/users/me/events", undefined, otherToken);
      assert.equal(registered.status, 200);
      assert.deepEqual(registered.body.map(event => event.id), [pastLegacy, created.body.id]);
      assert.ok(registered.body.every(event => event.registered_at && event.date && event.time));
      const owned = await request("GET", "/api/users/me/created-events");
      assert.deepEqual(owned.body.map(event => event.id), [created.body.id, pastLegacy]);
      const registeredLegacy = await request("GET", `/${created.body.id}/registration`, undefined, otherToken);
      assert.equal(registeredLegacy.body.registered, true);
      assert.equal(registeredLegacy.body.registration_open, true);
      assert.equal((await request("POST", `/${created.body.id}/register`, undefined, otherToken)).status, 409);
      assert.equal((await request("POST", `/${pastLegacy}/register`)).status, 403);
      assert.equal((await request("DELETE", `/${pastLegacy}/register`, undefined, otherToken)).status, 200);
      assert.equal((await request("POST", `/${created.body.id}/register`)).status, 201);
      assert.equal((await request("DELETE", `/${created.body.id}/register`)).status, 200);
      await assert.rejects(seedEvents(pool), /require the multi-day event schema/);
      assert.equal((await request("GET", "?status=all")).body.length, 2);
      assert.equal((await request("POST", "", payload)).status, 503);
    });
  } finally {
    express.application.listen = originalListen;
    pool.query = originalQuery;
    pool.connect = originalConnect;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (listener) await new Promise(resolve => listener.close(resolve));
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
