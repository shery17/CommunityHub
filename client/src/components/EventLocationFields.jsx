import PlaceSearch from "./PlaceSearch";

const fields = [["address", "Street address", 255], ["city", "City or town", 100],
  ["postcode", "Postcode / ZIP code", 32], ["country", "Country", 100]];

export default function EventLocationFields({ form, onChange, enabled, disabled, coordinatesEnabled, onSelectPlace, combined = false }) {
  if (!enabled && !combined) return null;
  const selectedPlace = combined && form.latitude != null && form.longitude != null;
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className={combined ? "sr-only" : "font-semibold text-gray-900"}>Location details</legend>
    {combined && !selectedPlace && <PlaceSearch id="location" label="Venue or address" value={form.location}
      required disabled={disabled} lookupEnabled={coordinatesEnabled} lookupLabel="Find a place"
      placeholder="Enter a venue or address"
      onQueryChange={value => onChange({ target: { name: "location", value } })}
      onSelect={place => onSelectPlace({
        location: place.label.slice(0, 255), latitude: place.latitude, longitude: place.longitude, place_label: place.label,
        address: "", city: "", postcode: "", country: "",
      })} />}
    {enabled && !selectedPlace && <details open={combined ? undefined : true}>
      <summary className="cursor-pointer text-sm font-semibold">
        {combined ? "Enter address manually" : "Add address details"}
      </summary>
    <p className="text-sm text-gray-600">Add an address to help people find the event. These details appear publicly.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([name, label, limit]) => <div key={name}>
        <label htmlFor={name} className="block text-sm font-semibold text-gray-900">{label}</label>
        <input id={name} name={name} value={form[name] ?? ""} onChange={onChange}
          maxLength={limit} type="text"
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm" />
      </div>)}
    </div>
    </details>}
    {coordinatesEnabled && !combined && <div className="space-y-3 border-t border-gray-200 pt-4">
      <PlaceSearch id="event-map-place" label="Find event map location" disabled={disabled}
        onSelect={place=>onSelectPlace({latitude:place.latitude,longitude:place.longitude,place_label:place.label})} />
      {form.latitude != null && form.longitude != null ? <>
        <p role="status" className="text-sm text-gray-700">Selected map location: {form.place_label || `${form.latitude}, ${form.longitude}`}</p>
        <p className="text-xs text-gray-500">Choose a venue result for accurate distance estimates; a city result uses its centre.</p>
        <button type="button" onClick={()=>onSelectPlace({latitude:null,longitude:null,place_label:null})}
          className="text-sm text-blue-700 underline">Remove map location</button>
      </> : <p role="status" className="text-sm text-gray-600">No map location selected. This event will not appear in radius searches.</p>}
    </div>}
    {selectedPlace && <div className="space-y-2 text-sm">
      <p className="font-semibold text-gray-900">Venue or address</p>
      <p role="status">{form.place_label || form.location}</p>
      <button type="button" onClick={() => onSelectPlace({ latitude: null, longitude: null, place_label: null })}
        className="text-blue-700 underline">Enter address manually</button>
    </div>}
  </fieldset>;
}
