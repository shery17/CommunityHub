import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

function EventDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [registered, setRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isOwner =
    user && event && Number(event.created_by) === Number(user.id);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      setLoading(true);
      setError("");
      setEvent(null);

      try {
        const response = await fetch(
          `http://localhost:5001/api/events/${id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              (response.status === 404
                ? "Event not found."
                : "Failed to load event.")
          );
        }

        if (!cancelled) {
          setEvent(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching event:", error);
          setError(error.message || "Unable to load this event.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function checkRegistration() {
      const token = sessionStorage.getItem("token");

      setRegistered(false);
      setRegistrationMessage("");
      setRegistrationError("");

      if (!user || !token) {
        setCheckingRegistration(false);
        return;
      }

      setCheckingRegistration(true);

      try {
        const response = await fetch(
          `http://localhost:5001/api/events/${id}/registration`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to check registration status."
          );
        }

        if (!cancelled) {
          setRegistered(data.registered);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error checking registration:", error);
          setRegistrationError(
            error.message || "Unable to check registration status."
          );
        }
      } finally {
        if (!cancelled) {
          setCheckingRegistration(false);
        }
      }
    }

    checkRegistration();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  async function handleRegister() {
    const token = sessionStorage.getItem("token");

    if (!token) {
      setRegistrationError("Please log in to register for this event.");
      return;
    }

    setRegistering(true);
    setRegistrationMessage("");
    setRegistrationError("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/events/${id}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (response.status === 409) {
        setRegistered(true);
        throw new Error("You are already registered for this event.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to register for this event."
        );
      }

      setRegistered(true);
      setEvent((previousEvent) =>
        previousEvent
          ? {
              ...previousEvent,
              attendee_count: Number(previousEvent.attendee_count ?? 0) + 1,
            }
          : previousEvent
      );
      setRegistrationMessage(
        "You're registered! We look forward to seeing you."
      );
    } catch (error) {
      console.error("Error registering for event:", error);
      setRegistrationError(
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleDeleteEvent() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event.title}"? This will also remove all registrations for this event.`
    );

    if (!confirmed) return;

    const token = sessionStorage.getItem("token");

    if (!token) {
      setDeleteError("Your session has expired. Please log in again.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/events/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete this event.");
      }

      navigate("/events", {
        replace: true,
        state: { message: "Event deleted successfully." },
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      setDeleteError(
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

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

                  <p>
                    <span className="mr-2" aria-hidden="true">👥</span>
                    <strong className="text-gray-900">Attendees:</strong>{" "}
                    {Number(event.attendee_count ?? 0)}{" "}
                    {Number(event.attendee_count ?? 0) === 1
                      ? "person attending"
                      : "people attending"}
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

                {isOwner && (
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-bold text-gray-900">
                      Manage Your Event
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        to={`/events/${event.id}/edit`}
                        className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
                      >
                        Edit Event
                      </Link>

                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        disabled={deleting}
                        className="rounded-lg border border-red-200 px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting ? "Deleting..." : "Delete Event"}
                      </button>
                    </div>

                    {deleteError && (
                      <p className="mt-4 text-sm text-red-600" role="alert">
                        {deleteError}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Join This Event
                  </h2>

                  {!user ? (
                    <div className="mt-4">
                      <p className="text-gray-600">
                        Log in to register and take part in this event.
                      </p>

                      <Link
                        to="/login"
                        className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Log In to Register
                      </Link>
                    </div>
                  ) : checkingRegistration ? (
                    <p className="mt-4 text-gray-600" role="status">
                      Checking your registration...
                    </p>
                  ) : registered ? (
                    <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 font-medium text-green-800">
                      ✓ You're registered for this event!
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={registering}
                      className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {registering ? "Registering..." : "Register for Event"}
                    </button>
                  )}

                  {registrationMessage && (
                    <p className="mt-4 text-sm text-green-700" role="status">
                      {registrationMessage}
                    </p>
                  )}

                  {registrationError && (
                    <p className="mt-4 text-sm text-red-600" role="alert">
                      {registrationError}
                      {registrationError.includes("session has expired") && (
                        <>
                          {" "}
                          <Link
                            to="/login"
                            className="font-semibold underline"
                          >
                            Log in again
                          </Link>
                        </>
                      )}
                    </p>
                  )}
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
