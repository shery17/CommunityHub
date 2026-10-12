import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

function EventDetails() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError("");
      setEvent(null);

      try {
        const response = await fetch(
          `http://localhost:5001/api/events/${id}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Event not found.");
          }

          throw new Error("Failed to load event.");
        }

        const data = await response.json();
        setEvent(data);
      } catch (error) {
        console.error("Error fetching event:", error);
        setError(error.message || "Unable to load this event.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [id]);

  function formatDate(dateString) {
    const [year, month, day] = dateString
      .slice(0, 10)
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
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

      <main className="min-h-screen bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Link
            to="/events"
            className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to Events
          </Link>

          {loading && (
            <p className="mt-8 text-gray-600" role="status">
              Loading event...
            </p>
          )}

          {!loading && error && (
            <div className="mt-8 rounded-xl border border-red-200 bg-white p-6">
              <p className="text-red-600" role="alert">
                {error}
              </p>

              <Link
                to="/events"
                className="mt-4 inline-block font-semibold text-blue-600 hover:text-blue-800"
              >
                Browse all events
              </Link>
            </div>
          )}

          {!loading && !error && event && (
            <article className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex h-48 items-center justify-center bg-blue-50 sm:h-64">
                <span className="text-6xl" aria-hidden="true">
                  📅
                </span>
              </div>

              <div className="p-6 sm:p-10">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  {event.title}
                </h1>

                <div className="mt-6 space-y-4 text-gray-600">
                  <p>
                    <span className="mr-2" aria-hidden="true">📅</span>
                    <strong className="text-gray-900">Date:</strong>{" "}
                    {formatDate(event.date)}
                  </p>

                  <p>
                    <span className="mr-2" aria-hidden="true">🕐</span>
                    <strong className="text-gray-900">Time:</strong>{" "}
                    {formatTime(event.time)}
                  </p>

                  <p>
                    <span className="mr-2" aria-hidden="true">📍</span>
                    <strong className="text-gray-900">Location:</strong>{" "}
                    {event.location}
                  </p>
                </div>

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    About This Event
                  </h2>

                  <p className="mt-3 leading-7 text-gray-600">
                    {event.description}
                  </p>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

export default EventDetails;
