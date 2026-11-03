import EventLocationFields from "../components/EventLocationFields";

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import EventTimingFields from "../components/EventTimingFields";
import EventCategoryField from "../components/EventCategoryField";
import EventPricingFields from "../components/EventPricingFields";
import { emptyEventForm, eventToForm, changeEventForm, buildEventPayload, eventTimingLocks } from "../eventFormTiming";

function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ ...emptyEventForm });
  const [existingEvent, setExistingEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [structuredLocation, setStructuredLocation] = useState(false);
  const [coordinatesEnabled, setCoordinatesEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const multiDay = Boolean(existingEvent?.start_date);
  const locks = eventTimingLocks(existingEvent, currentTime);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      setLoading(true);
      setError("");
      setExistingEvent(null);
      try {
        const [response, configResponse] = await Promise.all([
          fetch(`http://localhost:5001/api/events/${id}`),
          fetch("http://localhost:5001/api/events/config"),
        ]);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load event.");
        }
        if (!configResponse.ok) throw new Error("Unable to load event categories. Please try again.");
        const config = await configResponse.json();

        if (!cancelled) {
          if (Number(data.created_by) !== Number(user?.id)) {
            setError("You can only edit events you created.");
            return;
          }

          setFormData(eventToForm(data));
          setCategories(config.categories ?? []);
          setPricing(config.pricing ?? null);
          setStructuredLocation(Boolean(config.structured_location));
          setCoordinatesEnabled(Boolean(config.coordinates));
          setExistingEvent(data);
        }
      } catch (error) {
        if (!cancelled) {
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
  }, [id, user]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData(previous => changeEventForm(previous, name, value));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!existingEvent) return;

    const token = sessionStorage.getItem("token");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/events/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildEventPayload(formData, multiDay)),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update event.");
      }

      navigate(`/events/${id}`);
    } catch (error) {
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            to={`/events/${id}`}
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to Event
          </Link>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Event
            </h1>

            <p className="mt-2 text-gray-600">
              Update the details of your community event.
            </p>

            {loading ? (
              <p className="mt-6 text-gray-600" role="status">
                Loading event details...
              </p>
            ) : !existingEvent ? (
              <div className="mt-6">
                <p className="text-red-600" role="alert">
                  {error}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {multiDay && Number(existingEvent.attendee_count) > 0 && !locks.start && (
                  <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This event has {existingEvent.attendee_count} registered {Number(existingEvent.attendee_count) === 1 ? "attendee" : "attendees"}. Timing changes affect them; please let them know about any changes.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Event Title
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    required
                    rows={5}
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <EventCategoryField value={formData.category} categories={categories} onChange={handleChange} disabled={saving} />
                <EventPricingFields form={formData} config={pricing} onChange={handleChange} disabled={saving} />
                <EventTimingFields form={formData} onChange={handleChange} multiDay={multiDay} locks={locks} disabled={saving} />

                <div>
                  <label
                    htmlFor="location"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Location
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    maxLength={255}
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <EventLocationFields coordinatesEnabled={coordinatesEnabled} onSelectPlace={place=>setFormData(previous=>({...previous,...place}))} form={formData} onChange={handleChange} enabled={structuredLocation} disabled={saving} />

                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>

                  <Link
                    to={`/events/${id}`}
                    className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default EditEvent;
