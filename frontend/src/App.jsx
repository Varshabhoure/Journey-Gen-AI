import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { ArrowRight, Map, Plane, Search, CircleHelp, BookOpen, ShieldCheck, Mail, RefreshCw, Bookmark, Share2, AlertTriangle, ChevronRight } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Planner from "./pages/Planner";
import Dashboard from "./pages/Dashboard";
import TripDetails from "./pages/TripDetails";
import PublicTrip from "./pages/PublicTrip";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";

const THEME_STORAGE_KEY = "journey-gen-ai-theme";
const VALID_THEMES = ["dark", "light", "system"];

function getSavedTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.includes(savedTheme) ? savedTheme : "dark";
  } catch {
    return "dark";
  }
}

function getSystemTheme() {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

function applyTheme(selectedTheme) {
  const resolvedTheme = selectedTheme === "system" ? getSystemTheme() : selectedTheme;
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  document.documentElement.style.colorScheme = resolvedTheme;
}

function useAppTheme() {
  const [theme, setTheme] = useState(getSavedTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const handleThemeChange = (event) => {
      const eventTheme = event?.detail?.theme;
      const nextTheme = VALID_THEMES.includes(eventTheme) ? eventTheme : getSavedTheme();
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };
    const handleStorageChange = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        const nextTheme = getSavedTheme();
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const handleSystemThemeChange = () => {
      if (getSavedTheme() === "system") applyTheme("system");
    };
    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleStorageChange);
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") mediaQuery.addEventListener("change", handleSystemThemeChange);
      else if (typeof mediaQuery.addListener === "function") mediaQuery.addListener(handleSystemThemeChange);
    }
    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleStorageChange);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") mediaQuery.removeEventListener("change", handleSystemThemeChange);
        else if (typeof mediaQuery.removeListener === "function") mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, []);
  return { theme, setTheme };
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function NotFoundPage() {
  return (
    <>
      <Navbar />
      <main className="jg-page">
        <div className="jg-container">
          <div className="jg-empty">
            <div className="jg-empty-icon"><Map size={44} /></div>
            <h2>We couldn't find that page.</h2>
            <p>The page may have moved or the address may be incorrect.</p>
            <Link to="/" className="jg-btn jg-btn-primary">Back to home <ArrowRight size={17} /></Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}


// Help & Support is intentionally defined in App.jsx so no additional page or CSS
// file is required. The page is public; account-specific actions still use
// the existing ProtectedRoute wrapper.
const HELP_TOPICS = [
  {
    id: "planning", label: "Trip planning", icon: BookOpen,
    questions: [
      {
        question: "How do I generate my first itinerary?",
        answer: "Open Plan Trip, enter your starting city, destination and dates, then choose any optional travel preferences. Select Generate Trip. Review the day-by-day plan and research findings before saving it."
      },
      {
        question: "What does the AI Agent Workflow mean?",
        answer: "The Planner checks your preferences, researches the transport, hotel, weather and budget options you selected, and assembles the itinerary. Only relevant optional research agents should be used. The Planner page displays progress as generation runs; the Home page shows a general overview, not live activity."
      },
      {
        question: "Are flight prices, train schedules, hotel rooms and weather forecasts confirmed?",
        answer: "No. Web research may include route pages, estimates or current conditions rather than confirmed date-specific services. Check operating schedules, availability, fares and weather with the relevant provider before booking or travelling."
      },
      {
        question: "Why is a trip taking a long time to generate?",
        answer: "Travel research can take longer when multiple agents or external services are selected. You can choose fewer optional research options for a simpler plan. If a request stops responding, use Cancel & Reset, then try again."
      }
    ]
  },
  {
    id: "saved", label: "Saved trips", icon: Bookmark,
    questions: [
      {
        question: "How do I save and open my generated trip?",
        answer: "Select Save Trip after reviewing your itinerary. Then open My Trips or the Dashboard and select Open / Edit on your saved trip. You must be signed in to access your private saved trips."
      },
      {
        question: "Can I change only one day?",
        answer: "Yes. Use Regenerate This Day in the Planner or Regenerate Day on a saved trip. Review the alternative first. Accept the change to apply it, or Keep Original to leave that day unchanged. Other itinerary days should be preserved."
      },
      {
        question: "Why does an older saved trip show missing dates or travelers?",
        answer: "Trips saved before data-field fixes may have incomplete information. New saves keep the generation details. For an older trip, review it in My Trips; regenerate or save a corrected trip if the original record is incomplete."
      }
    ]
  },
  {
    id: "sharing", label: "Sharing & privacy", icon: Share2,
    questions: [
      {
        question: "How do I share a trip with someone?",
        answer: "Open a saved trip and choose Create Public Link. Copy the link or share its QR code. Anyone who can open the link can view that read-only itinerary without signing in."
      },
      {
        question: "Can someone with my public link change my itinerary?",
        answer: "No. Shared trips are read-only. To stop others opening your shared itinerary, return to the saved trip and choose Disable Public Link."
      },
      {
        question: "Why doesn't my public link work on another phone?",
        answer: "A link beginning with localhost or 127.0.0.1 points to the device opening it, not your development PC. To share with another device, deploy the app to a reachable HTTPS address and generate the public link there."
      }
    ]
  },
  {
    id: "account", label: "Account & issues", icon: ShieldCheck,
    questions: [
      {
        question: "Why was I redirected to Login?",
        answer: "Planner, Dashboard and private trip pages require an account. If you are signed out or your login session has expired, sign in again and reopen your trip. Public shared-trip links do not require an account."
      },
      {
        question: "What should I do if I see a generation or regeneration error?",
        answer: "Read the error shown on the page. Check that your start date and return date are valid, and try again. If the backend reports a rate limit or an unavailable AI service, wait until the provider allows requests again. For repeated errors, save the exact error message from the browser or FastAPI terminal for troubleshooting."
      },
      {
        question: "Can I download my itinerary?",
        answer: "Yes. Generated and saved-trip pages offer download options. The available format depends on the page; some views also offer copying the itinerary text or downloading a QR code."
      }
    ]
  }
];

const HELP_STYLES = `
  .jg-help-page {
    --jh-text: #162444;
    --jh-muted: #556686;
    --jh-surface: #ffffff;
    --jh-soft: #f4f3ff;
    --jh-border: #dfe3f2;
    --jh-accent: #6845d8;
    min-height: 68vh;
    padding: 56px 20px 72px;
    color: var(--jh-text);
    background: radial-gradient(circle at 80% 0%, #eae5ff, transparent 46%), #f6f7fc;
  }
  html[data-theme="dark"] .jg-help-page {
    --jh-text: #f5f6ff;
    --jh-muted: #bfcae8;
    --jh-surface: #192448;
    --jh-soft: #212c53;
    --jh-border: #34416b;
    --jh-accent: #b69aff;
    background: radial-gradient(circle at 80% 0%, #1b2252, transparent 48%), #0b1430;
  }
  .jg-help-wrap { width: min(1150px, 100%); margin: auto; }
  .jg-help-kicker { display: inline-flex; align-items: center; gap: 8px; color: var(--jh-accent); font-size: 13px; letter-spacing: 1.4px; font-weight: 800; text-transform: uppercase; }
  .jg-help-hero { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 26px; }
  .jg-help-hero h1 { font-size: clamp(30px, 4.2vw, 48px); font-weight: 850; line-height: 1.14; margin: 12px 0 12px; color: var(--jh-text); }
  .jg-help-hero p { color: var(--jh-muted); font-size: 16px; line-height: 1.65; margin: 0; max-width: 690px; }
  .jg-help-hero-icon { display: grid; place-items: center; width: 92px; height: 92px; flex: 0 0 92px; border-radius: 24px; color: white; background: linear-gradient(135deg,#b83ff0,#4568ef); box-shadow: 0 15px 40px #825aff35; }
  .jg-help-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 24px 0 30px; }
  .jg-help-primary, .jg-help-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 46px; padding: 11px 18px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 750; transition: transform .18s, filter .18s; }
  .jg-help-primary { background: linear-gradient(105deg,#963cef,#4363ef); color: #fff; }
  .jg-help-primary:hover, .jg-help-secondary:hover { transform: translateY(-1px); filter: brightness(1.08); }
  .jg-help-secondary { background: var(--jh-surface); color: var(--jh-text); border: 1px solid var(--jh-border); }
  .jg-help-layout { display: grid; grid-template-columns: minmax(0, 1fr) 286px; gap: 22px; align-items: start; }
  .jg-help-main, .jg-help-aside-card { border-radius: 20px; border: 1px solid var(--jh-border); background: var(--jh-surface); box-shadow: 0 12px 34px rgba(22,32,76,.045); }
  .jg-help-main { min-width: 0; padding: 26px; }
  .jg-help-main h2 { font-size: 23px; margin: 0 0 6px; color: var(--jh-text); }
  .jg-help-description { color: var(--jh-muted); margin: 0 0 20px; font-size: 14px; }
  .jg-help-search { display: flex; align-items: center; gap: 11px; min-height: 50px; padding: 0 16px; border-radius: 12px; color: var(--jh-muted); background: var(--jh-soft); border: 1px solid var(--jh-border); }
  .jg-help-search:focus-within { outline: 2px solid var(--jh-accent); outline-offset: 2px; }
  .jg-help-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--jh-text); font-size: 14px; }
  .jg-help-search input::placeholder { color: var(--jh-muted); opacity: 1; }
  .jg-help-filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 17px 0 24px; }
  .jg-help-filter { display: inline-flex; gap: 7px; align-items: center; padding: 9px 12px; border-radius: 999px; border: 1px solid var(--jh-border); background: var(--jh-surface); color: var(--jh-muted); font-size: 12px; font-weight: 700; cursor: pointer; }
  .jg-help-filter.is-selected { color: #fff; border-color: #7554ec; background: linear-gradient(95deg,#843ce8,#4863ec); }
  .jg-help-filter:focus-visible, .jg-help-actions a:focus-visible { outline: 3px solid var(--jh-accent); outline-offset: 3px; }
  .jg-help-group { margin: 22px 0 0; }
  .jg-help-group-title { display: flex; gap: 9px; align-items: center; margin: 0 0 10px; font-size: 15px; color: var(--jh-accent); font-weight: 800; }
  .jg-help-question { border: 1px solid var(--jh-border); border-radius: 12px; background: var(--jh-surface); margin-bottom: 9px; overflow: hidden; }
  .jg-help-question summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px 17px; list-style: none; cursor: pointer; color: var(--jh-text); font-size: 14px; line-height: 1.5; font-weight: 700; }
  .jg-help-question summary::-webkit-details-marker { display: none; }
  .jg-help-question summary:focus-visible { outline: 3px solid var(--jh-accent); outline-offset: -3px; }
  .jg-help-question summary svg { flex: 0 0 18px; color: var(--jh-accent); transition: transform .18s; }
  .jg-help-question[open] summary svg { transform: rotate(90deg); }
  .jg-help-question[open] { background: var(--jh-soft); }
  .jg-help-answer { color: var(--jh-muted); border-top: 1px solid var(--jh-border); padding: 15px 17px 18px; font-size: 14px; line-height: 1.75; }
  .jg-help-no-results { border: 1px dashed var(--jh-border); border-radius: 12px; padding: 22px; color: var(--jh-muted); font-size: 14px; }
  .jg-help-aside { display: grid; gap: 16px; }
  .jg-help-aside-card { padding: 22px; }
  .jg-help-aside-card h2 { font-size: 17px; color: var(--jh-text); margin: 0 0 9px; }
  .jg-help-aside-card p, .jg-help-aside-card li { color: var(--jh-muted); font-size: 13px; line-height: 1.7; }
  .jg-help-aside-card ol { padding-left: 21px; margin: 8px 0 0; }
  .jg-help-aside-card a { color: var(--jh-accent); font-weight: 750; overflow-wrap: anywhere; }
  .jg-help-aside-card .jg-help-note { margin-bottom: 0; font-size: 12px; }
  @media (max-width: 850px) { .jg-help-layout { grid-template-columns: 1fr; } .jg-help-aside { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (max-width: 620px) { .jg-help-page { padding: 32px 15px 46px; } .jg-help-main { padding: 19px 15px; } .jg-help-hero-icon { display:none; } .jg-help-aside { grid-template-columns: 1fr; } .jg-help-hero p { font-size: 14px; } }
  @media (prefers-reduced-motion: reduce) { .jg-help-primary, .jg-help-secondary, .jg-help-question summary svg { transition: none; } }
`;

function HelpSupportPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
  const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || "").trim();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingTopics = HELP_TOPICS
    .filter((group) => topic === "all" || group.id === topic)
    .map((group) => ({
      ...group,
      questions: group.questions.filter((entry) =>
        !normalizedQuery || `${entry.question} ${entry.answer} ${group.label}`.toLocaleLowerCase().includes(normalizedQuery)
      ),
    }))
    .filter((group) => group.questions.length > 0);

  return (
    <>
      <Navbar />
      <style>{HELP_STYLES}</style>
      <main className="jg-help-page">
        <div className="jg-help-wrap">
          <header className="jg-help-hero">
            <div>
              <span className="jg-help-kicker"><CircleHelp size={17} /> Journey Gen AI Support</span>
              <h1>How can we help?</h1>
              <p>Find answers about planning with AI, managing saved trips, regenerating days, sharing itineraries, and resolving common errors.</p>
            </div>
            <div className="jg-help-hero-icon" aria-hidden="true"><CircleHelp size={43} /></div>
          </header>

          <div className="jg-help-actions">
            <Link to="/planner" className="jg-help-primary"><Plane size={17} aria-hidden="true" /> Open AI Planner <ArrowRight size={17} /></Link>
            <Link to="/dashboard" className="jg-help-secondary"><Bookmark size={17} /> My Saved Trips</Link>
            <Link to="/" className="jg-help-secondary"><ArrowRight size={17} style={{ transform: "rotate(180deg)" }} /> Home</Link>
          </div>

          <div className="jg-help-layout">
            <section className="jg-help-main" aria-labelledby="help-faq-title">
              <h2 id="help-faq-title">Frequently asked questions</h2>
              <p className="jg-help-description">Search for an answer or choose a topic.</p>
              <label className="jg-help-search">
                <Search size={20} aria-hidden="true" />
                <input type="search" aria-label="Search help questions" placeholder="Search help topics..." value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="jg-help-filters" role="group" aria-label="Filter help topics">
                <button type="button" className={`jg-help-filter ${topic === "all" ? "is-selected" : ""}`} onClick={() => setTopic("all")} aria-pressed={topic === "all"}>All topics</button>
                {HELP_TOPICS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={`jg-help-filter ${topic === id ? "is-selected" : ""}`} onClick={() => setTopic(id)} aria-pressed={topic === id}><Icon size={15} aria-hidden="true" />{label}</button>
                ))}
              </div>
              {matchingTopics.length === 0 && <div className="jg-help-no-results" role="status">No matching questions. Try a shorter search or choose All topics.</div>}
              {matchingTopics.map(({ id, label, icon: Icon, questions }) => (
                <section key={id} className="jg-help-group" aria-label={label}>
                  <h3 className="jg-help-group-title"><Icon size={19} aria-hidden="true" />{label}</h3>
                  {questions.map(({ question, answer }) => (
                    <details className="jg-help-question" key={question}>
                      <summary>{question}<ChevronRight size={18} aria-hidden="true" /></summary>
                      <div className="jg-help-answer">{answer}</div>
                    </details>
                  ))}
                </section>
              ))}
            </section>

            <aside className="jg-help-aside" aria-label="Other support information">
              <section className="jg-help-aside-card">
                <h2><RefreshCw size={18} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 8, color: "var(--jh-accent)" }} />Quick troubleshooting</h2>
                <ol>
                  <li>Check that your trip dates and locations are valid.</li>
                  <li>Read the error shown on the page.</li>
                  <li>If generation stalls, use Cancel &amp; Reset and try again.</li>
                  <li>For a repeatable error, keep the browser error and FastAPI log.</li>
                </ol>
              </section>
              <section className="jg-help-aside-card">
                <h2><Mail size={18} aria-hidden="true" style={{ verticalAlign: "middle", marginRight: 8, color: "var(--jh-accent)" }} />Contact & feedback</h2>
                {supportEmail ? <p>Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p> : <p>For now, use the troubleshooting and FAQ guidance on this page. A direct support email has not been configured.</p>}
                {supportPhone && <p>Phone: <a href={`tel:${supportPhone.replace(/[^+\d]/g, "")}`}>{supportPhone}</a></p>}
                <p className="jg-help-note"><AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 5 }} aria-hidden="true" />Never share your password, access token, or API keys when reporting a problem.</p>
              </section>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function App() {
  useAppTheme();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shared/:shareToken" element={<PublicTrip />} />
      <Route path="/help-and-support" element={<HelpSupportPage />} />
      <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
      <Route path="/trips/:id" element={<ProtectedRoute><TripDetails /></ProtectedRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
export default App;
