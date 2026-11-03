// Shared SQL keeps event dates, lifecycle and registration availability consistent
// across discovery, details and both profile lists.
const startsAt = "((e.start_date + e.start_time - e.start_offset::interval) AT TIME ZONE 'UTC')";
const endsAt = "((e.end_date + e.end_time - e.end_offset::interval) AT TIME ZONE 'UTC')";
const closesAt = `LEAST(${startsAt}, COALESCE(e.registration_deadline, ${startsAt}))`;
const countAttendees = `(SELECT COUNT(*)::integer FROM event_attendees attendees
  WHERE attendees.event_id = e.id)`;
const attendeeCount = `${countAttendees} AS attendee_count`;
const timingFields = active => `${startsAt} AS starts_at, ${endsAt} AS ends_at,
  ${closesAt} AS registration_closes_at,
  CASE WHEN statement_timestamp() < ${startsAt} THEN 'upcoming'
    WHEN statement_timestamp() < ${endsAt} THEN 'ongoing'
    ELSE 'past' END AS lifecycle,
  (${active} AND statement_timestamp() < ${closesAt}) AS registration_open,
  (${active} AND statement_timestamp() < ${endsAt}) AS cancellation_open`;

const multiDay = active => ({
  multiDay: true,
  startsAt,
  endsAt,
  fields: `e.*, to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
    to_char(e.end_date, 'YYYY-MM-DD') AS end_date,
    ${timingFields(active)}, ${attendeeCount}`,
  attendanceFields: timingFields(active),
  // Mutation predicates use actual execution time, including after lock waits.
  registrationOpenAtRead: `${active} AND statement_timestamp() < ${closesAt}`,
  registrationOpen: `${active} AND clock_timestamp() < ${closesAt}`,
  cancellationOpen: `${active} AND clock_timestamp() < ${endsAt}`,
  orderBy: startsAt,
  filters: {
    upcoming: `statement_timestamp() < ${startsAt}`,
    ongoing: `statement_timestamp() >= ${startsAt} AND statement_timestamp() < ${endsAt}`,
    past: `statement_timestamp() >= ${endsAt}`,
    all: "TRUE",
  },
});

const legacy = {
  multiDay: false,
  fields: `e.*, ${attendeeCount}`,
  attendanceFields: `((e.date + e.time) > statement_timestamp()::timestamp) AS registration_open,
    TRUE AS cancellation_open`,
  registrationOpenAtRead: "(e.date + e.time) > statement_timestamp()::timestamp",
  registrationOpen: "(e.date + e.time) > clock_timestamp()::timestamp",
  cancellationOpen: "TRUE",
  orderBy: "(e.date + e.time)",
  // Original events have no end time, so do not invent ongoing/past states.
  filters: { upcoming: "(e.date + e.time) >= LOCALTIMESTAMP", all: "TRUE" },
};

export async function getEventReadModel(db) {
  // Temporary compatibility for the existing database. Resolve the active events
  // table through search_path; do not cache across a future schema transition.
  const result = await db.query(`SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('events') AND attname = 'start_date'
      AND NOT attisdropped
  ) AS multi_day, EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('events') AND attname = 'category'
      AND NOT attisdropped
  ) AS has_category, (
    SELECT COUNT(*) = 2 FROM pg_attribute
    WHERE attrelid = to_regclass('events') AND attname IN ('price', 'currency')
      AND NOT attisdropped
  ) AS has_pricing, (
    SELECT COUNT(*) = 4 FROM pg_attribute
    WHERE attrelid = to_regclass('events') AND attname IN ('address', 'city', 'postcode', 'country')
      AND NOT attisdropped
  ) AS has_structured_location, (
    SELECT COUNT(*) = 3 FROM pg_attribute
    WHERE attrelid = to_regclass('events') AND attname IN ('latitude', 'longitude', 'place_label')
      AND NOT attisdropped
  ) AS has_coordinates, EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('events')
      AND attname = 'capacity' AND NOT attisdropped
  ) AS has_capacity, EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('events')
      AND attname = 'cancelled_at' AND NOT attisdropped
  ) AS has_event_cancellation`);
  return { ...(result.rows[0].multi_day ? multiDay(result.rows[0].has_event_cancellation ? "e.cancelled_at IS NULL" : "TRUE") : legacy), hasCategory: result.rows[0].has_category,
    hasPricing: result.rows[0].has_pricing, hasStructuredLocation: result.rows[0].has_structured_location,
    hasEventCancellation: result.rows[0].multi_day && result.rows[0].has_event_cancellation,
    hasSpace: result.rows[0].has_capacity ? `(e.capacity IS NULL OR ${countAttendees} < e.capacity)` : "TRUE",
    hasCapacity: result.rows[0].has_capacity,
    hasCoordinates: result.rows[0].has_structured_location && result.rows[0].has_coordinates };
}
