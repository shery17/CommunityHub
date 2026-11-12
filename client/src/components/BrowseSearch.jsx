import { useState } from "react";
import EventRadiusFilter from "./EventRadiusFilter";
import { changeEventListParams, readEventListParams } from "../eventListParams";

const labelStyle = "block text-xs font-semibold text-stone-900";
const inputStyle = "mt-1 block min-w-0 w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700";
const selectStyle = "mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export default function BrowseSearch({ params, onApply, mobile = false, categories, pricingEnabled, coordinatesEnabled, multiDay }) {
  const [draft, setDraft] = useState(() => new URLSearchParams(params));
  const { q, location, date, status, category, pricing, availability } = readEventListParams(draft);
  const prefix = mobile ? "mobile" : "desktop";

  function change(changes) {
    setDraft(current => changeEventListParams(current, changes));
  }

  function submit(event) {
    event.preventDefault();
    onApply(draft);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={mobile
        ? "space-y-4"
        : "relative grid grid-cols-[1fr_1.35fr_0.8fr_auto] items-start rounded-3xl border border-stone-200 bg-white shadow-sm"}>
        <div className={mobile ? "rounded-xl border border-stone-200 p-4" : "min-w-0 px-5 py-3.5"}>
          <label htmlFor={`${prefix}-event-search`} className={labelStyle}>Search events</label>
          <input id={`${prefix}-event-search`} type="search" maxLength={200} value={q}
            onChange={event => change({ q: event.target.value })} placeholder="Yoga, gardening, live music" className={inputStyle} />
        </div>
        <div className={mobile ? "rounded-xl border border-stone-200 p-4" : "min-w-0 border-l border-stone-200 px-5 py-3.5"}>
          <EventRadiusFilter params={draft} location={location} lookupEnabled={coordinatesEnabled} onChange={change}
            idPrefix={prefix} compact floating={!mobile} />
        </div>
        <div className={mobile ? "rounded-xl border border-stone-200 p-4" : "min-w-0 border-l border-stone-200 px-5 py-3.5"}>
          <label htmlFor={`${prefix}-event-date`} className={labelStyle}>Event date</label>
          <input id={`${prefix}-event-date`} type="date" value={date} onChange={event => change({ date: event.target.value })} className={inputStyle} />
        </div>
        {!mobile && <button type="submit" className="primary-action m-2.5">Search</button>}
      </div>

      <details className="group rounded-xl border border-stone-200 bg-white px-4 py-2.5 md:w-fit md:max-w-full">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">More filters</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelStyle}>Event status
            <select value={status} onChange={event => change({ status: event.target.value })} className={selectStyle}>
              <option value="upcoming">Upcoming</option>
              {multiDay && <><option value="ongoing">Ongoing</option><option value="past">Past</option></>}
              <option value="all">All events</option>
            </select>
          </label>
          {categories.length > 0 && <label className={labelStyle}>Category
            <select value={category} onChange={event => change({ category: event.target.value })} className={selectStyle}>
              <option value="">All categories</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>}
          <label className={labelStyle}>Availability
            <select value={availability} onChange={event => change({ availability: event.target.value })} className={selectStyle}>
              <option value="all">Any availability</option>
              <option value="joinable">Open with space</option>
            </select>
          </label>
          {pricingEnabled && <label className={labelStyle}>Pricing
            <select value={pricing} onChange={event => change({ pricing: event.target.value })} className={selectStyle}>
              <option value="all">All prices</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </label>}
        </div>
        {!mobile && <button type="submit" className="mt-4 text-sm font-semibold text-brand-700 underline underline-offset-4">Apply filters</button>}
      </details>

      {mobile && <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4">
        <button type="button" onClick={() => setDraft(new URLSearchParams(draft.has("page_size") ? { page_size: draft.get("page_size") } : {}))}
          className="text-sm font-semibold underline underline-offset-4">Clear filters</button>
        <button type="submit" className="primary-action">Show events</button>
      </div>}
    </form>
  );
}
