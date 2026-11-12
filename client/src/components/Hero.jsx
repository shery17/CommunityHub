import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import marketPhoto from "../assets/community-market.webp";

export default function Hero() {
  const { user } = useAuth();

  return (
    <section className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-8 sm:px-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12 md:py-14 lg:px-12">
      <div className="max-w-lg">
        <h1 className="text-4xl leading-[1.07] font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl lg:text-6xl">
          Find something to do near you
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-stone-600 sm:text-lg">
          Discover local events, sign up to take part, or bring people together by hosting your own.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/events" className="primary-action">Browse events</Link>
          <Link to={user ? "/create-event" : "/login"} state={user ? undefined : { returnTo: "/create-event" }}
            className="secondary-action">Create an event</Link>
        </div>
      </div>
      <img src={marketPhoto} alt="Neighbours browsing an outdoor market" width="1440" height="960"
        className="aspect-[4/3] w-full rounded-2xl object-cover sm:rounded-3xl" />
    </section>
  );
}
