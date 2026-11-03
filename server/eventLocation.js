export const LOCATION_FIELDS = Object.freeze({ address: 255, city: 100, postcode: 32, country: 100 });

export function eventLocation(body, existing = {}) {
  return Object.fromEntries(Object.entries(LOCATION_FIELDS).map(([field, limit]) => {
    if (!Object.hasOwn(body, field)) return [field, existing[field] ?? null];
    const value = body[field];
    if (value === null) return [field, null];
    if (typeof value !== "string" || value.trim().length > limit) {
      throw new Error(`${field} must be text of ${limit} characters or fewer, or null.`);
    }
    return [field, value.trim() || null];
  }));
}
