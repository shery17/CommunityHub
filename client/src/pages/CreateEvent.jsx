import EventLocationFields from "../components/EventLocationFields";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import EventTimingFields from "../components/EventTimingFields";
import EventCategoryField from "../components/EventCategoryField";
import EventPricingFields from "../components/EventPricingFields";
import { emptyEventForm, changeEventForm, buildEventPayload } from "../eventFormTiming";

function CreateEvent() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ ...emptyEventForm });
  const [multiDay, setMultiDay] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [structuredLocation, setStructuredLocation] = useState(false);
  const [capacityEnabled, setCapacityEnabled] = useState(false);
  const [coordinatesEnabled, setCoordinatesEnabled] = useState(false);
  const [configError, setConfigError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const response = await fetch("http://localhost:5001/api/events/config");
        const data = await response.json();
        if (!response.ok || typeof data.multi_day !== "boolean") {
          throw new Error(data.message || "Unable to load the event form.");
        }
        if (!cancelled) {
          setMultiDay(data.multi_day);
          setCategories(data.categories ?? []);
          setPricing(data.pricing ?? null);
          setStructuredLocation(Boolean(data.structured_location));
          setCoordinatesEnabled(Boolean(data.coordinates));
          setCapacityEnabled(Boolean(data.capacity));
        }
      } catch (error) {
        if (!cancelled) setConfigError(error.message || "Unable to load the event form.");
      }
    }
    loadConfig();
    return () => { cancelled = true; };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData(previous => changeEventForm(previous, name, value));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (multiDay === null) return;

    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem("token");

      if (!token) {
        throw new Error("Please log in before creating an event.");
      }

      const response = await fetch("http://localhost:5001/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildEventPayload(formData, multiDay, { creating: true })),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create event.");
      }

      // Redirect to the new event's details page.
      navigate(`/events/${data.id}`);
    } catch (error) {
      console.error("Error creating event:", error);
      setError(
        error.message || "Unable to create event. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Create an Event
            </h1>

            <p className="mt-3 text-lg text-gray-600">
              Share a local event with your community.
            </p>
          </div>

          {multiDay === null ? (
            <p role={configError ? "alert" : "status"} className={configError ? "text-red-600" : "text-gray-600"}>
              {configError || "Loading event form..."}
            </p>
          ) : <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <div className="space-y-6">
              {/* Event Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Event Title
                </label>

                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Community Clean-Up"
                  maxLength={200}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Tell people what the event is about..."
                  rows="5"
                  required
                  className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <EventCategoryField value={formData.category} categories={categories} onChange={handleChange} disabled={loading} />
              <EventPricingFields form={formData} config={pricing} onChange={handleChange} disabled={loading} />
              {capacityEnabled && <div>
                <label htmlFor="capacity" className="block text-sm font-semibold">Attendee limit (optional)</label>
                <input id="capacity" name="capacity" type="number" min={1} max={2147483647} step={1}
                  value={formData.capacity ?? ""} onChange={handleChange}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3" />
                <p className="mt-1 text-sm text-gray-600">Leave blank for unlimited attendance.</p>
              </div>}
              <EventTimingFields form={formData} onChange={handleChange} multiDay={multiDay} disabled={loading} />

              {/* Location */}
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Location
                </label>

                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Leeds City Centre"
                  maxLength={255}
                  required
                  className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mt-6">
              <EventLocationFields coordinatesEnabled={coordinatesEnabled} onSelectPlace={place=>setFormData(previous=>({...previous,...place}))} form={formData} onChange={handleChange} enabled={structuredLocation} disabled={loading} />
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-6 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {/* Submit */}
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating Event..." : "Create Event"}
              </button>
            </div>
          </form>}
        </div>
      </main>

      <Footer />
    </>
  );
}

export default CreateEvent;
