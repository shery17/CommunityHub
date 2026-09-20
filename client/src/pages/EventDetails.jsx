import { Link, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

function EventDetails() {
  const { id } = useParams();

  return (
    <>
      <Header />

      <main className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Link
            to="/events"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Back to Events
          </Link>

          <article className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex h-64 items-center justify-center bg-blue-50">
              <span className="text-6xl">📅</span>
            </div>

            <div className="p-8">
              <p className="text-sm font-medium text-blue-600">
                Community Event
              </p>

              <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
                Community Event #{id}
              </h1>

              <div className="mt-6 space-y-3 text-gray-600">
                <p>📅 Saturday, 10 May</p>
                <p>🕐 10:00 AM</p>
                <p>📍 Leeds City Centre</p>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  About this event
                </h2>

                <p className="mt-4 leading-7 text-gray-600">
                  Join local residents for a community event and get involved
                  with people in your local area. This is where we will
                  eventually display the full event description from our
                  database.
                </p>
              </div>

              <button className="mt-8 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 sm:w-auto">
                Register for Event
              </button>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default EventDetails;
