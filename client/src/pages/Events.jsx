import Header from "../components/Header";
import EventCard from "../components/EventCard";
import Footer from "../components/Footer";

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
    {
      id: 4,
      title: "Neighbourhood Gardening Day",
      date: "Saturday, 17 May",
      time: "9:30 AM",
      location: "Hyde Park",
      description:
        "Help local residents plant flowers, maintain green spaces, and improve the neighbourhood.",
    },
    {
      id: 5,
      title: "Community Book Club",
      date: "Wednesday, 21 May",
      time: "6:30 PM",
      location: "Leeds Central Library",
      description:
        "Meet other local readers and discuss this month's community book selection.",
    },
    {
      id: 6,
      title: "Charity Fun Run",
      date: "Sunday, 25 May",
      time: "10:00 AM",
      location: "Roundhay Park",
      description:
        "Take part in a friendly community fun run while raising money for a local charity.",
    },
  ];

  return (
    <>
      <Header />

      <main>
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Community Events
              </h1>

              <p className="mt-4 text-lg leading-8 text-gray-600">
                Discover events happening in your local community and find
                something you would like to get involved with.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                    key={event.id}
                    id={event.id}
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
      </main>

      <Footer />
    </>
  );
}

export default Events;