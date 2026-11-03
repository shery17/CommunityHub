import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EventCard from "./EventCard";
import useEventClock from "../useEventClock";
import { eventAvailability } from "../eventDisplay";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const now = useEventClock();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("http://localhost:5001/api/events?page=1&page_size=3", { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load upcoming events.");
        const data = await response.json();
        if (!controller.signal.aborted) setEvents(data.events);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message || "Unable to load upcoming events.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);
  const upcoming = events.filter(event => {
    const status = eventAvailability(event, now);
    return status.lifecycle ? status.lifecycle === "upcoming" : status.registrationOpen;
  }).slice(0, 3);
  return (
    <section id="events" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Upcoming Events</h2>
          <p className="mt-3 text-gray-600">Discover what's happening in your local community.</p>
        </div>
        {loading && <p role="status" className="text-gray-600">Loading upcoming events...</p>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!loading && !error && upcoming.length === 0 && <p className="text-gray-600">No upcoming events are available right now.</p>}
        {!loading && !error && <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map(event => <EventCard key={event.id} event={event} now={now} />)}
        </div>}
        <Link to="/events" className="mt-8 inline-block font-semibold text-blue-600 hover:text-blue-800">Browse all events →</Link>
      </div>
    </section>
  );
}
export default Events;
