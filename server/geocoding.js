export class GeocodingError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

export function createGeocoder({ fetchImpl = fetch, now = Date.now,
  endpoint = process.env.PHOTON_URL ?? "https://photon.komoot.io/api/" } = {}) {
  const cache = new Map();
  let nextRequest = 0;
  let busy = false;
  return async function findPlaces(query) {
    if (typeof query !== "string" || query.trim().length < 2 || query.trim().length > 255) {
      throw new GeocodingError("Enter a place or public venue between 2 and 255 characters.", 400);
    }
    const q = query.trim();
    const key = q.toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.places;
    // One application-wide request per second, with no unbounded request queue.
    if (busy || now() < nextRequest) throw new GeocodingError("Place lookup is busy. Please try again in a moment.", 429);
    nextRequest = now() + 1000;
    busy = true;
    try {
      const url = new URL(endpoint);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "5");
      url.searchParams.set("lang", "en");
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json", "User-Agent": "CommunityHub/0.1 (event discovery)" },
      });
      if (!response.ok) throw new Error("Provider unavailable");
      const data = await response.json();
      if (!Array.isArray(data.features)) throw new Error("Invalid provider response");
      const places = data.features.slice(0, 5).flatMap(feature => {
        if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return [];
        const [longitude, latitude] = feature.geometry.coordinates;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
        const properties = feature.properties ?? {};
        const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
        const label = [properties.name, street, properties.city ?? properties.town ?? properties.village,
          properties.postcode, properties.state, properties.country]
          .filter(value => typeof value === "string" && value.trim());
        const unique = [...new Set(label)];
        if (!unique.length) return [];
        return [{ latitude, longitude, label: unique.join(", ").slice(0, 500) }];
      });
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { places, expires: now() + 24 * 60 * 60 * 1000 });
      return places;
    } catch {
      throw new GeocodingError("Place lookup is temporarily unavailable. Try again later or use text search.");
    } finally { busy = false; }
  };
}
