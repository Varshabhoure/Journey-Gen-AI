import { Link } from 'react-router-dom';
import {
  Plane,
  ArrowRight,
  Heart,
  Compass,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="jg-footer">
      <style>{`
        .jg-footer-main.jg-footer-main-compact {
          display: grid;
          grid-template-columns: minmax(260px, 1.65fr) repeat(2, minmax(155px, 1fr));
          gap: clamp(24px, 3.2vw, 54px);
        }
        @media (max-width: 760px) {
          .jg-footer-main.jg-footer-main-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 480px) {
          .jg-footer-main.jg-footer-main-compact {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
      <div className="jg-footer-main jg-container jg-footer-main-compact">
        {/* Brand and description */}
        <div className="jg-footer-about">
          <Link
            to="/"
            className="jg-footer-logo"
            aria-label="Journey Gen AI - Home"
          >
            <img
              src="/journey-gen-ai-logo.png"
              alt=""
              aria-hidden="true"
              className="jg-footer-brand-image"
              style={{
                width: '44px',
                height: '44px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <span>
              Journey <strong>Gen AI</strong>
            </span>
          </Link>

          <p>
            Plan smarter and explore further. Journey Gen AI brings
            intelligent travel research, personalized itineraries and
            budget planning together to help organize your next adventure.
          </p>

          <Link to="/planner" className="jg-footer-plan-link">
            Start planning
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Explore links */}
        <div className="jg-footer-column">
          <h3>Explore</h3>
          <Link to="/">Home</Link>
          <a href="/#destinations">
            <Compass size={15} />
            Destinations
          </a>
          <a href="/#features">
            <Sparkles size={15} />
            Features
          </a>
          <Link to="/planner">
            <Plane size={15} />
            AI Planner
          </Link>
        </div>

        {/* Account and planning links */}
        <div className="jg-footer-column">
          <h3>Your Journey</h3>
          <Link to="/planner">Plan a Trip</Link>
          <Link to="/dashboard">
            <LayoutDashboard size={15} />
            My Dashboard
          </Link>
          <Link to="/login">Login</Link>
          <Link to="/signup">Create Account</Link>
        </div>

      </div>

      {/* Copyright */}
      <div className="jg-footer-bottom">
        <div className="jg-container jg-footer-bottom-inner">
          <p>
            © {currentYear} Journey Gen AI. All rights reserved.
          </p>
          <p className="jg-footer-made">
            Made with <Heart size={14} fill="currentColor" /> for travellers.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
