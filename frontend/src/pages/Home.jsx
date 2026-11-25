import { useEffect, useMemo, useRef, useState } from "react";

import { Link, NavLink, useNavigate } from "react-router-dom";

import {

  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Check,

  CircleHelp, Compass, Globe2, Home as HomeIcon, LogIn, LogOut,

  Sun, Moon, Monitor, MapPin, Menu, Plane, Plus, ShieldCheck,

  Sparkles, UserRound, X, Zap,

} from "lucide-react";

import { getCurrentUser, getSavedTrips, logoutUser } from "../services/aiService";

import "./Home.css";

const FEATURES = [

  { icon: Zap, title: "AI-Powered Planning", description: "Smart, personalized itineraries", tone: "amber" },

  { icon: MapPin, title: "Multi-Source Research", description: "Flights, hotels, weather & more", tone: "pink" },

  { icon: ShieldCheck, title: "Budget Control", description: "Plan within your budget", tone: "green" },

  { icon: Globe2, title: "Interactive Maps", description: "Explore destinations", tone: "cyan" },

];

const DISCOVERY_DESTINATIONS = [

  { name: "Bali", country: "Indonesia", category: "International", description: "Temples, beaches & rice terraces", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=850&q=80" },

  { name: "Kyoto", country: "Japan", category: "International", description: "Historic streets & gardens", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=850&q=80" },

  { name: "Maldives", country: "Maldives", category: "International", description: "Turquoise lagoons & island stays", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=850&q=80" },

  { name: "Thailand", country: "Thailand", category: "International", description: "Tropical islands & vibrant culture", image: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=850&q=80" },

  { name: "Singapore", country: "Singapore", category: "International", description: "City lights & waterfront sights", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=850&q=80" },

  { name: "Kerala", country: "India", category: "India", description: "Backwaters & lush landscapes", image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=850&q=80" },

  { name: "Kashmir", country: "India", category: "India", description: "Alpine lakes & mountain valleys", image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=850&q=80" },

  { name: "Rajasthan", country: "India", category: "India", description: "Forts, palaces & desert heritage", image: "https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=850&q=80" },

  { name: "Goa", country: "India", category: "India", description: "Coastal escapes & laid-back days", image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=850&q=80" },

  { name: "Manali", country: "India", category: "India", description: "Himalayan scenery & adventure", image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=850&q=80" },

];

const AGENT_STAGES = [

  { title: "Your Choices", subtitle: "Select preferences" },

  { title: "Transport", subtitle: "If selected" },

  { title: "Stay & Weather", subtitle: "If selected" },

  { title: "Budget", subtitle: "If selected" },

  { title: "Itinerary", subtitle: "Always generated" },

  { title: "Review & Save", subtitle: "Your decision" },

];

const THEME_KEY = "journey-gen-ai-theme";

const THEME_OPTIONS = [

  { value: "dark", label: "Dark", Icon: Moon },

  { value: "light", label: "Light", Icon: Sun },

  { value: "system", label: "System", Icon: Monitor },

];

function localToday() {

  const date = new Date();

  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

}

function readUser() {

  try {

    const stored = JSON.parse(localStorage.getItem("user") || "{}");

    return stored && typeof stored === "object" ? stored : {};

  } catch { return {}; }

}

function normalizeTrips(response) {

  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.trips)) return response.trips;

  if (Array.isArray(response?.data)) return response.data;

  if (Array.isArray(response?.data?.trips)) return response.data.trips;

  return [];

}

// The saved-trip API returns { id, title, formData, itinerary, savedAt }.
// Older records can also contain a few top-level legacy fields.
function getFormData(trip) {
  const form = trip?.formData;
  return form && typeof form === "object" && !Array.isArray(form) ? form : {};
}

function firstText(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function getDestination(trip) {
  const form = getFormData(trip);
  const start = firstText(form.source, form.startingLocation, trip?.source);
  const destination = firstText(form.destination, trip?.destination, trip?.destination_name, trip?.place);
  if (start && destination && start.toLocaleLowerCase() !== destination.toLocaleLowerCase()) {
    return `${start} to ${destination}`;
  }
  return destination || firstText(trip?.title) || "Your Journey";
}

function getDestinationOnly(trip) {
  const form = getFormData(trip);
  return firstText(form.destination, trip?.destination, trip?.destination_name, trip?.place, trip?.title);
}

function getStartDate(trip) {
  const form = getFormData(trip);
  return firstText(form.startDate, form.travelDate, form.departureDate,
    trip?.startDate, trip?.start_date, trip?.travel_date, trip?.departure_date, trip?.trip_date);
}

function getEndDate(trip) {
  const form = getFormData(trip);
  return firstText(form.endDate, form.returnDate,
    trip?.endDate, trip?.end_date, trip?.return_date, trip?.arrival_date);
}

function getTripId(trip) { return trip?.id ?? trip?.trip_id ?? null; }

function dateKey(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|T|\s)/);
  if (match) {
    const date = new Date(`${match[1]}T12:00:00`);
    return Number.isNaN(date.getTime()) || [date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")].join("-") !== match[1] ? "" : match[1];
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

function formatDate(dateValue) {
  const key = dateKey(dateValue);
  if (!key) return "Dates not specified";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function getTripStatus(trip) {
  const status = String(trip?.status || trip?.approval_status || "").toLowerCase();
  if (status.includes("approved")) return "Approved";
  if (status.includes("pending")) return "Pending";
  if (status.includes("draft")) return "Draft";
  return "Saved";
}

function getTravelers(trip) {
  const form = getFormData(trip);
  const validCount = (value) => value !== "" && value !== undefined && value !== null &&
    Number.isInteger(Number(value)) && Number(value) >= 0;
  if (validCount(form.adults) || validCount(form.children)) {
    const adults = validCount(form.adults) ? Number(form.adults) : 0;
    const children = validCount(form.children) ? Number(form.children) : 0;
    const total = adults + children;
    if (total > 0) return `${total} traveler${total === 1 ? "" : "s"} (${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"})`;
  }
  const value = form.travelers ?? form.numberOfTravelers ??
    trip?.travelers ?? trip?.travellers ?? trip?.num_travelers ?? trip?.number_of_travelers;
  if (value === undefined || value === null || value === "" || typeof value === "object") return null;
  const string = String(value).trim();
  return string ? (/travell?ers?/i.test(string) ? string : `${string} traveler${string === "1" ? "" : "s"}`) : null;
}

function getBudget(trip) {
  const form = getFormData(trip);
  const value = form.budget ?? form.budgetPerPerson ?? form.budgetCategory ??
    trip?.budget ?? trip?.total_budget ?? trip?.estimated_budget ?? trip?.budget_amount;
  if (value === undefined || value === null || value === "" || typeof value === "object") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numberText = raw.replace(/[₹,\s]/g, "");
  if (/^\d+(?:\.\d+)?$/.test(numberText)) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(numberText));
  }
  return raw; // e.g. "Low", "Medium", "Budget friendly" are choices, not INR amounts.
}

function formatTripDates(trip) {
  const start = getStartDate(trip);
  const end = getEndDate(trip);
  if (!dateKey(start)) return "Dates not specified";
  return dateKey(end) ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
}

function readTheme() {

  const saved = localStorage.getItem(THEME_KEY);

  return ["dark", "light", "system"].includes(saved) ? saved : "dark";

}

function applyTheme(theme) {

  const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);

  document.documentElement.dataset.theme = light ? "light" : "dark";

  document.documentElement.style.colorScheme = light ? "light" : "dark";

}

/* Carousel viewport and responsive navigation. */

function DestinationCarousel({ title, subtitle, destinations, colors }) {

  const trackRef = useRef(null);

  const [canGoBack, setCanGoBack] = useState(false);

  const [canGoForward, setCanGoForward] = useState(false);

  function updateArrows() {

    const track = trackRef.current;

    if (!track) return;

    setCanGoBack(track.scrollLeft > 3);

    setCanGoForward(track.scrollLeft + track.clientWidth < track.scrollWidth - 3);

  }

  useEffect(() => {

    const track = trackRef.current;

    if (!track) return undefined;

    const update = () => updateArrows();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;

    observer?.observe(track);

    window.addEventListener("resize", update);

    update();

    return () => {

      observer?.disconnect();

      window.removeEventListener("resize", update);

    };

  }, [destinations]);

  function move(direction) {

    const track = trackRef.current;

    if (!track) return;

    const firstCard = track.querySelector("article");

    if (!firstCard) return;

    const gap = parseFloat(window.getComputedStyle(track).columnGap) || 16;

    const distance = firstCard.getBoundingClientRect().width + gap;

    const visibleCards = Math.max(1, Math.round((track.clientWidth + gap) / distance));

    track.scrollBy({ left: direction * distance * visibleCards, behavior: "smooth" });

  }

  if (!destinations.length) return null;

  const arrowStyle = (enabled) => ({

    display: "inline-flex", alignItems: "center", justifyContent: "center",

    width: 38, height: 38, borderRadius: "50%", border: `1px solid ${colors.border}`,

    background: colors.surface, color: colors.text, cursor: enabled ? "pointer" : "not-allowed",

    opacity: enabled ? 1 : 0.35,

  });

  return (

    <section className="jg-discovery-carousel" aria-label={title}>

      <div className="jg-discovery-carousel-heading">

        <div>

          <h3 style={{ fontSize: "clamp(19px, 2vw, 24px)", margin: 0, fontWeight: 800, color: colors.text }}>{title}</h3>

          {subtitle && <p style={{ fontSize: 13, color: colors.muted, margin: "5px 0 0" }}>{subtitle}</p>}

        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>

          <button type="button" aria-label={`Scroll ${title} left`} disabled={!canGoBack} onClick={() => move(-1)} style={arrowStyle(canGoBack)}><ChevronLeft size={19} /></button>

          <button type="button" aria-label={`Scroll ${title} right`} disabled={!canGoForward} onClick={() => move(1)} style={arrowStyle(canGoForward)}><ChevronRight size={19} /></button>

        </div>

      </div>

      <div className="jg-discovery-viewport">

        <div ref={trackRef} className="jg-discovery-track" onScroll={updateArrows} tabIndex={0} aria-label={`${title} destinations; use arrow keys or the carousel buttons to navigate`}>

          {destinations.map((destination) => (

            <article key={`${title}-${destination.name}`} className="jg-discovery-card" style={{ border: `1px solid ${colors.border}`, background: colors.surface, boxShadow: "0 10px 26px rgba(16, 24, 60, .06)" }}>

              <div className="jg-discovery-image">

                <img src={destination.image} alt={`${destination.name}, ${destination.country}`} loading="lazy" />

                <span className="jg-discovery-country">{destination.country}</span>

              </div>

              <div className="jg-discovery-copy">

                <h4 style={{ margin: "0 0 5px", fontSize: 18, fontWeight: 800, color: colors.text }}>{destination.name}</h4>

                <p style={{ margin: "0 0 15px", color: colors.muted, fontSize: 12, minHeight: 34, lineHeight: 1.5 }}>{destination.description}</p>

                <Link to="/planner" state={{ destination: destination.name }} aria-label={`Plan a trip to ${destination.name}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#a77aff", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Plan this trip <ArrowRight size={15} /></Link>

              </div>

            </article>

          ))}

        </div>

      </div>

    </section>

  );

}

function Home() {

  const navigate = useNavigate();

  const [theme, setTheme] = useState(readTheme);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);

  const [trips, setTrips] = useState([]);

  const [loadingTrips, setLoadingTrips] = useState(true);

  const [tripsError, setTripsError] = useState("");

  const [token, setToken] = useState(() => localStorage.getItem("access_token"));

  const [profile, setProfile] = useState(() => readUser());

  useEffect(() => {

    const syncTheme = () => {

      const next = readTheme();

      setTheme(next);

      applyTheme(next);

    };

    const media = window.matchMedia("(prefers-color-scheme: light)");

    window.addEventListener("theme-change", syncTheme);

    window.addEventListener("storage", syncTheme);

    media.addEventListener("change", syncTheme);

    syncTheme();

    return () => {

      window.removeEventListener("theme-change", syncTheme);

      window.removeEventListener("storage", syncTheme);

      media.removeEventListener("change", syncTheme);

    };

  }, []);

  function changeTheme(nextTheme) {

    localStorage.setItem(THEME_KEY, nextTheme);

    setTheme(nextTheme);

    applyTheme(nextTheme);

    window.dispatchEvent(new Event("theme-change"));

  }

  useEffect(() => {

    const syncSession = () => {

      setToken(localStorage.getItem("access_token"));

      setProfile(readUser());

    };

    window.addEventListener("storage", syncSession);

    window.addEventListener("focus", syncSession);

    return () => {

      window.removeEventListener("storage", syncSession);

      window.removeEventListener("focus", syncSession);

    };

  }, []);

  useEffect(() => {

    if (!token) return undefined;

    let active = true;

    async function refreshProfile() {

      try {

        const response = await getCurrentUser();

        const freshUser = response?.user ?? response?.data?.user ?? response?.data ?? response;

        if (!active || !freshUser || typeof freshUser !== "object" || Array.isArray(freshUser)) return;

        const mergedUser = { ...readUser(), ...freshUser };

        localStorage.setItem("user", JSON.stringify(mergedUser));

        setProfile(mergedUser);

      } catch { /* Preserve local session if refresh is unavailable. */ }

    }

    refreshProfile();

    return () => { active = false; };

  }, [token]);

  function handleLogout() {

    logoutUser();

    setToken(null);

    setProfile({});

    setTrips([]);

    setTripsError("");

    setLoadingTrips(false);

    navigate("/");

  }

  const user = token ? profile : {};

  const profileNameCandidates = [

    user.full_name, user.fullName, user.display_name, user.displayName, user.name,

    [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(" "),

    user.given_name, user.first_name, user.firstName,

  ];

  const displayName = profileNameCandidates.find((value) =>

    typeof value === "string" && value.trim() && !value.includes("@") &&

    !/^[a-z0-9.\\_-]*\d{2,}[a-z0-9.\\_-]*$/i.test(value.trim())

  )?.trim() || "Traveler";

  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");

  useEffect(() => {

    let active = true;

    async function loadTrips() {

      if (!token) {

        setTrips([]);

        setTripsError("");

        setLoadingTrips(false);

        return;

      }

      setLoadingTrips(true);

      try {

        const response = await getSavedTrips();

        if (active) { setTrips(normalizeTrips(response)); setTripsError(""); }

      } catch (error) {

        if (active) setTripsError(error?.message || "Unable to load saved trips.");

      } finally {

        if (active) setLoadingTrips(false);

      }

    }

    loadTrips();

    return () => { active = false; };

  }, [token]);

  const discoveryColors = {

    surface: "var(--jg-dark-card, var(--jg-dark-surface, #fff))",

    text: "var(--jg-dark-text, #172344)",

    muted: "var(--jg-dark-muted, #63718c)",

    border: "var(--jg-dark-border, rgba(135, 150, 190, .24))",

  };

  const recentTrips = useMemo(() => [...trips].sort((a, b) => {

    const aTime = new Date(a.savedAt || a.updatedAt || a.created_at || a.updated_at || 0).getTime();

    const bTime = new Date(b.savedAt || b.updatedAt || b.created_at || b.updated_at || 0).getTime();

    return (bTime || 0) - (aTime || 0);

  }).slice(0, 2), [trips]);

  const statistics = useMemo(() => {

    const today = localToday();

    const upcoming = trips.filter((trip) => {

      // A trip remains upcoming/ongoing until its RETURN date has passed.
      const lastDate = dateKey(getEndDate(trip)) || dateKey(getStartDate(trip));

      return Boolean(lastDate && lastDate >= today);

    }).length;

    const destinations = new Set(trips.map(getDestinationOnly).filter(Boolean).map((place) => place.toLowerCase()));

    return { total: trips.length, destinations: destinations.size, upcoming };

  }, [trips]);

  function openTrip(trip) {

    const id = getTripId(trip);

    if (id !== null) navigate(`/trips/${id}`);

  }

  function closeSidebar() { setSidebarOpen(false); }

  function openSupport() { closeSidebar(); setSupportOpen(true); }

  useEffect(() => {
    if (!supportOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSupportOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [supportOpen]);

  return (

    <div className="jg-main-shell jg-dark-home">

      {/* Scoped styles only for destination carousels; no changes required to Home.css. */}

      <style>{`

        .jg-discovery-carousel { margin: 28px 0 36px; min-width: 0; max-width: 100%; }

        .jg-discovery-carousel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 15px; }

        .jg-discovery-viewport { width: 100%; min-width: 0; overflow: hidden; }

        .jg-discovery-track { display: flex; width: 100%; min-width: 0; gap: 16px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior-x: contain; touch-action: pan-x pan-y; }

        .jg-discovery-track::-webkit-scrollbar { display: none; }

        .jg-discovery-card { flex: 0 0 calc((100% - 32px) / 3); box-sizing: border-box; min-width: 0; overflow: hidden; border-radius: 18px; scroll-snap-align: start; }

        .jg-discovery-image { position: relative; height: 180px; background: #25365b; }

        .jg-discovery-image img { display: block; width: 100%; height: 100%; object-fit: cover; }

        .jg-discovery-country { position: absolute; top: 12px; left: 12px; border-radius: 999px; padding: 6px 10px; background: rgba(9,17,40,.72); color: #fff; font-size: 11px; font-weight: 750; }

        .jg-discovery-copy { padding: 15px 15px 17px; }

        @media (max-width: 1050px) { .jg-discovery-card { flex-basis: calc((100% - 16px) / 2); } }

        @media (max-width: 640px) { .jg-discovery-card { flex-basis: 100%; } .jg-discovery-image { height: 205px; } }

        @media (prefers-reduced-motion: reduce) { .jg-discovery-track { scroll-behavior: auto; } }

      `}</style>

      {sidebarOpen && <button type="button" className="jg-main-sidebar-backdrop" aria-label="Close navigation" onClick={closeSidebar} />}

      <aside className={`jg-main-sidebar ${sidebarOpen ? "is-open" : ""}`}>

        <Link to="/" className="jg-main-brand" onClick={closeSidebar}>

          <img src="/journey-gen-ai-orbit.webp" alt="" aria-hidden="true" style={{ width: 76, height: 64, flexShrink: 0, objectFit: "contain", borderRadius: 12 }} />

          <strong style={{ fontSize: 19, letterSpacing: "-0.6px", lineHeight: 1.12, color: "var(--jg-dark-text)" }}>

            Journey <span style={{ color: "#b88aff", display: "block", marginTop: 3 }}>Gen AI</span>

          </strong>

        </Link>

        <button type="button" className="jg-main-sidebar-close" aria-label="Close sidebar" onClick={closeSidebar}><X size={20} /></button>

        <nav className="jg-main-nav">

          <NavLink to="/" end className={({ isActive }) => `jg-main-nav-link ${isActive ? "active" : ""}`} onClick={closeSidebar}><HomeIcon size={21} /><span>Home</span></NavLink>

          <NavLink to="/planner" className="jg-main-nav-link" onClick={closeSidebar}><Sparkles size={21} /><span>Plan Trip</span></NavLink>

          <NavLink to="/dashboard" className="jg-main-nav-link" onClick={closeSidebar}><Compass size={21} /><span>My Trips</span></NavLink>

          <Link to={token ? "/profile" : "/login"} className="jg-main-nav-link" onClick={closeSidebar}><UserRound size={21} /><span>Profile</span></Link>

          <button type="button" className="jg-main-nav-link jg-home-support-trigger" onClick={openSupport}><CircleHelp size={21} /><span>Help &amp; Support</span></button>

        </nav>

        <div className="jg-main-sidebar-spacer" />

      </aside>

      {supportOpen && (
        <div className="jg-home-support-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSupportOpen(false);
        }}>
          <section className="jg-home-support-dialog" role="dialog" aria-modal="true" aria-labelledby="jg-home-support-title">
            <div className="jg-home-support-header">
              <div><span className="jg-home-support-eyebrow"><CircleHelp size={16} /> JOURNEY GEN AI</span>
                <h2 id="jg-home-support-title">Help &amp; Support</h2>
                <p>Quick answers to common questions about planning and managing trips.</p>
              </div>
              <button type="button" className="jg-home-support-close" autoFocus aria-label="Close Help and Support" onClick={() => setSupportOpen(false)}><X size={21} /></button>
            </div>
            <div className="jg-home-support-body">
              <details><summary>How do I create an AI itinerary?</summary><p>Open Plan Trip, enter your cities and dates, choose the research options you need, and select Generate Trip. Your selected agents and itinerary progress appear on the Planner page.</p></details>
              <details><summary>Will every research agent run?</summary><p>No. Flight, train, bus, road, hotel, weather, and budget research depend on your selected options. The itinerary is always generated.</p></details>
              <details><summary>Are flight, hotel and budget prices confirmed?</summary><p>No. Results may include search references and illustrative estimates. Confirm schedules, availability, and prices with the provider before booking.</p></details>
              <details><summary>How do I save or edit a trip?</summary><p>Save the completed itinerary, then open My Trips. Use Open / Edit to view your exact saved plan or return to the Planner for changes.</p></details>
              <details><summary>How do I regenerate just one day?</summary><p>Choose the day, add optional instructions, review the preview, and accept it to save that day only. Other days stay unchanged.</p></details>
              <details><summary>How do public links work?</summary><p>Open a saved trip and choose Create Public Link. Anyone with that link can read it until you select Disable Public Link. A localhost URL works only from the same development computer unless you deploy or expose the site.</p></details>
              <div className="jg-home-support-actions">
                <Link to="/planner" onClick={() => setSupportOpen(false)}><Sparkles size={17} /> Open AI Planner</Link>
                <Link to="/dashboard" onClick={() => setSupportOpen(false)}><Compass size={17} /> My Saved Trips</Link>
                {import.meta.env.VITE_SUPPORT_EMAIL && <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL}`}><CircleHelp size={17} /> Email Support</a>}
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="jg-main-content">

        <header className="jg-main-topbar" style={{ minHeight: 116, height: "auto", paddingTop: 18, paddingBottom: 18, gap: 16, flexWrap: "wrap" }}>

          <div className="jg-main-topbar-left" style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 250px", minWidth: 0 }}>

            <button type="button" className="jg-main-mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>

            <div style={{ minWidth: 0 }}>

              <h2 style={{ fontSize: "clamp(18px, 2vw, 25px)", lineHeight: 1.2, fontWeight: 800, color: "var(--jg-dark-text)", margin: 0 }}>Welcome back, {String(displayName).split(" ")[0]}</h2>

              <p style={{ fontSize: 13, color: "var(--jg-dark-muted)", margin: "5px 0 0" }}>Your next adventure starts here.</p>

            </div>

          </div>

          <div className="jg-main-topbar-right" style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>

            <div className="jg-home-theme-switch" role="group" aria-label="Appearance">

              {THEME_OPTIONS.map(({ value, label, Icon }) => (

                <button key={value} type="button" className={`jg-home-theme-button ${theme === value ? "is-active" : ""}`} onClick={() => changeTheme(value)} aria-pressed={theme === value} title={`${label} appearance`}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>

              ))}

            </div>

            {token ? (

              <button type="button" onClick={handleLogout} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 10, border: "1px solid rgba(248, 165, 180, 0.38)", background: "rgba(248, 165, 180, 0.10)", color: "#ffc4ce", fontWeight: 700, fontSize: 13, cursor: "pointer" }}><LogOut size={16} /> Log Out</button>

            ) : (

              <>

                <Link to="/login" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 15px", borderRadius: 10, border: "1px solid rgba(174, 190, 224, 0.4)", color: "#ffffff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Sign In</Link>

                <Link to="/signup" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 15px", borderRadius: 10, background: "#7952db", color: "#ffffff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Sign Up</Link>

              </>

            )}

            <Link to={token ? "/profile" : "/login"} className="jg-main-topbar-avatar" aria-label="Open account" title={token ? displayName : "Sign in to your account"}>{token ? initials || <LogIn size={17} /> : <LogIn size={17} />}</Link>

          </div>

        </header>

        <main className="jg-main-page">

          <section className="jg-main-hero">

            <div className="jg-main-hero-shade" />

            <div className="jg-main-hero-content">

              <h1>Travel Smarter.<br /><span>Explore Further.</span></h1>

              <p>Multiple AI agents. One smart journey.</p>

              <Link to="/planner" className="jg-main-primary-btn">Plan Your Trip <Sparkles size={17} /></Link>

            </div>

            <div className="jg-main-hero-postcard"><div className="jg-main-postcard-image"><Globe2 size={35} /></div><span>Explore the World</span></div>

            <Plane className="jg-main-hero-plane" size={35} />

          </section>

          <section className="jg-main-feature-grid" aria-label="Journey Gen AI features">

            {FEATURES.map((feature) => {

              const Icon = feature.icon;

              return <article key={feature.title} className="jg-main-feature-card"><div className={`jg-main-feature-icon ${feature.tone}`}><Icon size={24} /></div><div className="jg-main-feature-copy"><h2>{feature.title}</h2><p>{feature.description}</p></div></article>;

            })}

          </section>

          <section aria-label="Explore destinations" style={{ margin: "30px 0 34px", color: discoveryColors.text, minWidth: 0, maxWidth: "100%" }}>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>

              <div>

                <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#9263ed", fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}><Sparkles size={16} /> Discover the world</div>

                <h2 style={{ margin: 0, fontSize: "clamp(23px, 2.5vw, 32px)", fontWeight: 850, color: discoveryColors.text }}>Where to next?</h2>

                <p style={{ color: discoveryColors.muted, margin: "7px 0 0", fontSize: 14 }}>Explore inspiring destinations and start planning your next adventure.</p>

              </div>

              <Link to="/planner" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#8b5cf6", fontWeight: 750, fontSize: 14 }}>Plan with AI <ArrowRight size={17} /></Link>

            </div>

            <DestinationCarousel title="Trending Destinations" subtitle="Inspiration for your next journey" destinations={[DISCOVERY_DESTINATIONS[0], DISCOVERY_DESTINATIONS[1], DISCOVERY_DESTINATIONS[2], DISCOVERY_DESTINATIONS[5], DISCOVERY_DESTINATIONS[8], DISCOVERY_DESTINATIONS[3]]} colors={discoveryColors} />

            <DestinationCarousel title="International Destinations" subtitle="Explore places beyond borders" destinations={DISCOVERY_DESTINATIONS.filter((destination) => destination.category === "International")} colors={discoveryColors} />

            <DestinationCarousel title="Explore India" subtitle="Discover beautiful places closer to home" destinations={DISCOVERY_DESTINATIONS.filter((destination) => destination.category === "India")} colors={discoveryColors} />

          </section>

          <div className="jg-main-dashboard-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>

            <section className="jg-main-panel jg-main-recent-panel">

              <div className="jg-main-panel-heading jg-main-panel-heading-row"><h2>Recent Trips</h2><Link to="/dashboard">View All <ArrowRight size={15} /></Link></div>

              <div className="jg-main-recent-list">

                {loadingTrips ? <div className="jg-main-empty">Loading saved trips...</div> : tripsError ? (

                  <div className="jg-main-empty"><p>{tripsError}</p><Link to="/dashboard">Open My Trips</Link></div>

                ) : recentTrips.length === 0 ? (

                  <div className="jg-main-empty"><Compass size={29} /><h3>No saved trips yet</h3><p>Your adventures will appear here when you save a trip.</p><Link to="/planner"><Plus size={15} /> Create a Trip</Link></div>

                ) : recentTrips.map((trip, index) => {

                  const id = getTripId(trip);

                  const status = getTripStatus(trip);

                  const travelerCount = getTravelers(trip);

                  const tripBudget = getBudget(trip);

                  return (

                    <article className="jg-main-trip-card" key={id ?? index}>

                      <div className="jg-main-trip-visual"><Plane size={29} /></div>

                      <div className="jg-main-trip-body">

                        <div className="jg-main-trip-title-row"><h3>{getDestination(trip)}</h3><span className={`jg-main-trip-status ${status === "Approved" ? "approved" : ""}`}>{status}</span></div>

                        <p className="jg-main-trip-date"><CalendarDays size={14} />{formatTripDates(trip)}{travelerCount && ` · ${travelerCount}`}</p>

                        <div className="jg-main-trip-bottom"><span className="jg-main-trip-budget">{tripBudget || "Budget not specified"}</span><button type="button" disabled={id === null} onClick={() => openTrip(trip)}>View Details <ArrowRight size={13} /></button></div>

                      </div>

                    </article>

                  );

                })}

              </div>

            </section>

          </div>

          <div className="jg-main-bottom-grid">

            <section className="jg-main-panel jg-main-workflow-panel">

              <div className="jg-main-panel-heading jg-main-panel-heading-row"><h2>AI Agent Workflow</h2><span className="jg-main-workflow-status"><span className="jg-main-status-dot" />How it works</span></div>

              <div className="jg-main-workflow-steps">

                {AGENT_STAGES.map((stage, index) => (

                  <div className="jg-main-workflow-step" key={index}>

                    <div className="jg-main-workflow-marker">{index === 4 ? <Sparkles size={17} /> : index === 5 ? <Check size={16} /> : <span>{index + 1}</span>}</div>

                    <span>{stage.title}</span>{stage.subtitle && <small>{stage.subtitle}</small>}

                  </div>

                ))}

              </div>

            </section>

            <section id="travel-statistics" className="jg-main-panel jg-main-stats-panel">

              <div className="jg-main-panel-heading jg-main-panel-heading-row"><h2>Your Travel Stats</h2><Link to="/dashboard">View All <ArrowRight size={14} /></Link></div>

              <div className="jg-main-stats-grid">

                <div className="jg-main-stat-card"><Plane size={20} /><strong>{loadingTrips || tripsError ? "—" : statistics.total}</strong><span>Total Trips</span></div>

                <div className="jg-main-stat-card"><Globe2 size={20} /><strong>{loadingTrips || tripsError ? "—" : statistics.destinations}</strong><span>Destinations</span></div>

                <div className="jg-main-stat-card"><CalendarDays size={20} /><strong>{loadingTrips || tripsError ? "—" : statistics.upcoming}</strong><span>Upcoming</span></div>

              </div>

            </section>

          </div>

        </main>

      </div>

    </div>

  );

}

export default Home;
