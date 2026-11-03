import PlaceSearch from "./PlaceSearch";

export default function EventRadiusFilter({ params, onChange }) {
  const hasOrigin=params.has("origin_lat") || params.has("origin_lon");
  const radius=params.get("radius") ?? "10";
  return <div className="mt-6 space-y-3 rounded-lg border border-gray-200 p-4">
    <PlaceSearch id="search-origin" label="Find events near a place" onSelect={place=>onChange({
      origin_lat:place.latitude,origin_lon:place.longitude,origin_label:place.label,radius:"10",
    })} />
    {hasOrigin ? <div className="space-y-3">
      <p className="text-sm text-gray-700">Search origin: {params.get("origin_label") || `${params.get("origin_lat")}, ${params.get("origin_lon")}`}</p>
      <label htmlFor="event-radius" className="mr-3 text-sm font-semibold">Distance</label>
      <select id="event-radius" value={radius} onChange={event=>onChange({radius:event.target.value})}
        className="rounded-lg border border-gray-300 px-3 py-2">
        {["5","10","25","50"].map(value=><option key={value} value={value}>Within {value} miles</option>)}
        <option value="all">Any distance</option>
      </select>
      <button type="button" onClick={()=>onChange({origin_lat:"",origin_lon:"",origin_label:"",radius:""})}
        className="ml-3 text-sm text-blue-700 underline">Remove search origin</button>
      <p className="text-xs text-gray-500">Straight-line distance, not travel distance. {radius!=="all" && "Events without a map location are excluded."} Text location filters also apply.</p>
    </div> : <p className="text-sm text-gray-600">Select a place to apply the default 10-mile radius.</p>}
  </div>;
}
