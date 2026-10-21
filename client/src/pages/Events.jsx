
import { useEffect, useState } from "react";
import Header from "../components/Header";
import EventCard from "../components/EventCard";
import Footer from "../components/Footer";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch(
          "http://localhost:5001/api/events"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch events.");
        }

        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error("Error fetching events:", error);
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const filteredEvents = events.filter((event) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      event.title.toLowerCase().includes(search) ||
      event.location.toLowerCase().includes(search);

    const eventDate = String(event.date).slice(0, 10);

    const matchesDate =
      selectedDate === "" || eventDate === selectedDate;

    return matchesSearch && matchesDate;
  });

  const hasActiveFilters =
    searchTerm.trim() !== "" || selectedDate !== "";

  function clearFilters() {
    setSearchTerm("");
    setSelectedDate("");
  }

  function formatDate(dateString) {
    const dateOnly = dateString.slice(0, 10);
    const [year, month, day] = dateOnly.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatTime(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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
            {!loading && !error && (
              <div className="mb-10">
                <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="event-search"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Search Events
                    </label>

                    <input
                      id="event-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                      placeholder="Search by title or location..."
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-date"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Filter by Date
                    </label>

                    <input
                      id="event-date"
                      type="date"
                      value={selectedDate}
                      onChange={(event) =>
                        setSelectedDate(event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p
                    className="text-sm text-gray-500"
                    role="status"
                  >
                    {filteredEvents.length}{" "}
                    {filteredEvents.length === 1
                      ? "event"
                      : "events"}{" "}
                    found
                  </p>

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
            )}

            {loading && (
              <p className="text-center text-gray-600" role="status">
                Loading events...
              </p>
            )}

            {error && (
              <p className="text-center text-red-600" role="alert">
                {error}
              </p>
            )}

            {!loading && !error && events.length === 0 && (
              <p className="text-center text-gray-600">
                No events are available right now.
              </p>
            )}

            {!loading &&
              !error &&
              events.length > 0 &&
              filteredEvents.length === 0 && (
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

            {!loading && !error && filteredEvents.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    id={event.id}
                    title={event.title}
                    date={formatDate(event.date)}
                    time={formatTime(event.time)}
                    location={event.location}
                    description={event.description}
                    attendeeCount={event.attendee_count}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Events;
