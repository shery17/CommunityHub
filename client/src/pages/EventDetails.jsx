import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import EventAttendees from "../components/EventAttendees";
import { coverPhotoUrl } from "../eventCoverPhoto";
import EventSchedule from "../components/EventSchedule";
import { eventAvailability } from "../eventDisplay";
import useEventClock from "../useEventClock";

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
  const [registrationState, setRegistrationState] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState(false);
  const [cancelEventError, setCancelEventError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const currentTime = useEventClock();

  const isOwner =
    user && event && Number(event.created_by) === Number(user.id);

  const displayEvent = event ? { ...event, ...(registrationState?.eventId === id ? registrationState : {}) } : null;
  const availability = eventAvailability(displayEvent, currentTime);
  const full = displayEvent?.capacity != null && displayEvent.attendee_count >= displayEvent.capacity;

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
      setRegistrationState(null);
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

        if (response.status === 401) {
          throw new Error("Your session has expired. Please log in again.");
        }

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to check registration status."
          );
        }

        if (!cancelled) {
          setRegistered(data.registered);
          setRegistrationState({ ...data, eventId: id });
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
        setRegistered(data.registered === true);
        setRegistrationState({ ...data, eventId: id });
        throw new Error(data.message || "Unable to register for this event.");
      }

      if (!response.ok) {
        if (data.code === "EVENT_CANCELLED") setRegistrationState({ ...data, eventId: id });
        else if (response.status === 403) setRegistrationState(previous => ({ ...previous, eventId: id, registration_open: false }));
        throw new Error(
          data.message || "Unable to register for this event."
        );
      }

      setRegistered(true);
      setRegistrationState({ ...data, eventId: id });
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

  async function handleCancelRegistration() {
    if (!window.confirm("Are you sure you want to cancel your registration for this event?")) return;
    const token = sessionStorage.getItem("token");
    if (!token) {
      setRegistrationError("Your session has expired. Please log in again.");
      return;
    }
    setCancelling(true);
    setRegistrationMessage("");
    setRegistrationError("");
    try {
      const response = await fetch(`http://localhost:5001/api/events/${id}/register`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (!response.ok) {
        if (data.code === "EVENT_CANCELLED") setRegistrationState({ ...data, eventId: id });
        else if (response.status === 403) setRegistrationState(previous => ({ ...previous, eventId: id, cancellation_open: false }));
        throw new Error(data.message || "Unable to cancel registration.");
      }
      setRegistered(false);
      setRegistrationState({ ...data, eventId: id });
      setRegistrationMessage("Your registration has been cancelled.");
    } catch (error) {
      setRegistrationError(error.message || "Unable to cancel registration.");
    } finally { setCancelling(false); }
  }

  async function handleCancelEvent() {
    if (!window.confirm("Cancel this event? Registration will close and existing sign-ups will be kept.")) return;
    setCancellingEvent(true);
    setCancelEventError("");
    try {
      const response = await fetch(`http://localhost:5001/api/events/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to cancel event.");
      setEvent(previous => ({ ...previous, ...data }));
      setRegistrationState(previous => ({ ...previous, ...data, eventId: id }));
    } catch (error) {
      setCancelEventError(error.message);
    } finally {
      setCancellingEvent(false);
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

  return (
    <>
      <Header />

      <main className="bg-white py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Link
            to="/events"
            className="inline-block text-sm font-semibold text-brand-600 hover:text-brand-800"
          >
            ← Browse events
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
                className="mt-4 inline-block font-semibold text-brand-600 hover:text-brand-800"
              >
                Browse all events
              </Link>
            </div>
          )}

          {!loading && !error && event && (
            <article className="mt-6">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{event.title}</h1>
              <p className="mt-2 break-words text-stone-600">{event.location}</p>
              {event.has_cover_photo && <img src={coverPhotoUrl(event.id)} alt="" decoding="async"
                className="mt-6 aspect-[16/9] max-h-[30rem] w-full rounded-2xl object-cover" />}

              <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-12">
                <div className="min-w-0">
                <div className="border-b border-stone-200 pb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    About this event
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-stone-700">
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
                        className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
                      >
                        Edit Event
                      </Link>

                      {Object.hasOwn(event, "cancelled_at") && !displayEvent.cancelled_at && <button
                        type="button" onClick={handleCancelEvent} disabled={cancellingEvent || deleting}
                        className="rounded-lg border border-red-200 px-5 py-2.5 font-semibold text-red-600 disabled:opacity-60">
                        {cancellingEvent ? "Cancelling event..." : "Cancel Event"}
                      </button>}
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        disabled={deleting || cancellingEvent}
                        className="rounded-lg border border-red-200 px-5 py-2.5 font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting ? "Deleting..." : "Delete Event"}
                      </button>
                    </div>

                    {String(event.id) === id && <EventAttendees key={`${id}:${user.id}`} eventId={id} />}

                    {cancelEventError && <p role="alert" className="mt-4 text-sm text-red-600">{cancelEventError}</p>}
                    {deleteError && (
                      <p className="mt-4 text-sm text-red-600" role="alert">
                        {deleteError}
                      </p>
                    )}
                  </div>
                )}

                  <section className="mt-6" aria-labelledby="event-information-heading">
                    <h2 id="event-information-heading" className="text-xl font-semibold text-stone-950">Event information</h2>
                    <EventSchedule event={displayEvent} now={currentTime} />
                  </section>
                </div>
                <aside className="self-start rounded-2xl border border-stone-200 p-5 sm:p-6 lg:sticky lg:top-6" aria-label="Event registration">
                  <h2 className="text-xl font-bold text-gray-900">
                    Registration
                  </h2>

                  {displayEvent.cancelled_at ? (
                    <p className="mt-4 text-gray-700" role="status">This event has been cancelled.{registered && " Your sign-up is kept in your history."}</p>
                  ) : checkingRegistration ? (
                    <p className="mt-4 text-gray-600" role="status">
                      Checking your registration...
                    </p>
                  ) : registered ? (
                    <div className="mt-4">
                      <p className="rounded-lg border border-green-200 bg-green-50 p-4 font-medium text-green-800">
                        You’re registered for this event.
                      </p>
                      {availability.cancellationOpen ? <button type="button" onClick={handleCancelRegistration}
                        disabled={cancelling || registering} className="mt-4 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600 disabled:opacity-60">
                        {cancelling ? "Cancelling..." : "Cancel Registration"}
                      </button> : <p className="mt-3 text-sm text-gray-600">This event has ended. Your attendance is kept in your history.</p>}
                    </div>
                  ) : !availability.registrationOpen ? (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-5" role="status">
                      <p className="font-semibold text-gray-900">
                        Registration closed
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        The registration deadline or event start has been reached. New registrations are no longer accepted.
                      </p>
                    </div>
                  ) : full ? (
                    <p className="mt-4 font-semibold text-gray-900" role="status">This event is full.</p>
                  ) : !user ? (
                    <div className="mt-4">
                      <p className="text-gray-600">
                        Log in to register and take part in this event.
                      </p>

                      <Link
                        to="/login"
                        className="primary-action mt-4 w-full"
                      >
                        Log In to Register
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={registering || cancelling || !registrationState}
                      className="primary-action mt-4 w-full"
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
                </aside>
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
