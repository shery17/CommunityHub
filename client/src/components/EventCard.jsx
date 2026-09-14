function EventCard({ title, date, time, location, description }) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      {/* Event Image Placeholder */}
      <div className="flex h-40 items-center justify-center bg-blue-50">
        <span className="text-4xl">📅</span>
      </div>

      {/* Event Details */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900">
          {title}
        </h3>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p>
            📅 {date}
          </p>

          <p>
            🕐 {time}
          </p>

          <p>
            📍 {location}
          </p>
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-600">
          {description}
        </p>

        <button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
          View Event
        </button>
      </div>
    </article>
  );
}

export default EventCard;
