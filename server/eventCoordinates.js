export const coordinatesCheckSql = `(latitude IS NULL AND longitude IS NULL AND place_label IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)`;

export function coordinate(value, maximum) {
  if ((typeof value !== "string" && typeof value !== "number") ||
      (typeof value === "string" && (value.length > 32 || !/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value))) ||
      !Number.isFinite(Number(value)) || Math.abs(Number(value)) > maximum) {
    throw new Error("Provide valid latitude (-90 to 90) and longitude (-180 to 180).");
  }
  return Number(value);
}

const locationFields = ["location", "address", "city", "postcode", "country"];
export function eventCoordinates(body, existing = {}) {
  const supplied = Object.hasOwn(body, "latitude") || Object.hasOwn(body, "longitude");
  if (!supplied) {
    if (Object.hasOwn(body, "place_label")) throw new Error("Provide coordinates when changing the map location.");
    const moved = locationFields.some(field => Object.hasOwn(body, field) &&
      (body[field]?.trim() || null) !== (existing[field]?.trim() || null));
    return moved ? { latitude: null, longitude: null, place_label: null }
      : { latitude: existing.latitude ?? null, longitude: existing.longitude ?? null, place_label: existing.place_label ?? null };
  }
  if (body.latitude === null && body.longitude === null) return { latitude: null, longitude: null, place_label: null };
  const latitude = coordinate(body.latitude, 90);
  const longitude = coordinate(body.longitude, 180);
  const label = body.place_label ?? null;
  if (label !== null && (typeof label !== "string" || label.trim().length > 500)) throw new Error("Map location label must be 500 characters or fewer.");
  return { latitude, longitude, place_label: label?.trim() || null };
}

export function parseEventRadius(query) {
  const hasOrigin = query.origin_lat !== undefined || query.origin_lon !== undefined;
  if (!hasOrigin) {
    if (query.radius !== undefined || query.origin_label !== undefined) throw new Error("Select a search origin before using a radius.");
    return null;
  }
  const latitude = coordinate(query.origin_lat, 90);
  const longitude = coordinate(query.origin_lon, 180);
  const radius = query.radius ?? "10";
  if (typeof radius !== "string" || !["5", "10", "25", "50", "all"].includes(radius)) throw new Error("Radius must be 5, 10, 25, 50 miles or all.");
  if (query.origin_label !== undefined && (typeof query.origin_label !== "string" || query.origin_label.length > 500)) throw new Error("Search origin label must be a single value of 500 characters or fewer.");
  return { latitude, longitude, radius };
}

export function distanceSql(latitudeParam, longitudeParam) {
  return `(CASE WHEN e.latitude IS NULL OR e.longitude IS NULL THEN NULL ELSE
    2 * 3958.7613 * asin(sqrt(LEAST(1.0::double precision, GREATEST(0.0::double precision,
    power(sin(radians(e.latitude - ${latitudeParam}::double precision) / 2), 2) +
    cos(radians(${latitudeParam}::double precision)) * cos(radians(e.latitude)) *
    power(sin(radians(e.longitude - ${longitudeParam}::double precision) / 2), 2))))) END)`;
}
