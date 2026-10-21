
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [createdEvents, setCreatedEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [createdLoading, setCreatedLoading] = useState(true);

  const [error, setError] = useState("");
  const [createdError, setCreatedError] = useState("");

  const [cancellingEventId, setCancellingEventId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchRegisteredEvents() {
      const token = sessionStorage.getItem("token");

      if (!user || !token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5001/api/users/me/events",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load your registered events."
          );
        }

        if (!cancelled) {
          setEvents(data);
          setError("");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching registered events:", error);
          setError(error.message || "Something went wrong.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRegisteredEvents();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // NEW: Fetch events created by the logged-in user.
  useEffect(() => {
    let cancelled = false;

    async function fetchCreatedEvents() {
      const token = sessionStorage.getItem("token");

      if (!user || !token) {
        setCreatedLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5001/api/users/me/created-events",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to load your created events."
          );
        }

        if (!cancelled) {
          setCreatedEvents(data);
          setCreatedError("");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching created events:", error);
          setCreatedError(error.message || "Something went wrong.");
        }
      } finally {
        if (!cancelled) {
          setCreatedLoading(false);
        }
      }
    }

    fetchCreatedEvents();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function handleCancelRegistration(eventId) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel your registration for this event?"
    );

    if (!confirmed) return;

    const token = sessionStorage.getItem("token");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setCancellingEventId(eventId);
    setError("");
    setActionMessage("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/events/${eventId}/register`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to cancel registration."
        );
      }

      setEvents((previousEvents) =>
        previousEvents.filter((event) => event.id !== eventId)
      );

      setActionMessage("Your event registration has been cancelled.");
    } catch (error) {
      console.error("Error cancelling registration:", error);
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setCancellingEventId(null);
    }
  }

  function formatDate(dateString) {
    const [year, month, day] = String(dateString)
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

  if (!user) {
    return (
      <>
        <Header />

        <main className="min-h-screen bg-gray-50 px-6 py-16">
          <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Your Profile
            </h1>

            <p className="mt-4 text-gray-600">
              Please log in to view your profile and registered events.
            </p>

            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Log In
            </Link>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Your Profile
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your account and community activities.
            </p>
          </div>

          {/* Account Details */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Account Details
                </h2>

                <p className="mt-4 text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{user.name}</p>

                <p className="mt-3 text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Log Out
              </button>
            </div>
          </section>

          {/* Registered Events */}
          <section className="mt-10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                My Registered Events
              </h2>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                {events.length} {events.length === 1 ? "event" : "events"}
              </span>
            </div>

            {actionMessage && (
              <p
                className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
                role="status"
              >
                {actionMessage}
              </p>
            )}

            {loading && (
              <p
                className="rounded-xl bg-white p-6 text-gray-600"
                role="status"
              >
                Loading your events...
              </p>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-white p-6">
                <p className="text-red-600" role="alert">
                  {error}
                </p>
              </div>
            )}

            {!loading && !error && events.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-gray-600">
                  You haven't registered for any events yet.
                </p>

                <Link
                  to="/events"
                  className="mt-5 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Explore Events
                </Link>
              </div>
            )}

            {!loading && !error && events.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                {events.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="text-xl font-bold text-gray-900">
                      {event.title}
                    </h3>

                    <p className="mt-3 text-sm text-gray-600">
                      <strong>Date:</strong> {formatDate(event.date)}
                    </p>

                    <p className="mt-2 text-sm text-gray-600">
                      <strong>Time:</strong> {formatTime(event.time)}
                    </p>

                    <p className="mt-2 text-sm text-gray-600">
                      <strong>Location:</strong> {event.location}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-4">
                      <Link
                        to={`/events/${event.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View Event →
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleCancelRegistration(event.id)}
                        disabled={cancellingEventId !== null}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingEventId === event.id
                          ? "Cancelling..."
                          : "Cancel Registration"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* NEW: Created Events */}
          <section className="mt-12">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                My Created Events
              </h2>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                {createdEvents.length}{" "}
                {createdEvents.length === 1 ? "event" : "events"}
              </span>
            </div>

            {createdLoading && (
              <p className="rounded-xl bg-white p-6 text-gray-600" role="status">
                Loading your created events...
              </p>
            )}

            {!createdLoading && createdError && (
              <div className="rounded-xl border border-red-200 bg-white p-6">
                <p className="text-red-600" role="alert">
                  {createdError}
                </p>
              </div>
            )}

            {!createdLoading &&
              !createdError &&
              createdEvents.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                  <p className="text-gray-600">
                    You haven't created any events yet.
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Organise an event and bring your community together.
                  </p>
                </div>
              )}

            {!createdLoading &&
              !createdError &&
              createdEvents.length > 0 && (
                <div className="grid gap-5 md:grid-cols-2">
                  {createdEvents.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                    >
                      <h3 className="text-xl font-bold text-gray-900">
                        {event.title}
                      </h3>

                      <p className="mt-3 text-sm text-gray-600">
                        <strong>Date:</strong> {formatDate(event.date)}
                      </p>

                      <p className="mt-2 text-sm text-gray-600">
                        <strong>Time:</strong> {formatTime(event.time)}
                      </p>

                      <p className="mt-2 text-sm text-gray-600">
                        <strong>Location:</strong> {event.location}
                      </p>

                      <div className="mt-5 flex flex-wrap items-center gap-4">
                        <Link
                          to={`/events/${event.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View Event →
                        </Link>

                        <Link
                          to={`/events/${event.id}/edit`}
                          className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          Edit Event
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default Profile;
