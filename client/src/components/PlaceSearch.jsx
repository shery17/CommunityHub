import { useEffect, useRef, useState } from "react";

export default function PlaceSearch({ id, label, onSelect, disabled, value, onQueryChange, required = false, lookupEnabled = true, lookupLabel = "Find places", placeholder = "e.g. Leeds, United Kingdom", compact = false, floating = false }) {
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
  return <div className={floating ? "relative" : compact ? "space-y-1" : "space-y-3"}
    onBlur={floating ? event => { if (!event.currentTarget.contains(event.relatedTarget)) setPlaces([]); } : undefined}
    onKeyDown={floating ? event => {
      if (event.key === "Escape" && places.length) {
        event.stopPropagation();
        setPlaces([]);
        event.currentTarget.querySelector("input")?.focus();
      }
    } : undefined}>
    <label htmlFor={id} className={compact ? "block text-xs font-semibold text-slate-900" : "block text-sm font-semibold text-gray-900"}>{label}</label>
    <div className={compact ? "mt-1 flex items-center gap-2" : "flex gap-2"}>
      <input id={id} type="search" maxLength={255} value={query} disabled={disabled} required={required}
        placeholder={placeholder} className={compact ? "min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700" : "min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"}
        onChange={event=> { request.current?.abort(); setLoading(false); setQuery(event.target.value); onQueryChange?.(event.target.value); setPlaces([]); setError(""); setSearched(false); }}
        onKeyDown={event=> { if (event.key==="Enter" && lookupEnabled) { event.preventDefault(); if (lookupEnabled && !disabled && !loading && query.trim().length>=2) search(); } }} />
      {lookupEnabled && <button type="button" onClick={search} disabled={disabled || loading || query.trim().length<2}
        className={compact ? "shrink-0 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline disabled:opacity-50" : "rounded-lg border border-brand-600 px-3 py-2 text-brand-700 disabled:opacity-50"}>{loading ? "Finding…" : lookupLabel}</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {searched && places.length===0 && <p role="status" className="text-sm text-gray-600">No places found. Try adding a city or country.</p>}
    {places.length>0 && <ul aria-label="Place results" className={floating
      ? "absolute top-full left-0 z-20 mt-4 max-h-64 w-80 max-w-[80vw] overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
      : "space-y-2"}>
      {places.map((place,index)=><li key={`${place.latitude},${place.longitude},${index}`}>
        <button type="button" disabled={disabled} className="w-full rounded-lg p-2 text-left text-sm text-slate-800 hover:bg-slate-100"
          onClick={()=> { onSelect(place); setPlaces([]); setSearched(false); }}>{place.label}</button>
      </li>)}
    </ul>}
  </div>;
}
