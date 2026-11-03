import EventRadiusFilter from "../components/EventRadiusFilter";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import EventCard from "../components/EventCard";
import Footer from "../components/Footer";
import { eventAvailability } from "../eventDisplay";
import useEventClock from "../useEventClock";
import { readEventListParams, changeEventListParams } from "../eventListParams";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const { q: searchTerm, location, date: selectedDate, status, category, pricing, availability, page_size: pageSize } = readEventListParams(searchParams);
  const [requestQuery, setRequestQuery] = useState(queryString);
  const [loadedQuery, setLoadedQuery] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [multiDay, setMultiDay] = useState(false);
  const [categories, setCategories] = useState([]);
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [coordinatesEnabled, setCoordinatesEnabled] = useState(false);
  const now = useEventClock();
  const isLoading = loading || requestQuery !== queryString || loadedQuery !== requestQuery;

  useEffect(() => {
    if (requestQuery === queryString) return;
    const previous = new URLSearchParams(requestQuery);
    const next = new URLSearchParams(queryString);
    const textChanged = previous.get("q") !== next.get("q") || previous.get("location") !== next.get("location");
    const timer = setTimeout(() => setRequestQuery(queryString), textChanged ? 300 : 0);
    return () => clearTimeout(timer);
  }, [queryString, requestQuery]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchEvents() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams(requestQuery);
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
          setLoadedQuery(requestQuery);
        }
      }
    }

    fetchEvents();
    return () => controller.abort();
  }, [requestQuery]);

  const visibleEvents = events.filter((event) => {
    const availability = eventAvailability(event, now);
    const lifecycle = availability.lifecycle;
    return lifecycle ? status === "all" || lifecycle === status : status !== "upcoming" || availability.registrationOpen;
  });

  const hasActiveFilters = queryString !== "";
  const outOfRange = pagination && pagination.total > 0 && pagination.page > pagination.total_pages;
  const sizeOptions = [...new Set([3, 12, 24, 48,
    ...(/^[1-9]\d*$/.test(pageSize) && Number(pageSize) <= 100 ? [Number(pageSize)] : [])])].sort((a, b) => a - b);

  function changeFilters(changes, replace = false) {
    setSearchParams(current => changeEventListParams(current, changes), { replace });
  }

  function changePage(page) {
    setSearchParams(current => changeEventListParams(current, { page }, { resetPage: false }));
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams());
    setRequestQuery("");
  }

  return (
    <>
      <Header />

      <main>
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Community Events
              </h1>

              <p className="mt-4 text-lg leading-8 text-gray-600">
                Discover events happening in your local community and find
                something you would like to get involved with.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-10">
                <div className="grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div>
                    <label
                      htmlFor="event-search"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Keyword
                    </label>

                    <input
                      id="event-search"
                      type="search"
                      maxLength={200}
                      value={searchTerm}
                      onChange={(event) =>
                        changeFilters({ q: event.target.value }, true)
                      }
                      placeholder="Search title or description..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label htmlFor="event-location" className="mb-2 block text-sm font-semibold text-gray-700">Location or city</label>
                    <input id="event-location" type="search" value={location} maxLength={255}
                      onChange={event => changeFilters({ location: event.target.value }, true)} placeholder="e.g. Leeds"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>

                  <div>
                    <label
                      htmlFor="event-date"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Date (event local time)
                    </label>

                    <input
                      id="event-date"
                      type="date"
                      value={selectedDate}
                      onChange={(event) =>
                        changeFilters({ date: event.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="event-status" className="mb-2 block text-sm font-semibold text-gray-700">Event status</label>
                    <select id="event-status" value={status} onChange={event => changeFilters({ status: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500">
                      <option value="upcoming">Upcoming</option>
                      {multiDay && <><option value="ongoing">Ongoing</option><option value="past">Past</option></>}
                      <option value="all">All events</option>
                    </select>
                  </div>
                  {categories.length > 0 && <div>
                    <label htmlFor="event-category" className="mb-2 block text-sm font-semibold text-gray-700">Category</label>
                    <select id="event-category" value={category} onChange={event => changeFilters({ category: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500">
                      <option value="">All categories</option>
                      {categories.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>}
                  <div>
                    <label htmlFor="event-availability" className="mb-2 block text-sm font-semibold text-gray-700">Availability</label>
                    <select id="event-availability" value={availability} onChange={event => changeFilters({ availability: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500">
                      <option value="all">Any availability</option>
                      <option value="joinable">Open with space</option>
                    </select>
                  </div>
                  {pricingEnabled && <div>
                    <label htmlFor="event-pricing" className="mb-2 block text-sm font-semibold text-gray-700">Pricing</label>
                    <select id="event-pricing" value={pricing} onChange={event => changeFilters({ pricing: event.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500">
                      <option value="all">All prices</option><option value="free">Free</option><option value="paid">Paid</option>
                    </select>
                  </div>}
                </div>

                {coordinatesEnabled && <EventRadiusFilter params={searchParams} onChange={changeFilters} />}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
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
                <button type="button" onClick={() => changePage(1)} className="mt-4 font-semibold text-blue-600">Go to first page</button>
              </div>
            )}

            {!isLoading && !error && !outOfRange && events.length === 0 && (
              <p className="text-center text-gray-600">
                {hasActiveFilters ? "No events match your filters." : "No upcoming events are available right now."}
              </p>
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
                    className="mt-4 font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Clear Filters
                  </button>
                </div>
              )}

            {!isLoading && !error && visibleEvents.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibleEvents.map((event) => (
                  <EventCard key={event.id} event={event} now={now} />
                ))}
              </div>
            )}

            {!isLoading && !error && pagination && pagination.total_pages > 0 && !outOfRange && (
              <nav aria-label="Event pages" className="mt-8 flex flex-wrap items-center justify-center gap-5">
                <button type="button" disabled={!pagination.has_previous} onClick={() => changePage(pagination.page - 1)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-blue-600 disabled:cursor-not-allowed disabled:text-gray-400">Previous</button>
                <p role="status" className="text-sm text-gray-600">Page {pagination.page} of {pagination.total_pages}</p>
                <button type="button" disabled={!pagination.has_next} onClick={() => changePage(pagination.page + 1)}
                  className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-blue-600 disabled:cursor-not-allowed disabled:text-gray-400">Next</button>
              </nav>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Events;
