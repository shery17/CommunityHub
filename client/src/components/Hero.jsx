import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Hero() {
  const { user } = useAuth();

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-12 text-center sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Find something to do near you
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-gray-600">
          Discover local events, sign up to take part, or bring people together by hosting your own.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/events" className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Browse events
          </Link>
          <Link
            to={user ? "/create-event" : "/login"}
            state={user ? undefined : { returnTo: "/create-event" }}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Create an event
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;
