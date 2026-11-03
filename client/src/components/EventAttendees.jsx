import { useState } from "react";

export default function EventAttendees({ eventId }) {
  const [attendees, setAttendees] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAttendees() {
    setLoading(true);
    setError("");
    setAttendees(null);
    try {
      const response = await fetch(`http://localhost:5001/api/events/${eventId}/attendees`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load attendees.");
      setAttendees(data.attendees);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6" aria-label="Attendee list">
      <h3 className="font-semibold text-gray-900">Attendees</h3>
      <button type="button" onClick={loadAttendees} disabled={loading}
        className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-60">
        {loading ? "Loading attendees..." : attendees ? "Refresh attendee list" : "View attendee list"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {attendees && (
        <>
          <p role="status" className="mt-2 text-sm text-gray-600">
            {attendees.length === 0 ? "No one has registered yet." : `${attendees.length} registered`}
          </p>
          {attendees.length > 0 && <ul className="mt-2 divide-y divide-gray-200">
            {attendees.map(attendee => <li key={attendee.registration_id} className="py-2 text-sm text-gray-900">
              {attendee.name}
              {attendee.registered_at && <time className="ml-2 text-gray-600" dateTime={attendee.registered_at}>
                {new Date(attendee.registered_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </time>}
            </li>)}
          </ul>}
        </>
      )}
    </section>
  );
}
