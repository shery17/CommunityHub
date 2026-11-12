import BrowseSearch from "../components/BrowseSearch";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import EventCard from "../components/EventCard";
import Footer from "../components/Footer";
import { eventAvailability } from "../eventDisplay";
import useEventClock from "../useEventClock";
import { readEventListParams, changeEventListParams, clearOrigin } from "../eventListParams";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const { q: searchTerm, location, date: selectedDate, status, category, pricing, availability, page_size: pageSize } = readEventListParams(searchParams);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchDialog = useRef(null);
  const [loadedQuery, setLoadedQuery] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [multiDay, setMultiDay] = useState(false);
  const [categories, setCategories] = useState([]);
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [coordinatesEnabled, setCoordinatesEnabled] = useState(false);
  const now = useEventClock();
  const isLoading = loading || loadedQuery !== queryString;

  useEffect(() => {
    const controller = new AbortController();
    async function fetchEvents() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams(queryString);
        if (!params.has("page")) params.set("page", "1");
        if (!params.has("page_size")) params.set("page_size", "12");
        const [response, configResponse] = await Promise.all([
          fetch(`http://localhost:5001/api/events?${params}`, { signal: controller.signal }),
          fetch("http://localhost:5001/api/events/config", { signal: controller.signal }),
        ]);

        const data = await response.json();
        const config = await configResponse.json();
        if (!response.ok) throw new Error(data.message || "Failed to fetch events.");
        if (!configResponse.ok) throw new Error("Unable to load event filters.");
        if (!controller.signal.aborted) {
          setEvents(data.events);
          setPagination(data.pagination);
          setMultiDay(config.multi_day);
          setCategories(config.categories ?? []);
          setPricingEnabled(Boolean(config.pricing));
          setCoordinatesEnabled(Boolean(config.coordinates));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching events:", error);
        setError(error.message || "Unable to load events. Please try again later.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadedQuery(queryString);
        }
      }
    }

    fetchEvents();
    return () => controller.abort();
  }, [queryString]);

  const visibleEvents = events.filter((event) => {
    const availability = eventAvailability(event, now);
    const lifecycle = availability.lifecycle;
    return lifecycle ? status === "all" || lifecycle === status : status !== "upcoming" || availability.registrationOpen;
  });

  const origin = searchParams.get("origin_label");
  const hasOrigin = searchParams.has("origin_lat") || searchParams.has("origin_lon");
  const radius = searchParams.get("radius") ?? "10";
  const chips = [
    searchTerm && { label: `Keyword: ${searchTerm}`, reset: { q: "" } },
    location && { label: `Location: ${location}`, reset: { location: "" } },
    (hasOrigin || searchParams.has("radius") || origin) && {
      label: `Near ${origin || "selected place"} · ${radius === "all" ? "Any distance" : radius + " miles"}`,
      reset: clearOrigin,
    },
    selectedDate && { label: `Date: ${selectedDate}`, reset: { date: "" } },
    category && { label: category, reset: { category: "" } },
    pricing !== "all" && { label: pricing === "free" ? "Free" : "Paid", reset: { pricing: "all" } },
    availability !== "all" && { label: "Open with space", reset: { availability: "all" } },
    status !== "upcoming" && { label: { all: "All events", ongoing: "Ongoing", past: "Past" }[status] ?? status, reset: { status: "upcoming" } },
  ].filter(Boolean);

  const hasActiveFilters = queryString !== "";
  const outOfRange = pagination && pagination.total > 0 && pagination.page > pagination.total_pages;
  const sizeOptions = [...new Set([3, 12, 24, 48,
    ...(/^[1-9]\d*$/.test(pageSize) && Number(pageSize) <= 100 ? [Number(pageSize)] : [])])].sort((a, b) => a - b);

  function changeFilters(changes) {
    setSearchParams(current => changeEventListParams(current, changes));
  }

  function changePage(page) {
    setSearchParams(current => changeEventListParams(current, { page }, { resetPage: false }));
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams());
  }

  return (
    <>
      <Header />

      <main>
        <section className="mx-auto max-w-[1440px] px-5 pt-7 pb-12 sm:px-8 lg:px-12">
          <div className="mb-7 border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Browse events</h1>
            <div className="mt-5 hidden max-w-5xl md:block">
              <BrowseSearch key={queryString} params={searchParams} onApply={setSearchParams}
                categories={categories} pricingEnabled={pricingEnabled} coordinatesEnabled={coordinatesEnabled} multiDay={multiDay} />
            </div>
            <button type="button" aria-haspopup="dialog"
              onClick={() => { setMobileSearchOpen(true); searchDialog.current.showModal(); }}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm md:hidden">
              Search events
            </button>
            <dialog ref={searchDialog} aria-labelledby="browse-search-title" onClose={() => setMobileSearchOpen(false)}
              className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-white p-0 text-slate-900 backdrop:bg-slate-900/40">
              <div className="mx-auto max-w-lg px-5">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white py-4">
                  <h2 id="browse-search-title" className="text-xl font-semibold">Search events</h2>
                  <button type="button" onClick={() => searchDialog.current.close()}
                    className="min-h-10 rounded-full border border-slate-200 px-4 text-sm font-semibold">Close</button>
                </div>
                {mobileSearchOpen && <div className="pt-4">
                  <BrowseSearch mobile params={searchParams} onApply={params => {
                    setSearchParams(params);
                    searchDialog.current.close();
                  }} categories={categories} pricingEnabled={pricingEnabled} coordinatesEnabled={coordinatesEnabled} multiDay={multiDay} />
                </div>}
              </div>
            </dialog>

            {chips.length > 0 && <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2">
              {chips.map(({ label, reset }) => <li key={Object.keys(reset)[0]} className="min-w-0 max-w-full">
                <button type="button" onClick={() => changeFilters(reset)} aria-label={`Remove filter: ${label}`}
                  className="max-w-full break-words rounded-full border border-slate-200 px-3 py-1 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {label} <span aria-hidden="true">×</span>
                </button>
              </li>)}
            </ul>}

            {hasActiveFilters && <button type="button" onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
              Clear filters
            </button>}
          </div>

          {isLoading && (
            <p className="text-center text-gray-600" role="status">
              Loading events...
            </p>
          )}

          {!isLoading && error && (
            <p className="text-center text-red-600" role="alert">
              {error}
            </p>
          )}

          {!isLoading && !error && outOfRange && (
            <div className="text-center">
              <p role="status" className="text-gray-600">This page is unavailable. There are {pagination.total_pages} pages of matching events.</p>
              <button type="button" onClick={() => changePage(1)} className="mt-4 font-semibold text-brand-600">Go to first page</button>
            </div>
          )}

          {!isLoading && !error && !outOfRange && events.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-gray-600">
                {hasActiveFilters ? "No events match your filters." : "No upcoming events are available right now."}
              </p>
              {status === "upcoming" && <button type="button" onClick={() => changeFilters({ status: "all" })}
                className="secondary-action mt-4">Show all events</button>}
            </div>
          )}

          {!isLoading &&
            !error &&
            events.length > 0 &&
            visibleEvents.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-gray-600">
                  No events match your filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 font-semibold text-brand-600 hover:text-brand-800"
                >
                  Clear Filters
                </button>
              </div>
            )}

          {!isLoading && !error && visibleEvents.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
              {visibleEvents.map((event) => (
                <EventCard key={event.id} event={event} now={now} />
              ))}
            </div>
          )}

          {!isLoading && !error && pagination && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p
                className="text-sm text-gray-500"
                role="status"
              >
                {!isLoading && !error && pagination ? <>{pagination.total}{" "}
                {pagination.total === 1
                  ? "event"
                  : "events"}{" "}
                found</> : ""}
              </p>

              <div className="flex items-center gap-3">
                <label htmlFor="event-page-size" className="text-sm font-semibold text-gray-700">Events per page</label>
                <select id="event-page-size" value={pageSize} onChange={event => changeFilters({ page_size: event.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {sizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
            </div>
          )}

          {!isLoading && !error && pagination && pagination.total_pages > 0 && !outOfRange && (
            <nav aria-label="Event pages" className="mt-8 flex flex-wrap items-center justify-center gap-5">
              <button type="button" disabled={!pagination.has_previous} onClick={() => changePage(pagination.page - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-brand-600 disabled:cursor-not-allowed disabled:text-gray-400">Previous</button>
              <p role="status" className="text-sm text-gray-600">Page {pagination.page} of {pagination.total_pages}</p>
              <button type="button" disabled={!pagination.has_next} onClick={() => changePage(pagination.page + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-brand-600 disabled:cursor-not-allowed disabled:text-gray-400">Next</button>
            </nav>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Events;
