import { useEffect, useState } from "react";
import Header from "../components/Header";
import EventCard from "../components/EventCard";
import Footer from "../components/Footer";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            {loading && (
              <p className="text-center text-gray-600">
                Loading events...
              </p>
            )}

            {error && (
              <p className="text-center text-red-600">
                {error}
              </p>
            )}

            {!loading && !error && events.length === 0 && (
              <p className="text-center text-gray-600">
                No events are available right now.
              </p>
            )}

            {!loading && !error && events.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    id={event.id}
                    title={event.title}
                    date={formatDate(event.date)}
                    time={formatTime(event.time)}
                    location={event.location}
                    description={event.description}
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