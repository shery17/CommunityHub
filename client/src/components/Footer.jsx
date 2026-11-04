function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          
          {/* Logo + Description */}
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-xl font-bold">
                C
              </div>

              <span className="text-xl font-bold">
                CommunityHub
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-400">
              Bringing Local Communities Together. Discover local events,
              connect with your community, and get involved.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              Quick Links
            </h3>

            <nav className="mt-4 flex flex-col gap-3">
              <a
                href="#"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Home
              </a>

              <a
                href="#"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Events
              </a>

              <a
                href="#"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                Create an Event
              </a>

              <a
                href="#"
                className="text-sm text-gray-400 transition hover:text-white"
              >
                About
              </a>
            </nav>
          </div>

        </div>

        {/* Copyright */}
        <div className="mt-10 border-t border-gray-800 pt-6">
          <p className="text-sm text-gray-500">
            © 2026 CommunityHub. All rights reserved.
          </p>
          <p className="mt-2 text-sm text-gray-300">
            Location data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-white">
              OpenStreetMap contributors
            </a>
          </p>
          <details className="mt-2 max-w-lg text-sm text-gray-300">
            <summary className="cursor-pointer">Place search privacy</summary>
            <p className="mt-2">
              When you look up a place, CommunityHub sends your search text to{" "}
              <a href="https://photon.komoot.io/" className="underline hover:text-white">Photon</a>.
              Use a public venue or place name.
            </p>
          </details>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
