import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDays, MapPin, Users, Wallet, Plane, RefreshCw, Sparkles,
  Clock3, Heart, Navigation, Hotel, CloudSun, Calculator, TrainFront,
  Bus, CarFront, Info, ChevronDown, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getPublicTrip } from '../services/aiService';
import './PublicTrip.css';

// Shared trips use the exact saved snapshot, not the user's current Planner settings.
// This read-only page intentionally does not expose editing or regeneration controls.
const cleanText = value => String(value ?? '').trim();
const formatDate = value => {
  if (!value) return 'Not specified';
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? text
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};
const getInterests = value => Array.isArray(value) ? (value.join(', ') || 'Not specified') : (value || 'Not specified');
const getTravelerLabel = data => {
  const adults = Number(data.adults);
  const children = Number(data.children);
  const hasAdults = data.adults !== '' && data.adults != null && Number.isFinite(adults) && adults >= 0;
  const hasChildren = data.children !== '' && data.children != null && Number.isFinite(children) && children >= 0;
  if (hasAdults || hasChildren) {
    const total = (hasAdults ? adults : 0) + (hasChildren ? children : 0);
    if (total > 0) return `${total} ${total === 1 ? 'traveler' : 'travelers'} (${hasAdults ? adults : 0} adult${adults === 1 ? '' : 's'}, ${hasChildren ? children : 0} child${children === 1 ? '' : 'ren'})`;
  }
  const count = data.travelers ?? data.numberOfTravelers;
  return count == null || count === '' ? 'Not specified' : `${count} traveler(s)`;
};
const normalizeMarkdown = value => typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
const dayHeading = line => cleanText(line).match(/^\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?Day\s+(\d+)\b([^\n]*?)(?:\*\*)?\s*$/i);
const summaryHeading = line => /^\s{0,3}#{1,6}\s+(?:important notes|travel tips|booking notes|budget snapshot|budget breakdown|transportation summary|trip summary|packing list|conclusion)\b/i.test(line);
const splitItinerary = value => {
  const text = normalizeMarkdown(value);
  if (!text) return [{ key: 'empty', type: 'content', content: 'No itinerary is available for this trip.' }];
  const sections = [];
  let current = null;
  const flush = () => {
    if (current && current.lines.join('\n').trim()) {
      sections.push({ ...current, content: current.lines.join('\n').trim() });
    }
  };
  for (const line of text.split('\n')) {
    const matched = dayHeading(line);
    if (matched && (line.trim().startsWith('#') || /^\s*(?:\*\*)?Day\s+\d+/i.test(line))) {
      flush();
      current = { key: `day-${matched[1]}-${sections.length}`, type: 'day', dayNumber: Number(matched[1]), lines: [line] };
    } else if (current?.type === 'day' && summaryHeading(line)) {
      flush();
      current = { key: `notes-${sections.length}`, type: 'content', lines: [line] };
    } else {
      if (!current) current = { key: 'intro', type: 'content', lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return sections;
};

const cleanActivity = value => cleanText(value)
  .replace(/<br\s*\/?\s*>/gi, ' · ')
  .replace(/<[^>]*>/g, '')
  .replace(/\*\*/g, '').replace(/[`*_]/g, '')
  .replace(/\s+/g, ' ').trim();
const PERIOD = /^(?:morning|midday|afternoon|evening|night|mid-morning|late afternoon)\s*:?$/i;
const ADVICE = /^(?:important notes?|notes?|tips?|reminder|please\s+)?(?:verify|confirm|check|remember|carry|book in advance|keep|pack|ensure)\b/i;
const CLOCK = String.raw`(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:AM|PM)?`;
const TIME_LINE = new RegExp(`^(${CLOCK}(?:\\s*(?:[-–—]|to)\\s*${CLOCK})?|Flexible|Time to confirm)\\s*(?:[|:]\\s*|[–—-]\\s+)(.+)$`, 'i');
const MONEY = /(?:₹|\bINR\b|\bRs\.?\s*)\s*\d[\d,]*(?:\s*[-–]\s*(?:₹|INR|Rs\.?)?\s*\d[\d,]*)?/i;
const isTableRule = value => /^\|?[\s|:\-]+\|?$/.test(value) && value.includes('-');
const parseDayContent = content => {
  const lines = normalizeMarkdown(content).split('\n');
  const items = [], notes = [], other = [];
  let period = '';
  let inNotes = false;
  const seen = new Set();
  const add = (time, description, cost = '') => {
    const activity = cleanActivity(description);
    if (!activity || /^\b(?:time|activity|description|estimated cost|details)\b$/i.test(activity)) return;
    if (ADVICE.test(activity) || /^(?:important notes?|booking checklist)\s*:/i.test(activity)) {
      notes.push(activity); return;
    }
    const dedupeKey = `${time}|${activity}`.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const priced = cleanActivity(cost).match(MONEY)?.[0] || '';
    items.push({ time: cleanActivity(time) || period || 'Flexible', activity, cost: priced });
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (dayHeading(line) && line.match(/^\s*(?:#{1,6}\s*)?(?:\*\*)?Day\s+\d+/i)) continue;
    const heading = cleanActivity(line.replace(/^#{1,6}\s*/, ''));
    if (PERIOD.test(heading)) { period = heading.replace(/:$/, ''); continue; }
    if (/^#{1,6}\s/.test(line)) {
      if (/\b(?:notes?|tips?|reminders?|verification|checklist)\b/i.test(heading)) { inNotes = true; other.push(line); }
      else other.push(line);
      continue;
    }
    if (line.startsWith('|')) {
      if (isTableRule(line)) continue;
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cleanActivity);
      if (cells.length < 2 || /^(?:time|slot|period|activity|description)$/i.test(cells[0])) continue;
      if (inNotes) { notes.push(cells.join(' — ')); continue; }
      const firstIsTime = /^(?:flexible|time to confirm)$/i.test(cells[0]) || new RegExp(`^${CLOCK}$`, 'i').test(cells[0]) || PERIOD.test(cells[0]);
      if (firstIsTime) add(cells[0], cells[1], cells.slice(2).join(' '));
      else {
        const timeMatch = cells[0].match(TIME_LINE);
        if (timeMatch) add(timeMatch[1], [timeMatch[2], cells[1]].filter(Boolean).join(' — '), cells.slice(2).join(' '));
        else add('', cells[0], cells.slice(1).join(' '));
      }
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*•]\s+|\d+[.)]\s+)(.+)$/u);
    if (bullet) {
      const activityText = cleanActivity(bullet[1]);
      if (inNotes || ADVICE.test(activityText) || /^(?:important|note|tip)\s*:/i.test(activityText)) {
        notes.push(activityText); continue;
      }
      const timed = activityText.match(TIME_LINE);
      if (timed) {
        const chunks = timed[2].split(/\s*\|\s*/);
        add(timed[1], chunks[0], chunks.slice(1).join(' | '));
      } else {
        const chunks = activityText.split(/\s*\|\s*/);
        add('', chunks[0], chunks.slice(1).join(' | '));
      }
      continue;
    }
    if (inNotes) notes.push(heading);
    else if (!/^(?:trip:|route:|travelers:|dates:)\b/i.test(heading)) other.push(line);
  }
  return { items, notes: [...new Set(notes)], other: other.join('\n').trim() };
};
const safeLink = value => {
  try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : ''; }
  catch { return ''; }
};
function MarkdownContent({ content }) {
  return <div className="trip-details-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      a: ({ href, children }) => safeLink(href) ? <a href={safeLink(href)} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      table: ({ children }) => <div className="trip-details-table-scroll"><table>{children}</table></div>
    }}>{normalizeMarkdown(content).replace(/<br\s*\/?\s*>/gi, ' · ')}</ReactMarkdown>
  </div>;
}

const LANDMARK_ENDINGS = 'Palace|Fort|Temple|Museum|Bazaar|Market|Lake|Garden|Park|Mandir|Ghat|Falls|Waterfall|Beach|Church|Mosque|Monastery|Square|Viewpoint|Memorial';
const COMMON_LANDMARKS = [
  'Rajwada Palace', 'Kanch Mandir', 'Lal Bagh Palace', 'Khajrana Ganesh Temple',
  'Indore Museum', 'Sarafa Bazaar', 'Chappan Dukan', 'Kota Garh', 'Kishore Sagar',
  'Jagmandir Palace', 'Seven Wonders Park', 'Chambal Garden', 'Jal Mahal',
  'Hawa Mahal', 'City Palace', 'Amber Fort', 'Jantar Mantar', 'Taj Mahal',
  'Mehtab Bagh', 'India Gate', 'Qutub Minar', 'Lake Pichola'
];
const getActivityPlace = activity => {
  const text = cleanActivity(activity);
  if (/^(?:travel|return|journey|depart|drive|transfer|check.?in|check.?out)\b/i.test(text)) return '';
  const known = COMMON_LANDMARKS.find(place => new RegExp(`(^|[^\\p{L}])${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'iu').test(text));
  if (known) return known;
  const named = text.match(new RegExp(`\\b([A-Z][\\p{L}\\p{N}'’-]*(?:\\s+(?:[A-Z][\\p{L}\\p{N}'’-]*|of|the|and)){0,4}\\s+(?:${LANDMARK_ENDINGS}))\\b`, 'iu'));
  if (named) return named[1];
  return '';
};
const mapSearch = (place, destination) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, ${destination}`)}`;
const dayRoute = (places, destination) => {
  const list = [...new Set(places)].slice(0, 5).map(place => `${place}, ${destination}`);
  if (list.length < 2) return '';
  const params = new URLSearchParams({ api: '1', origin: list[0], destination: list.at(-1), travelmode: 'driving' });
  if (list.length > 2) params.set('waypoints', list.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
};
const imageCache = new Map();
const commonsPhoto = async (place, destination) => {
  const query = `${place} ${destination.split(',')[0]}`;
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata', iiurlwidth: '360', iiextmetadatafilter: 'LicenseShortName' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) return null;
  const data = await response.json();
  const words = place.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const city = destination.split(',')[0].toLowerCase();
  const result = Object.values(data?.query?.pages || {}).find(page => {
    const info = page.imageinfo?.[0];
    const title = String(page.title || '').toLowerCase();
    if (!info?.thumburl || !/^image\/(?:jpeg|png|webp)$/i.test(info.mime || '')) return false;
    if (/\b(?:logo|map|flag|poster|drawing|sketch|model|replica|collage)\b/.test(title)) return false;
    return words.length >= 2 && words.every(word => new RegExp(`(^|[^\\p{L}])${word}(?=$|[^\\p{L}])`, 'iu').test(title)) &&
      (!/^(?:city palace|central park|museum|palace|garden)$/i.test(place) || title.includes(city));
  });
  if (!result) return null;
  const info = result.imageinfo[0];
  return { src: info.thumburl, page: safeLink(info.descriptionurl), license: String(info.extmetadata?.LicenseShortName?.value || 'View source').replace(/<[^>]+>/g, '') };
};
function PlacePhoto({ place, destination }) {
  const [photo, setPhoto] = useState(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(item => item.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '180px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !place) return;
    let active = true;
    const key = `${place.toLowerCase()}|${destination.toLowerCase()}`;
    const existing = imageCache.get(key);
    const job = existing || commonsPhoto(place, destination).catch(() => null);
    if (!existing) imageCache.set(key, job);
    Promise.resolve(job).then(result => { if (active) setPhoto(result); });
    return () => { active = false; };
  }, [place, destination, visible]);
  return <div ref={ref} className="saved-day-photo-wrap">
    {photo && <><img src={photo.src} alt={place} loading="lazy" onError={() => setPhoto(null)}/>
      {photo.page && <a href={photo.page} target="_blank" rel="noopener noreferrer">Photo credit · {photo.license}</a>}</>}
  </div>;
}


const RESEARCH_FIELDS = [
  { key: 'flight_results', label: 'Flight research', Icon: Plane },
  { key: 'train_results', label: 'Train research', Icon: TrainFront },
  { key: 'bus_results', label: 'Bus research', Icon: Bus },
  { key: 'road_results', label: 'Road directions', Icon: CarFront },
  { key: 'hotel_results', label: 'Hotel research', Icon: Hotel },
  { key: 'weather_results', label: 'Weather research', Icon: CloudSun },
  { key: 'budget_results', label: 'Budget research', Icon: Calculator }
];

function PublicResearch({ formData }) {
  const structured = formData.agentResearch || {};
  const legacy = formData.agentResults || {};
  const available = RESEARCH_FIELDS.filter(({ key }) => structured[key] || legacy[key]);
  const estimate = formData.budgetEstimate;
  if (!available.length && !estimate) return null;

  return <section className="shared-research-panel" aria-label="Saved travel research">
    {available.length > 0 && <>
      <h2><Info size={19}/> Flight, Hotel & Travel Research</h2>
      <p className="shared-research-help">These are saved research references, not confirmed bookings. Verify schedules, routes, rates, and availability directly with providers.</p>
      {available.map(({ key, label, Icon }) => {
        const entry = structured[key];
        const raw = legacy[key];
        const summary = cleanText(entry?.summary);
        const sources = Array.isArray(entry?.sources)
          ? entry.sources.filter(source => safeLink(source?.url)).slice(0, 8)
          : [];
        return <details className="shared-research-item" key={key}>
          <summary><Icon size={17}/>{label}<ChevronDown size={16} className="shared-research-chevron"/></summary>
          <div className="shared-research-body">
            {summary && <p>{summary}</p>}
            {sources.length > 0 && <ul>{sources.map((source, index) => <li key={index}>
              <a target="_blank" rel="noopener noreferrer" href={safeLink(source.url)}>{cleanText(source.title) || 'Open source'}</a>
              {source.description && <small>{source.description}</small>}
            </li>)}</ul>}
            {!summary && sources.length === 0 && raw && <pre>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)}</pre>}
            {!summary && sources.length === 0 && !raw && <p>Detailed findings were not included in this shared snapshot.</p>}
          </div>
        </details>;
      })}
    </>}
    {estimate?.currency === 'INR' && estimate?.type === 'illustrative_partial_allowance' && estimate?.verified_quote === false &&
      <div className="shared-budget-estimate">
        <strong>Example planning subtotal: ₹{Number(estimate.min || 0).toLocaleString('en-IN')}–₹{Number(estimate.max || 0).toLocaleString('en-IN')}</strong>
        <p>Illustrative allowance for the trip, not a confirmed total. Unpriced costs, including round-trip intercity transport, are excluded.</p>
        {Array.isArray(estimate.categories) && <details>
          <summary>View included allowances and exclusions</summary>
          <ul>{estimate.categories.map((category, index) => <li key={index}>
            {category.label || category.category}: ₹{Number(category.min || 0).toLocaleString('en-IN')}–₹{Number(category.max || 0).toLocaleString('en-IN')}
          </li>)}
          {(estimate.excluded_categories || []).map((item, index) => <li key={`excluded-${index}`}>Excluded: {item}</li>)}</ul>
        </details>}
      </div>}
  </section>;
}

function SharedDayCard({ section, destination }) {
  const { items, notes, other } = useMemo(() => parseDayContent(section.content), [section.content]);
  const heading = section.content.split('\n').find(line => dayHeading(line));
  const title = cleanActivity(heading?.replace(/^\s*#{1,6}\s*/, '') || `Day ${section.dayNumber}`);
  const sightseeing = items.map(item => {
    if (/\b(?:breakfast|lunch|dinner|tea|coffee|hotel|hostel|airport|station|train|bus|flight|check-in|check-out|travel|return)\b/i.test(item.activity)) return '';
    return getActivityPlace(item.activity);
  }).filter(Boolean);
  const route = dayRoute(sightseeing, destination);

  return <article className="public-trip-day-section shared-day-card">
    <div className="shared-day-kicker">DAY {section.dayNumber}</div>
    <h3 className="shared-day-title">{title}</h3>
    <p className="shared-day-stats">{items.length} scheduled {items.length === 1 ? 'item' : 'items'}{sightseeing.length ? ` · ${sightseeing.length} sightseeing ${sightseeing.length === 1 ? 'stop' : 'stops'}` : ''} · Times are suggestions unless confirmed</p>
    {route && <div className="shared-day-route">
      <a href={route} target="_blank" rel="noopener noreferrer"><Navigation size={16}/> View Day {section.dayNumber} Route ({Math.min(new Set(sightseeing).size, 5)} stops)</a>
      <small>Google Maps calculates the route after opening. Confirm times before travelling.</small>
    </div>}
    {items.length > 0 ? <div className="shared-day-activities">
      {items.map((item, index) => {
        const place = getActivityPlace(item.activity);
        const photoPlace = place && !/\b(?:breakfast|lunch|dinner|snack|hotel|hostel|train|bus|flight|check-in|check-out)\b/i.test(item.activity) ? place : '';
        return <div className={`shared-day-activity${photoPlace ? ' has-photo' : ''}`} key={`${index}-${item.activity}`}>
          <div className="shared-day-time"><Clock3 size={15}/>{item.time}</div>
          {photoPlace && <PlacePhoto place={photoPlace} destination={destination}/>}
          <div className="shared-day-detail"><strong>{item.activity}</strong>
            {place && <a className="shared-day-map-link" href={mapSearch(place, destination)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/> Search Google Maps</a>}
            {item.cost && <small>Listed cost: {item.cost} — verify before booking</small>}
          </div>
        </div>;
      })}
    </div> : <MarkdownContent content={section.content}/>}
    {other && items.length > 0 && <div className="shared-day-extra"><MarkdownContent content={other}/></div>}
    {items.some(item => /\b(?:return|back to|travel home)\b/i.test(item.activity) && /^(?:flexible|time not specified|time to confirm)$/i.test(item.time)) &&
      <p className="shared-day-warning">Return arrival time has not been confirmed. Check the actual transport schedule before finalizing travel.</p>}
    {notes.length > 0 && <aside className="shared-day-notes"><strong>Important notes</strong><ul>{notes.map((note, index) => <li key={index}>{note}</li>)}</ul></aside>}
  </article>;
}

// Keep these styles scoped to the public page so the Planner and saved-trip pages
// keep their existing design. Reuse PublicTrip.css for the overall page shell.
const SHARED_TRIP_STYLES = `
.public-trip-page .shared-overview{display:flex;flex-direction:column;gap:12px;margin:0 0 22px;padding:18px 22px;border:1px solid #364773;border-radius:17px;background:rgba(31,44,83,.42)}
.public-trip-page .shared-overview>strong{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:17px;line-height:1.5;color:inherit}
.public-trip-page .shared-overview>strong svg{color:#b88aff;flex-shrink:0}
.public-trip-page .shared-tags{display:flex;flex-wrap:wrap;gap:9px}
.public-trip-page .shared-tags span{border:1px solid #465a88;background:rgba(100,117,180,.13);padding:7px 11px;border-radius:9px;font-size:12px;line-height:1.5}
.public-trip-page .shared-extra-info{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 20px;padding:12px 18px;border:1px solid #37466f;border-radius:12px;font-size:13px}
.public-trip-page .shared-extra-info>div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.public-trip-page .shared-extra-info svg{color:#bea2fb}.public-trip-page .shared-extra-info span{opacity:.75}
.public-trip-page .shared-extra-info strong{font-weight:650}
.public-trip-page .shared-day-card{padding:25px 28px!important;border:1px solid #354672!important;border-left:3px solid #9274f9!important;border-radius:17px!important;background:rgba(23,35,73,.7)!important;color:#f7f6ff!important;margin:0 0 20px!important}
.public-trip-page .shared-day-kicker{font-weight:800;font-size:12px;letter-spacing:2px;color:#b18cff}
.public-trip-page .shared-day-title{font-size:23px;line-height:1.35;margin:12px 0 4px;color:inherit}
.public-trip-page .shared-day-stats{font-size:12px;line-height:1.55;color:#b9c8e7;margin:0 0 15px}
.public-trip-page .shared-day-activities{display:flex;flex-direction:column;gap:8px;margin-top:18px}
.public-trip-page .shared-day-activity{display:grid;grid-template-columns:150px minmax(0,1fr);gap:11px;align-items:center;padding:12px 15px;border:1px solid #41517b;border-radius:13px;background:#1b264b;color:#faf9ff;min-width:0}
.public-trip-page .shared-day-activity.has-photo{grid-template-columns:150px 84px minmax(0,1fr)}
.public-trip-page .shared-day-activity.has-photo:not(:has(.saved-day-photo-wrap img)){grid-template-columns:150px minmax(0,1fr)}
.public-trip-page .shared-day-activity.has-photo:not(:has(.saved-day-photo-wrap img)) .saved-day-photo-wrap{display:none}
.public-trip-page .shared-day-time{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:750;color:#d7a9ff;min-width:0}
.public-trip-page .shared-day-time svg{flex-shrink:0}
.public-trip-page .shared-day-detail{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
.public-trip-page .shared-day-detail>strong{font-size:14px;font-weight:700;line-height:1.55;overflow-wrap:anywhere;color:inherit}
.public-trip-page .shared-day-detail>small{font-size:11px;color:#b9c9e8}
.public-trip-page .shared-day-map-link{display:inline-flex;align-items:center;gap:7px;border:1px solid #6c518e;color:#dbb0ff!important;background:rgba(148,86,230,.13);padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none}
.public-trip-page .shared-day-map-link:hover{text-decoration:underline}
.public-trip-page .shared-day-route{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:14px 0}
.public-trip-page .shared-day-route>a{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border-radius:10px;background:#60389e;color:white!important;border:1px solid #a77ae1;text-decoration:none;font-size:12px;font-weight:750}
.public-trip-page .shared-day-route small{font-size:11px;color:#b9c8e8}
.public-trip-page .saved-day-photo-wrap{display:flex;flex-direction:column;gap:4px;width:84px;max-width:84px}
.public-trip-page .saved-day-photo-wrap:empty{display:none}
.public-trip-page .saved-day-photo-wrap img{width:84px;height:68px;object-fit:cover;border-radius:9px;border:1px solid #56658c}
.public-trip-page .saved-day-photo-wrap a{font-size:9px;line-height:1.2;color:#d7b0ff;text-decoration:underline;overflow-wrap:anywhere}
.public-trip-page .shared-day-notes{margin-top:14px;padding:14px;border-radius:12px;border:1px solid #43527b;background:rgba(89,73,145,.12);font-size:13px;line-height:1.6}
.public-trip-page .shared-day-notes ul{padding-left:20px;margin:8px 0 0}
.public-trip-page .shared-day-warning{font-size:12px;color:#b9c8e8;line-height:1.6;margin-top:10px}
.public-trip-page .shared-day-extra{margin-top:12px;font-size:13px;line-height:1.6}
.public-trip-page .shared-research-panel{border:1px solid #47577e;border-radius:17px;padding:19px 21px;background:#19254b;margin:0 0 24px;color:#f7f6ff}
.public-trip-page .shared-research-panel>h2{display:flex;gap:9px;align-items:center;font-size:18px;color:inherit;margin:0 0 7px}
.public-trip-page .shared-research-help{font-size:12px;line-height:1.6;color:#bbc9e8;margin:4px 0 14px}
.public-trip-page .shared-research-item{border-top:1px solid #3b4a74;padding:10px 0}
.public-trip-page .shared-research-item>summary{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:14px;font-weight:700;list-style:none}
.public-trip-page .shared-research-chevron{margin-left:auto}
.public-trip-page .shared-research-body{border:1px solid #47577d;border-radius:12px;background:#101a37;padding:13px 15px;margin:11px 0 0;font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.public-trip-page .shared-research-body pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:300px;overflow:auto}
.public-trip-page .shared-research-body ul{padding-left:19px;margin:9px 0}
.public-trip-page .shared-research-body a{color:#b5d5ff;text-decoration:underline}
.public-trip-page .shared-research-body small{display:block;color:#b9c8e8;margin:3px 0}
.public-trip-page .shared-budget-estimate{border:1px solid #7d6baa;border-radius:12px;padding:14px 16px;background:rgba(127,91,188,.12);margin-top:14px}
.public-trip-page .shared-budget-estimate>strong{font-size:16px}.public-trip-page .shared-budget-estimate p{font-size:12px;color:#cbd5ef;line-height:1.6}
.public-trip-page .shared-budget-estimate summary{cursor:pointer;font-size:12px}
.public-trip-page .shared-markdown{font-size:14px;line-height:1.7;overflow-wrap:anywhere}
.public-trip-page .shared-markdown p{margin:8px 0}.public-trip-page .shared-markdown ul{padding-left:24px}
.public-trip-page .trip-details-markdown{font-size:14px;line-height:1.65;overflow-wrap:anywhere}
.public-trip-page .trip-details-markdown h2{font-size:20px}.public-trip-page .trip-details-markdown h3{font-size:17px}
.public-trip-page .trip-details-markdown table{border-collapse:collapse;width:100%;min-width:450px}
.public-trip-page .trip-details-markdown th,.public-trip-page .trip-details-markdown td{border:1px solid #53648d;padding:8px 10px;text-align:left}
.public-trip-page .trip-details-table-scroll{max-width:100%;overflow-x:auto}
.public-trip-page .trip-details-markdown a{color:#b8caff;text-decoration:underline}
:root[data-theme='light'] .public-trip-page .shared-overview,:root[data-theme='light'] .public-trip-page .shared-day-activity,:root[data-theme='light'] .public-trip-page .shared-day-card{background:#f8f7ff!important;color:#1c294b!important;border-color:#d4d4eb!important}
:root[data-theme='light'] .public-trip-page .shared-day-time{color:#763dad}
:root[data-theme='light'] .public-trip-page .shared-day-stats,:root[data-theme='light'] .public-trip-page .shared-day-route small,:root[data-theme='light'] .public-trip-page .shared-day-detail small{color:#546483}
:root[data-theme='light'] .public-trip-page .shared-research-panel{background:#f4f2ff;color:#253153;border-color:#d4cbe9}
:root[data-theme='light'] .public-trip-page .shared-research-help,:root[data-theme='light'] .public-trip-page .shared-budget-estimate p{color:#546483}
:root[data-theme='light'] .public-trip-page .shared-research-body{background:white;color:#253153;border-color:#d3d3e9}
:root[data-theme='light'] .public-trip-page .shared-day-map-link{color:#753ca9!important}
@media(max-width:760px){.public-trip-page .shared-day-card{padding:18px 14px!important}.public-trip-page .shared-day-activity,.public-trip-page .shared-day-activity.has-photo{grid-template-columns:1fr;gap:9px}.public-trip-page .shared-day-activity.has-photo{grid-template-columns:74px minmax(0,1fr)}.public-trip-page .shared-day-activity.has-photo:not(:has(.saved-day-photo-wrap img)){grid-template-columns:1fr}.public-trip-page .shared-day-activity.has-photo .shared-day-time{grid-column:1/-1}.public-trip-page .shared-day-activity.has-photo .saved-day-photo-wrap{grid-column:1;grid-row:2}.public-trip-page .shared-day-activity.has-photo .shared-day-detail{grid-column:2;grid-row:2}.public-trip-page .shared-day-activity.has-photo:not(:has(.saved-day-photo-wrap img)) .shared-day-detail{grid-column:1;grid-row:2}.public-trip-page .shared-day-title{font-size:19px}.public-trip-page .shared-overview{padding:14px}}
@media print{.public-trip-page .shared-day-route,.public-trip-page .shared-day-map-link,.public-trip-page .saved-day-photo-wrap a,.public-trip-page .shared-research-panel{display:none!important}.public-trip-page .shared-day-card,.public-trip-page .shared-day-activity{background:#fff!important;color:#111!important;border-color:#bbb!important;break-inside:avoid}.public-trip-page .shared-day-time,.public-trip-page .shared-day-detail strong{color:#111!important}}
`;

export default function PublicTrip() {
  const { shareToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setTrip(null);
    setError('');
    setLoading(true);
    getPublicTrip(shareToken)
      .then(data => { if (active) setTrip(data); })
      .catch(err => { if (active) setError(err?.message || 'This shared trip is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shareToken]);

  const data = trip?.formData || {};
  const destination = data.destination || trip?.title || 'Travel Itinerary';
  const source = data.source || 'Not specified';
  const rawItinerary = trip?.itinerary;
  const itinerary = typeof rawItinerary === 'string' ? rawItinerary :
    rawItinerary == null ? '' : JSON.stringify(rawItinerary, null, 2);
  const sections = useMemo(() => splitItinerary(itinerary), [itinerary]);
  const dayCount = new Set(sections.filter(section => section.type === 'day').map(section => section.dayNumber)).size;

  if (loading || error || !trip) {
    return <><Navbar/><main className="public-trip-page"><div className="public-trip-state">
      {loading ? <><RefreshCw className="trip-details-spinner" size={26}/><p>Loading shared itinerary...</p></>
        : <><AlertCircle size={27}/><h1>Shared trip unavailable</h1><p>{error || 'This link may have been disabled by its owner.'}</p><a href="/">Return to Home</a></>}
    </div></main><Footer/></>;
  }

  const information = [
    { label: 'Starting Location', value: source, Icon: MapPin },
    { label: 'Departure', value: formatDate(data.startDate || data.travelDate), Icon: CalendarDays },
    { label: 'Return', value: formatDate(data.endDate), Icon: CalendarDays },
    { label: 'Travelers', value: getTravelerLabel(data), Icon: Users },
    { label: 'Budget', value: data.budget || 'Not specified', Icon: Wallet }
  ];

  return <>
    <style>{SHARED_TRIP_STYLES}</style>
    <Navbar/>
    <main className="public-trip-page"><div className="public-trip-container">
      <header className="public-trip-header">
        <span><Sparkles size={15}/> SHARED TRAVEL ITINERARY</span>
        <h1>{destination}</h1>
        <p>A read-only travel plan shared through Journey Gen AI.</p>
        {dayCount > 0 && <p><Clock3 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }}/>{dayCount} itinerary {dayCount === 1 ? 'day' : 'days'}</p>}
      </header>
      <section className="public-trip-info" aria-label="Trip information">
        {information.map(({ label, value, Icon }) => <div key={label}>
          <Icon/><span>{label}</span><strong>{value}</strong>
        </div>)}
      </section>
      {(data.interests || trip.savedAt) && <section className="shared-extra-info" aria-label="Additional trip details">
        {data.interests && <div><Heart size={16}/><span>Interests</span><strong>{getInterests(data.interests)}</strong></div>}
        {trip.savedAt && <div><CalendarDays size={16}/><span>Saved on</span><strong>{formatDate(trip.savedAt)}</strong></div>}
      </section>}
      <section className="public-trip-itinerary">
        <div className="public-trip-itinerary-title"><Plane/><div><h2>Travel Itinerary</h2><p>Day-by-day plan · Read-only shared details</p></div></div>
        <div className="shared-overview">
          <strong><MapPin size={20}/>{source} → {destination}</strong>
          <div className="shared-tags">
            <span>{formatDate(data.startDate || data.travelDate)} – {formatDate(data.endDate)}</span>
            <span>{getTravelerLabel(data)}</span>
            {Array.isArray(data.transportation) && data.transportation.length > 0 && <span>{data.transportation.join(' / ')} (flexible)</span>}
            {data.accommodation && <span>Stay: {data.accommodation}</span>}
            {data.travelPace && <span>Pace: {data.travelPace}</span>}
            {data.weatherPreference && <span>Preferred weather: {data.weatherPreference}</span>}
            {Array.isArray(data.foodPreferences) && data.foodPreferences.length > 0 && <span>Food: {data.foodPreferences.join(', ')}</span>}
          </div>
        </div>
        <PublicResearch formData={data}/>
        {sections.map((section, index) => section.type === 'day'
          ? <SharedDayCard key={section.key || index} section={section} destination={destination}/>
          : <div key={section.key || index} className="public-trip-day-section shared-day-card shared-markdown"><MarkdownContent content={section.content}/></div>)}
      </section>
      <p className="public-trip-notice">This is a public read-only link. The trip owner can revoke access at any time. Research references and suggested prices are not confirmed reservations.</p>
    </div></main>
    <Footer/>
  </>;
}
