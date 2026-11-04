import { eventSchedule, eventAvailability, eventRegistrationLabel } from "../eventDisplay";
import { formatEventPrice } from "../eventPricing";

export default function EventSchedule({ event, now, showDeadline = true }) {
  const schedule = eventSchedule(event);
  const availability = eventAvailability(event, now);
  const count = Number(event.attendee_count ?? 0);
  const registrationLabel = eventRegistrationLabel(event, availability);
  return (
    <div className="mt-4 space-y-2 text-sm text-gray-600">
      {event.category && <p><strong>Category:</strong> {event.category}</p>}
      <p><strong>Price:</strong> {formatEventPrice(event)}</p>
      {schedule.multiDay ? <>
        <p><strong>Starts:</strong> <time dateTime={event.starts_at}>{schedule.start}</time></p>
        <p><strong>Ends:</strong> <time dateTime={event.ends_at}>{schedule.end}</time></p>
        <p><strong>Time zone:</strong> {schedule.timezone}</p>
        {showDeadline && <p><strong>Registration:</strong> {schedule.deadline
          ? <>Deadline: <time dateTime={event.registration_deadline}>{schedule.deadline}</time></>
          : "Closes at the event start"}</p>}
      </> : <>
        <p><strong>Date:</strong> {schedule.date}</p>
        <p><strong>Time:</strong> {schedule.time}</p>
      </>}
      <p><strong>Location:</strong> {event.location}</p>
      {event.place_label && <p><strong>Map location:</strong> {event.place_label}</p>}
      {event.distance_miles != null && <p><strong>Distance:</strong> {Number(event.distance_miles).toFixed(1)} miles (straight line)</p>}
      {[event.address, event.city, event.postcode, event.country].filter(Boolean).length > 0 &&
        <p><strong>Address:</strong> {[event.address, event.city, event.postcode, event.country].filter(Boolean).join(", ")}</p>}
      <p><strong>Attendees:</strong> {event.capacity == null ? `${count} ${count === 1 ? "person attending" : "people attending"}` : `${count} / ${event.capacity} spots filled`}</p>
      <div className="flex flex-wrap gap-2" aria-label="Event status">
        {availability.lifecycle && !event.cancelled_at && <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">
          {{ upcoming: "Upcoming", ongoing: "Ongoing", past: "Past" }[availability.lifecycle]}
        </span>}
        <span className={`rounded-full px-3 py-1 font-semibold ${registrationLabel === "Registration open" ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-700"}`}>
          {registrationLabel}
        </span>
      </div>
    </div>
  );
}
