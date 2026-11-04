import PlaceSearch from "./PlaceSearch";

import { clearOrigin } from "../eventListParams";

export default function EventRadiusFilter({ params, location, lookupEnabled, onChange }) {
  const hasOrigin = params.has("origin_lat") || params.has("origin_lon");
  const originLabel = params.get("origin_label") || [params.get("origin_lat"), params.get("origin_lon")].filter(Boolean).join(", ");
  const radius = params.get("radius") ?? "10";

  return <div className="min-w-0 space-y-3">
    <PlaceSearch id="event-location" label="Location" value={hasOrigin ? originLabel : location}
      placeholder="Enter a city or venue" lookupEnabled={lookupEnabled} lookupLabel="Find a place"
      onQueryChange={value => onChange({ ...clearOrigin, location: value }, true)}
      onSelect={place => onChange({
        location: "", origin_lat: place.latitude, origin_lon: place.longitude, origin_label: place.label, radius: "10",
      })} />
    {hasOrigin && <div>
      <label htmlFor="event-radius" className="mb-1 block text-sm font-semibold">Distance</label>
      <select id="event-radius" value={radius} onChange={event => onChange({ radius: event.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2">
        {["5", "10", "25", "50"].map(value => <option key={value} value={value}>
          Within {value} miles{originLabel ? ` of ${originLabel}` : ""}
        </option>)}
        <option value="all">Any distance</option>
      </select>
      <p className="mt-1 text-xs text-gray-600">Distances are straight-line estimates.</p>
    </div>}
  </div>;
}
