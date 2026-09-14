function Hero() {
  return (
    <section className="bg-gray-50">
      <div className="mx-auto flex min-h-[500px] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
        
        {/* Heading */}
        <h2 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          Bringing Local Communities Together
        </h2>

        {/* Description */}
        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Discover local events, meet new people, and get involved in your
          community. Find something happening near you or create an event of
          your own.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
            Find Events
          </button>

          <button className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100">
            Create an Event
          </button>
        </div>

      </div>
    </section>
  );
}

export default Hero;
