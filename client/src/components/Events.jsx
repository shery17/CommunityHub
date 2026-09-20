import EventCard from "./EventCard";

function Events() {
  const events = [
    {
      id: 1,
      title: "Community Clean-Up",
      date: "Saturday, 10 May",
      time: "10:00 AM",
      location: "Leeds City Centre",
      description:
        "Join local residents for a community clean-up and help make our neighbourhood a better place.",
    },
    {
      id: 2,
      title: "Local Football Meetup",
      date: "Sunday, 11 May",
      time: "2:00 PM",
      location: "Roundhay Park",
      description:
        "Come along for a friendly game of football. All abilities are welcome.",
    },
    {
      id: 3,
      title: "Community Food Market",
      date: "Sunday, 11 May",
      time: "11:00 AM",
      location: "Leeds Kirkgate Market",
      description:
        "Discover local food, meet community members, and support local vendors.",
    },
  ];

  return (
    <section id="events" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Section Heading */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Upcoming Events
          </h2>

          <p className="mt-3 text-gray-600">
            Discover what's happening in your local community.
          </p>
        </div>

        {/* Event Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              title={event.title}
              date={event.date}
              time={event.time}
              location={event.location}
              description={event.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Events;

