import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import {

  Plane,

  MapPin,

  CalendarDays,

  Users,

  Plus,

  Trash2,

  RefreshCw,

  Map,

  Sparkles,

  FolderOpen,

  Search,

  X,

  ArrowUpDown,

  ArrowLeft,

  Compass

} from 'lucide-react';

import { getSavedTrips, deleteTrip } from '../services/aiService';

import './Dashboard.css';

function Dashboard() {

  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [dateFilter, setDateFilter] = useState('all');

  const [sortOrder, setSortOrder] = useState('newest');

  const [user, setUser] = useState(() => {

    try { return JSON.parse(localStorage.getItem('user') || '{}'); }

    catch { return {}; }

  });

  const displayName = [user.first_name, user.middle_name, user.last_name]

    .filter(Boolean).join(' ').trim() || user.full_name || user.name || 'Traveler';

  useEffect(() => {

    const syncUser = () => {

      try { setUser(JSON.parse(localStorage.getItem('user') || '{}')); }

      catch { setUser({}); }

    };

    window.addEventListener('storage', syncUser);

    window.addEventListener('focus', syncUser);

    return () => {

      window.removeEventListener('storage', syncUser);

      window.removeEventListener('focus', syncUser);

    };

  }, []);

  // Read the exact values saved with the generated itinerary. Do not try to
  // infer an original trip from the AI's descriptive Markdown.
  const getDestination = (trip) =>
    trip.formData?.destination || trip.title || 'Untitled Trip';

  const getTravelDate = (trip) =>
    trip.formData?.startDate || trip.formData?.travelDate || '';

  const getReturnDate = (trip) =>
    trip.formData?.endDate || trip.formData?.returnDate || '';

  // Safely interpret YYYY-MM-DD without a UTC timezone conversion that can
  // shift a calendar day for viewers in other timezones.
  const parseCalendarDate = (value) => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 &&
      date.getDate() === day ? date : null;
  };

  const getTripDates = (trip) => {
    const start = parseCalendarDate(getTravelDate(trip));
    const end = parseCalendarDate(getReturnDate(trip));
    return {start, end, invalidRange: Boolean(start && end && end < start)};
  };

  const wholeCount = (value) => {
    if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };

  const getTravelers = (trip) => {
    const form = trip.formData || {};
    const adults = wholeCount(form.adults);
    const children = wholeCount(form.children);
    const members = (adults ?? 0) + (children ?? 0);
    const savedCount = wholeCount(form.travelers) ?? wholeCount(form.numberOfTravelers);
    const total = members > 0 ? members : savedCount;
    if (total === null || total === undefined || total <= 0) return 'Travelers not specified';

    // New trips have separate adult/child counts. Legacy trips may only have
    // total travelers, in which case don't invent their composition.
    const breakdown = [];
    if (members > 0) {
      if (adults > 0) breakdown.push(`${adults} adult${adults === 1 ? '' : 's'}`);
      if (children > 0) breakdown.push(`${children} child${children === 1 ? '' : 'ren'}`);
    }
    return `${total} traveler${total === 1 ? '' : 's'}` +
      (breakdown.length ? ` (${breakdown.join(', ')})` : '');
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getTripStatus = (trip) => {
    const {start, end, invalidRange} = getTripDates(trip);
    if (invalidRange) return {label: 'Check dates', className: 'no-date'};
    const lastDay = end || start;
    if (!lastDay) return {label: 'Date not set', className: 'no-date'};
    if (lastDay < today) return {label: 'Completed', className: 'completed'};
    if (start && start <= today) return {label: 'In progress', className: 'upcoming'};
    return {label: 'Upcoming', className: 'upcoming'};
  };

  // Trips remain current until their return date has passed (not until
  // their departure date has passed). This also drives search filters.
  const isUpcomingTrip = (trip) => {
    const {start, end, invalidRange} = getTripDates(trip);
    return !invalidRange && Boolean((end || start) && (end || start) >= today);
  };
  const isPastTrip = (trip) => {
    const {start, end, invalidRange} = getTripDates(trip);
    return !invalidRange && Boolean((end || start) && (end || start) < today);
  };

  const upcomingTrips = trips.filter(isUpcomingTrip).length;
  const pastTrips = trips.filter(isPastTrip).length;

  const loadTrips = async () => {

    try {

      setLoading(true);

      setError('');

      const data = await getSavedTrips();

      setTrips(Array.isArray(data) ? data : []);

    } catch (err) {

      console.error('Dashboard loading error:', err);

      setError(err.message || 'Unable to load your saved trips.');

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    loadTrips();

  }, []);

  const handleDelete = async (tripId) => {

    const confirmed = window.confirm(

      'Are you sure you want to delete this trip?'

    );

    if (!confirmed) return;

    try {

      await deleteTrip(tripId);

      setTrips((previousTrips) =>

        previousTrips.filter((trip) => trip.id !== tripId)

      );

    } catch (err) {

      window.alert(err.message || 'Unable to delete this trip.');

    }

  };

  const handleOpenTrip = (trip) => {

    navigate(`/trips/${trip.id}`);

  };

  const filteredTrips = useMemo(() => {

    const searchText = searchTerm.trim().toLowerCase();

    const filtered = trips.filter((trip) => {

      const destination = getDestination(trip).toLowerCase();

      const title = (trip.title || '').toLowerCase();

      const source = (trip.formData?.source || '').toLowerCase();

      const matchesSearch =

        !searchText ||

        destination.includes(searchText) ||

        title.includes(searchText) ||

        source.includes(searchText);

      let matchesDate = true;

      if (dateFilter === 'upcoming') {
        matchesDate = isUpcomingTrip(trip);
      } else if (dateFilter === 'past') {
        matchesDate = isPastTrip(trip);
      }

      return matchesSearch && matchesDate;

    });

    return [...filtered].sort((a, b) => {

      if (sortOrder === 'destination') {

        return getDestination(a).localeCompare(getDestination(b));

      }

      if (sortOrder === 'oldest') {

        return (

          new Date(a.savedAt || 0).getTime() -

          new Date(b.savedAt || 0).getTime()

        );

      }

      return (

        new Date(b.savedAt || 0).getTime() -

        new Date(a.savedAt || 0).getTime()

      );

    });

  }, [trips, searchTerm, dateFilter, sortOrder]);

  const clearFilters = () => {

    setSearchTerm('');

    setDateFilter('all');

    setSortOrder('newest');

  };

  const formatTravelDate = (trip) => {
    const {start, end, invalidRange} = getTripDates(trip);
    const display = date => date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    if (!start && !end) return 'Date not specified';
    if (invalidRange) return `${display(start)} – ${display(end)} (check dates)`;
    if (start && end) return `${display(start)} – ${display(end)}`;
    return display(start || end);
  };

  const formatSavedDate = (trip) => {

    if (!trip.savedAt) return 'Saved trip';

    const date = new Date(trip.savedAt);

    if (Number.isNaN(date.getTime())) return 'Saved trip';

    return `Saved ${date.toLocaleDateString('en-IN')}`;

  };

  return (

    <div className="dashboard-shell">

      <header className="dashboard-brandbar">

        <button className="dashboard-back" onClick={() => navigate('/')} type="button">

          <ArrowLeft size={18} /> Back to Home

        </button>

        <button className="dashboard-brand" onClick={() => navigate('/')} type="button" aria-label="Journey Gen AI home">

          <img src="/journey-gen-ai-logo.png" alt="Journey Gen AI logo" />

          <span><strong>Journey</strong><strong>Gen AI</strong></span>

        </button>

      </header>

      <main className="dashboard-page">

        <section className="dashboard-header">

          <div>

            <span className="section-label"><Compass size={15} /> YOUR TRAVEL SPACE</span>

            <h1>

              Welcome back, <span className="dashboard-gradient-text">{displayName}</span>!

            </h1>

            <p>

              Manage your journeys and continue planning your next adventure.

            </p>

          </div>

          <button

            className="primary-btn"

            onClick={() => navigate('/planner')}

          >

            <Plus size={19} />

            Plan New Trip

          </button>

        </section>

        <section className="dashboard-stats">

          <div className="dashboard-stat-card">

            <div className="dashboard-stat-icon">

              <Plane size={24} />

            </div>

            <div>

              <span>Total Saved Trips</span>

              <h2>{trips.length}</h2>

            </div>

          </div>

          <div className="dashboard-stat-card">

            <div className="dashboard-stat-icon">

              <Map size={24} />

            </div>

            <div>

              <span>Upcoming Trips</span>

              <h2>{upcomingTrips}</h2>

            </div>

          </div>

          <div className="dashboard-stat-card">

            <div className="dashboard-stat-icon">

              <CalendarDays size={24} />

            </div>

            <div>

              <span>Past Trips</span>

              <h2>{pastTrips}</h2>

            </div>

          </div>

        </section>

        <section className="dashboard-trips-section">

          <div className="dashboard-section-heading">

            <div>

              <h2>My Saved Trips</h2>

              <p>Your saved travel itineraries in one place.</p>

            </div>

            <button

              className="dashboard-refresh-btn"

              onClick={loadTrips}

              disabled={loading}

            >

              <RefreshCw

                size={17}

                className={loading ? 'dashboard-spinning' : ''}

              />

              Refresh

            </button>

          </div>

          {loading ? (

            <div className="dashboard-message">

              Loading your trips...

            </div>

          ) : error ? (

            <div className="dashboard-message dashboard-error">

              <p>{error}</p>

              <button onClick={loadTrips}>Try Again</button>

            </div>

          ) : trips.length === 0 ? (

            <div className="dashboard-empty">

              <div className="dashboard-empty-icon">

                <Plane size={35} />

              </div>

              <h3>No trips saved yet</h3>

              <p>

                Start planning your first journey and your saved trips

                will appear here.

              </p>

              <button

                className="primary-btn"

                onClick={() => navigate('/planner')}

              >

                <Sparkles size={18} />

                Create Your First Trip

              </button>

            </div>

          ) : (

            <>

              <div className="dashboard-trip-filters">

                <div className="dashboard-search-box">

                  <Search size={19} />

                  <input

                    type="text"

                    placeholder="Search by destination, title or starting city..."

                    value={searchTerm}

                    onChange={(e) => setSearchTerm(e.target.value)}

                    aria-label="Search saved trips"

                  />

                  {searchTerm && (

                    <button

                      type="button"

                      onClick={() => setSearchTerm('')}

                      aria-label="Clear search"

                    >

                      <X size={17} />

                    </button>

                  )}

                </div>

                <select

                  className="dashboard-date-filter"

                  value={dateFilter}

                  onChange={(e) => setDateFilter(e.target.value)}

                  aria-label="Filter trips by travel date"

                >

                  <option value="all">All Trips</option>

                  <option value="upcoming">Upcoming Trips</option>

                  <option value="past">Past Trips</option>

                </select>

                <div className="dashboard-sort-box">

                  <ArrowUpDown size={17} />

                  <select

                    className="dashboard-sort-filter"

                    value={sortOrder}

                    onChange={(e) => setSortOrder(e.target.value)}

                    aria-label="Sort saved trips"

                  >

                    <option value="newest">Newest First</option>

                    <option value="oldest">Oldest First</option>

                    <option value="destination">Destination A–Z</option>

                  </select>

                </div>

              </div>

              <div className="dashboard-results-row">

                <p className="dashboard-results-count">

                  Showing <strong>{filteredTrips.length}</strong> of{' '}

                  <strong>{trips.length}</strong> trips

                </p>

                {(searchTerm ||

                  dateFilter !== 'all' ||

                  sortOrder !== 'newest') && (

                  <button

                    className="dashboard-clear-btn"

                    onClick={clearFilters}

                  >

                    <X size={15} />

                    Reset

                  </button>

                )}

              </div>

              {filteredTrips.length === 0 ? (

                <div className="dashboard-empty dashboard-no-results">

                  <div className="dashboard-empty-icon">

                    <Search size={30} />

                  </div>

                  <h3>No matching trips found</h3>

                  <p>

                    Try another search term or change your filters.

                  </p>

                  <button

                    className="primary-btn"

                    onClick={clearFilters}

                  >

                    <X size={17} />

                    Clear Filters

                  </button>

                </div>

              ) : (

                <div className="dashboard-trips-grid">

                  {filteredTrips.map((trip) => {

                    const status = getTripStatus(trip);

                    return (

                      <article

                        className="dashboard-trip-card"

                        key={trip.id}

                      >

                        <div className="dashboard-trip-top">

                          <div className="dashboard-trip-icon">

                            <Plane size={24} />

                          </div>

                          <span

                            className={`dashboard-trip-status ${status.className}`}

                          >

                            {status.label}

                          </span>

                          <button

                            className="dashboard-delete-btn"

                            onClick={() => handleDelete(trip.id)}

                            aria-label={`Delete ${getDestination(trip)}`}

                            title="Delete trip"

                          >

                            <Trash2 size={18} />

                          </button>

                        </div>

                        <h3>{getDestination(trip)}</h3>

                        <div className="dashboard-trip-detail">

                          <CalendarDays size={16} />

                          <span>{formatTravelDate(trip)}</span>

                        </div>

                        <div className="dashboard-trip-detail">

                          <Users size={16} />

                          <span>{getTravelers(trip)}</span>

                        </div>

                        <div className="dashboard-trip-detail">

                          <MapPin size={16} />

                          <span>

                            {trip.formData?.source ||

                              'Starting city not specified'}

                          </span>

                        </div>

                        <div className="dashboard-trip-detail">

                          <Sparkles size={16} />

                          <span>

                            {trip.formData?.budget || 'Budget not specified'}

                          </span>

                        </div>

                        <div className="dashboard-trip-footer">

                          <span>{formatSavedDate(trip)}</span>

                          <button

                            onClick={() => handleOpenTrip(trip)}

                            className="dashboard-view-btn"

                          >

                            <FolderOpen size={16} />

                            Open / Edit

                          </button>

                        </div>

                      </article>

                    );

                  })}

                </div>

              )}

            </>

          )}

        </section>

      </main>

    </div>

  );

}

export default Dashboard;
