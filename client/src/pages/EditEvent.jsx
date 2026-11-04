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
  const [differentEndDay, setDifferentEndDay] = useState(false);
  const timingForm = differentEndDay ? formData : { ...formData, end_date: formData.start_date };
  const [existingEvent, setExistingEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [structuredLocation, setStructuredLocation] = useState(false);
  const [capacityEnabled, setCapacityEnabled] = useState(false);
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

          const savedForm = eventToForm(data);
          setFormData(savedForm);
          setDifferentEndDay(savedForm.start_date !== savedForm.end_date);
          setCategories(config.categories ?? []);
          setPricing(config.pricing ?? null);
          setStructuredLocation(Boolean(config.structured_location));
          setCoordinatesEnabled(Boolean(config.coordinates));
          setCapacityEnabled(Boolean(config.capacity));
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

    setFormData(previous => {
      const next = changeEventForm(previous, name, value);
      return name === "start_date" && !differentEndDay ? { ...next, end_offset: "" } : next;
    });
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
          body: JSON.stringify(buildEventPayload(timingForm, multiDay)),
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
                <EventLocationFields combined form={formData} onChange={handleChange} enabled={structuredLocation}
                  coordinatesEnabled={coordinatesEnabled} disabled={saving}
                  onSelectPlace={place => setFormData(previous => ({ ...previous, ...place }))} />
                <EventTimingFields compact form={timingForm} onChange={handleChange} multiDay={multiDay} locks={locks} disabled={saving}
                  differentEndDay={differentEndDay} onDifferentEndDayChange={checked => {
                    setDifferentEndDay(checked);
                    setFormData(previous => ({ ...previous, end_date: previous.start_date, end_offset: "" }));
                  }}
                  registrationOptions={capacityEnabled && <div>
                  <label htmlFor="capacity" className="block text-sm font-semibold">Attendee limit (optional)</label>
                  <input id="capacity" name="capacity" type="number" min={1} max={2147483647} step={1}
                    value={formData.capacity ?? ""} onChange={handleChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3" />
                  <p className="mt-1 text-sm text-gray-600">Leave blank for unlimited attendance.</p>
                </div>} />

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
