import { EventSearchError } from "./eventSearch.js";

export function parseEventPagination(query) {
  if (query.page === undefined && query.page_size === undefined) return null;
  function integer(name, fallback, maximum) {
    const value = query[name] ?? String(fallback);
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
      throw new EventSearchError(`${name === "page" ? "Page" : "Page size"} must be a whole number between 1 and ${maximum}.`);
    }
    return Number(value);
  }
  const page = integer("page", 1, 1000000);
  const pageSize = integer("page_size", 12, 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function paginatedEvents(db, model, search, { page, pageSize, offset }) {
  const values = [...search.values, pageSize, offset];
  // Count and page membership use one PostgreSQL statement/snapshot. Only page
  // rows load full event details and attendee totals. A LEFT JOIN retains the
  // total even when a requested page is empty or beyond the last page.
  const result = await db.query(`WITH matching_events AS MATERIALIZED (
      SELECT e.id, ${model.orderBy} AS sort_start FROM events e
      ${search.join} WHERE ${search.where}
    ), requested_page AS (
      SELECT id FROM matching_events ORDER BY sort_start ASC, id ASC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    )
    SELECT ${model.fields}${search.distance ? `, ${search.distance} AS distance_miles` : ""}, totals.total_count
    FROM (SELECT COUNT(*)::integer AS total_count FROM matching_events) totals
    LEFT JOIN requested_page p ON TRUE
    LEFT JOIN events e ON e.id = p.id
    ORDER BY ${model.orderBy} ASC, e.id ASC`, values);
  const total = result.rows[0].total_count;
  const totalPages = Math.ceil(total / pageSize);
  return {
    events: result.rows.filter(row => row.id !== null).map(({ total_count, ...event }) => {
      void total_count;
      return event;
    }),
    pagination: { page, page_size: pageSize, total, total_pages: totalPages,
      has_previous: total > 0 && page > 1, has_next: page < totalPages },
  };
}
