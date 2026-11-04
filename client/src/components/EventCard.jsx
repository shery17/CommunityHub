import { Link } from "react-router-dom";
import { eventAvailability, eventCardTiming, eventRegistrationLabel } from "../eventDisplay";
import { coverPhotoUrl } from "../eventCoverPhoto";
import { formatEventPrice } from "../eventPricing";

export default function EventCard({ event, now }) {
  const status = eventRegistrationLabel(event, eventAvailability(event, now));
  const distance = event.distance_miles == null ? null : Number(event.distance_miles);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {event.has_cover_photo && <img src={coverPhotoUrl(event.id)} alt="" loading="lazy" decoding="async" className="h-36 w-full object-cover" />}
      <div className="flex flex-1 flex-col p-5">
        <h2 className="break-words text-xl font-bold text-gray-900">{event.title}</h2>
        <div className="mt-2 space-y-1 text-sm text-gray-700">
          <p><time dateTime={event.starts_at}>{eventCardTiming(event)}</time></p>
          <p className="break-words">{event.location}{Number.isFinite(distance) && ` · ${distance.toFixed(1)} miles away`}</p>
          <p className="font-medium">{formatEventPrice(event)}</p>
        </div>
        {status !== "Registration open" && <p className="mt-3 self-start rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">{status}</p>}
        {event.description?.trim() && <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-gray-600">{event.description}</p>}
        <div className="mt-auto pt-4">
          <Link to={`/events/${event.id}`} aria-label={`View event: ${event.title}`}
            className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
            View event
          </Link>
        </div>
      </div>
    </article>
  );
}
