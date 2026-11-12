import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-[1440px] px-5 py-7 text-sm text-stone-600 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-medium text-stone-800">© {new Date().getFullYear()} CommunityHub</p>
          <Link to="/events" className="underline-offset-4 hover:underline">Browse events</Link>
          <p>Location data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-4">OpenStreetMap contributors</a>
          </p>
          <details className="max-w-md">
            <summary className="underline-offset-4 hover:underline">Place search privacy</summary>
            <p className="mt-2">
              When you look up a place, CommunityHub sends your search text to{" "}
              <a href="https://photon.komoot.io/" className="underline underline-offset-4">Photon</a>.
              Use a public venue or place name.
            </p>
          </details>
        </div>
      </div>
    </footer>
  );
}
