import { Link } from "react-router-dom";
import { eventAvailability, eventCardTiming, eventRegistrationLabel } from "../eventDisplay";
import { coverPhotoUrl } from "../eventCoverPhoto";
import { formatEventPrice } from "../eventPricing";

export default function EventCard({ event, now }) {
  const status = eventRegistrationLabel(event, eventAvailability(event, now));
  const distance = event.distance_miles == null ? null : Number(event.distance_miles);

  return (
    <article className="min-w-0">
      <Link to={`/events/${event.id}`} className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700">
        {event.has_cover_photo && <img src={coverPhotoUrl(event.id)} alt="" loading="lazy" decoding="async"
          className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-cover" />}
        <div className={event.has_cover_photo ? "pt-2.5" : "border-t border-slate-200 pt-3"}>
          <h2 className="break-words text-sm leading-snug font-semibold text-slate-950 group-hover:underline sm:text-base">{event.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{eventCardTiming(event)}</p>
          <p className="break-words text-xs leading-relaxed text-slate-600 sm:text-sm">
            {event.location}{Number.isFinite(distance) && ` · ${distance.toFixed(1)} miles away`}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-900 sm:text-sm">{formatEventPrice(event)}</p>
          {status !== "Registration open" && <p className="mt-1.5 text-xs font-medium text-slate-600">{status}</p>}
        </div>
      </Link>
    </article>
  );
}
