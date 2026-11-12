import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const navClass = ({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-stone-100 text-stone-950" : "text-stone-600 hover:bg-stone-50 hover:text-stone-950"}`;

  function signOut() {
    logout();
    closeMenu();
    navigate("/");
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 sm:px-8 md:grid-cols-[1fr_auto_1fr] lg:px-12">
        <Link to="/" onClick={closeMenu} className="w-fit text-xl font-bold tracking-tight text-brand-700 sm:text-2xl">
          CommunityHub
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          <NavLink to="/events" end className={navClass}>Browse events</NavLink>
        </nav>
        <div className="hidden items-center justify-end gap-2 md:flex">
          {user ? <>
            <NavLink to="/create-event" className={navClass}>Create event</NavLink>
            <NavLink to="/profile" className={navClass}>Profile</NavLink>
            <button type="button" onClick={signOut} className="secondary-action">Log out</button>
          </> : <>
            <NavLink to="/login" className={navClass}>Log in</NavLink>
            <Link to="/register" className="secondary-action">Sign up</Link>
          </>}
        </div>
        <button type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation"
          onClick={() => setMenuOpen(open => !open)} className="secondary-action md:hidden">
          {menuOpen ? "Close menu" : "Menu"}
        </button>
      </div>
      {menuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation"
        className="flex flex-col items-start gap-1 border-t border-stone-200 px-5 py-3 md:hidden">
        <NavLink to="/" end onClick={closeMenu} className={navClass}>Home</NavLink>
        <NavLink to="/events" end onClick={closeMenu} className={navClass}>Browse events</NavLink>
        {user ? <>
          <NavLink to="/create-event" onClick={closeMenu} className={navClass}>Create event</NavLink>
          <NavLink to="/profile" onClick={closeMenu} className={navClass}>Profile</NavLink>
          <button type="button" onClick={signOut} className="mt-1 px-4 py-2 text-sm font-semibold">Log out</button>
        </> : <>
          <NavLink to="/login" onClick={closeMenu} className={navClass}>Log in</NavLink>
          <NavLink to="/register" onClick={closeMenu} className={navClass}>Sign up</NavLink>
        </>}
      </nav>}
    </header>
  );
}
