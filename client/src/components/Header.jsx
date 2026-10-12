import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setIsMenuOpen(false);
    navigate("/");
  }

  const linkClass =
    "text-sm font-medium text-gray-700 transition hover:text-blue-600";

  const mobileLinkClass =
    "rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100";

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-4">
        {/* Main Header */}
        <div className="flex items-center justify-between">
          {/* Logo + Title */}
          <Link
            to="/"
            className="flex items-center gap-3"
            onClick={() => setIsMenuOpen(false)}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-xl font-bold text-white">
              C
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              CommunityHub
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link to="/" className={linkClass}>
              Home
            </Link>

            <Link to="/events" className={linkClass}>
              Events
            </Link>

            <Link to="/create-event" className={linkClass}>
              Create Event
            </Link>

            {user ? (
              <>
                <Link to="/profile" className={linkClass}>
                  Profile
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav
            id="mobile-navigation"
            className="mt-4 border-t border-gray-200 pt-4 md:hidden"
          >
            <div className="flex flex-col gap-2">
              <Link
                to="/"
                className={mobileLinkClass}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>

              <Link
                to="/events"
                className={mobileLinkClass}
                onClick={() => setIsMenuOpen(false)}
              >
                Events
              </Link>

              <Link
                to="/create-event"
                className={mobileLinkClass}
                onClick={() => setIsMenuOpen(false)}
              >
                Create Event
              </Link>

              {user ? (
                <>
                  <Link
                    to="/profile"
                    className={mobileLinkClass}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 rounded-lg border border-gray-300 px-5 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="mt-2 rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </Link>

                  <Link
                    to="/register"
                    className="rounded-lg px-5 py-2.5 text-center text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

export default Header;

