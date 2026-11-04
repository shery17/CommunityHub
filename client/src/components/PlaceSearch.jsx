import { useEffect, useRef, useState } from "react";

export default function PlaceSearch({ id, label, onSelect, disabled, value, onQueryChange, lookupEnabled = true, lookupLabel = "Find places", placeholder = "e.g. Leeds, United Kingdom" }) {
  const [draft,setQuery]=useState("");
  const query = value ?? draft;
  const [places,setPlaces]=useState([]);
  const [error,setError]=useState("");
  const [searched,setSearched]=useState(false);
  const [loading,setLoading]=useState(false);
  const request=useRef(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function search() {
    request.current?.abort();
    const controller=new AbortController(); request.current=controller;
    setLoading(true); setError(""); setPlaces([]); setSearched(false);
    try {
      const response=await fetch(`http://localhost:5001/api/places?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});
      const data=await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to find places.");
      if (!controller.signal.aborted) { setPlaces(data.places); setSearched(true); }
    } catch(error) { if (!controller.signal.aborted) setError(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <div className="space-y-3">
    <label htmlFor={id} className="block text-sm font-semibold text-gray-900">{label}</label>
    <div className="flex gap-2">
      <input id={id} type="search" maxLength={255} value={query} disabled={disabled}
        placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"
        onChange={event=> { request.current?.abort(); setLoading(false); setQuery(event.target.value); onQueryChange?.(event.target.value); setPlaces([]); setError(""); setSearched(false); }}
        onKeyDown={event=> { if (event.key==="Enter") { event.preventDefault(); if (lookupEnabled && !disabled && !loading && query.trim().length>=2) search(); } }} />
      {lookupEnabled && <button type="button" onClick={search} disabled={disabled || loading || query.trim().length<2}
        className="rounded-lg border border-blue-600 px-3 py-2 text-blue-700 disabled:opacity-50">{loading ? "Finding…" : lookupLabel}</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {searched && places.length===0 && <p role="status" className="text-sm text-gray-600">No places found. Try adding a city or country.</p>}
    {places.length>0 && <ul aria-label="Place results" className="space-y-2">
      {places.map((place,index)=><li key={`${place.latitude},${place.longitude},${index}`}>
        <button type="button" disabled={disabled} className="w-full rounded border border-gray-200 p-2 text-left text-sm text-blue-700"
          onClick={()=> { onSelect(place); setPlaces([]); setSearched(false); }}>{place.label}</button>
      </li>)}
    </ul>}
  </div>;
}
