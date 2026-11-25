
import { useEffect, useState } from "react";

import { Link, NavLink, useNavigate } from "react-router-dom";

import {
  Menu,
  X,
  UserCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { logoutUser } from "../services/aiService";

import "./Navbar.css";

/* ==========================================================
   USER MANAGEMENT
   ========================================================== */

function readSavedUser() {
  try {
    const savedUser = localStorage.getItem("user");

    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    return null;
  }
}

/* ==========================================================
   NAVBAR
   ========================================================== */

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(readSavedUser);

  const navigate = useNavigate();

  /* ----------------------------------------------------------
     Synchronize authentication state
     ---------------------------------------------------------- */

  useEffect(() => {
    const syncUser = () => {
      setUser(readSavedUser());
    };

    window.addEventListener("storage", syncUser);
    window.addEventListener("auth-change", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth-change", syncUser);
    };
  }, []);

  /* ----------------------------------------------------------
     Navigation helpers
     ---------------------------------------------------------- */

  const closeMenu = () => setMenuOpen(false);

  const linkStyle = ({ isActive }) =>
    `jg-nav-link${isActive ? " active" : ""}`;

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    closeMenu();

    window.dispatchEvent(new Event("auth-change"));

    navigate("/");
  };

  const userEmail = user?.email || "My Account";

  return (
    <nav className="jg-navbar">
      <div className="jg-navbar-inner">
        {/* Logo */}

        <Link
          to="/"
          className="jg-navbar-brand"
          onClick={closeMenu}
        >
          <img
            src="/journey-gen-ai-logo.png"
            alt="Journey Gen AI"
            className="jg-navbar-brand-image"
          />

          <span className="jg-navbar-brand-text">
            Journey <strong>Gen AI</strong>
          </span>
        </Link>

        {/* Navigation */}

        <div
          className={`jg-navbar-links${menuOpen ? " is-open" : ""}`}
        >
          <NavLink
            to="/"
            end
            className={linkStyle}
            onClick={closeMenu}
          >
            Home
          </NavLink>

          {user && (
            <NavLink
              to="/dashboard"
              className={linkStyle}
              onClick={closeMenu}
            >
              Dashboard
            </NavLink>
          )}

          <NavLink
            to="/planner"
            className={linkStyle}
            onClick={closeMenu}
          >
            AI Planner
          </NavLink>

          {/* Mobile account actions */}

          <div className="jg-navbar-mobile-actions">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="jg-navbar-mobile-account"
                  onClick={closeMenu}
                >
                  <UserCircle size={18} />
                  My Profile
                </Link>

                <button
                  type="button"
                  className="jg-navbar-mobile-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeMenu}>
                  Login
                </Link>

                <Link
                  to="/signup"
                  className="jg-navbar-mobile-signup"
                  onClick={closeMenu}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Desktop account actions */}

        <div className="jg-navbar-actions">
          {user ? (
            <>
              <Link
                to="/profile"
                className="jg-navbar-account"
                title="My Profile"
              >
                <UserCircle size={19} />

                <span className="jg-navbar-account-email">
                  {userEmail}
                </span>

                <ChevronDown size={15} />
              </Link>

              <button
                type="button"
                className="jg-navbar-logout"
                onClick={handleLogout}
              >
                <LogOut size={17} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="jg-navbar-login"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="jg-navbar-signup"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}

        <button
          type="button"
          className="jg-navbar-menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
