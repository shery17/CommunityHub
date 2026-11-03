import PlaceSearch from "./PlaceSearch";

const fields = [["address", "Street address", 255], ["city", "City or town", 100],
  ["postcode", "Postcode / ZIP code", 32], ["country", "Country", 100]];

export default function EventLocationFields({ form, onChange, enabled, disabled, coordinatesEnabled, onSelectPlace }) {
  if (!enabled) return null;
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="font-semibold text-gray-900">Location details (optional)</legend>
    <p className="text-sm text-gray-600">Add an address to help people find the event. These details appear publicly.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([name, label, limit]) => <div key={name}>
        <label htmlFor={name} className="block text-sm font-semibold text-gray-900">{label}</label>
        <input id={name} name={name} value={form[name] ?? ""} onChange={onChange}
          maxLength={limit} type="text"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" />
      </div>)}
    </div>
    {coordinatesEnabled && <div className="space-y-3 border-t border-gray-200 pt-4">
      <PlaceSearch id="event-map-place" label="Find event map location" disabled={disabled}
        onSelect={place=>onSelectPlace({latitude:place.latitude,longitude:place.longitude,place_label:place.label})} />
      {form.latitude != null && form.longitude != null ? <>
        <p role="status" className="text-sm text-gray-700">Selected map location: {form.place_label || `${form.latitude}, ${form.longitude}`}</p>
        <p className="text-xs text-gray-500">Choose a venue result for accurate distance estimates; a city result uses its centre.</p>
        <button type="button" onClick={()=>onSelectPlace({latitude:null,longitude:null,place_label:null})}
          className="text-sm text-blue-700 underline">Remove map location</button>
      </> : <p role="status" className="text-sm text-gray-600">No map location selected. This event will not appear in radius searches.</p>}
    </div>}
  </fieldset>;
}
