import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, MapPin, Users, Wallet, Sparkles, Pencil,
  Plane, RefreshCw, Download, Share2, Copy, XCircle, FileText,
  Clock3, Heart, CheckCircle2, AlertCircle, ExternalLink, Navigation,
  Hotel, CloudSun, Calculator, TrainFront, Bus, CarFront, Info, ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QRCodeCanvas } from 'qrcode.react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  getTrip, updateTrip, enableTripSharing, disableTripSharing, regenerateTripDay
} from '../services/aiService';
import './TripDetails.css';

// Show exactly what was saved; dates and traveler counts come from the
// generation snapshot stored in formData, never from current form defaults.
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
// A regenerated response can append **Important Note** to the last bullet.
// Keep the activity but render the advice in its own callout.
const splitInlineImportantNote = value => {
  const text = cleanActivity(value);
  const match = /\b(?:important\s+notes?|travel\s+tips?|booking\s+notes?)\b\s*[:—–-]?\s*/i.exec(text);
  if (!match) return { activity: text, note: '', heading: false };
  return {
    activity: text.slice(0, match.index).replace(/[.\s;:—–-]+$/, '').trim(),
    note: text.slice(match.index + match[0].length).trim(),
    heading: true
  };
};
const isTableRule = value => /^\|?[\s|:\-]+\|?$/.test(value) && value.includes('-');
const parseDayContent = content => {
  const lines = normalizeMarkdown(content).split('\n');
  const items = [], notes = [], other = [];
  let period = '';
  let inNotes = false;
  const seen = new Set();
  const add = (time, description, cost = '') => {
    const parts = splitInlineImportantNote(description);
    if (parts.note) notes.push(parts.note);
    if (parts.heading && !parts.note) inNotes = true;
    const activity = parts.activity;
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
      if (/\b(?:notes?|tips?|reminders?|verification|checklist)\b/i.test(heading)) { inNotes = true; }
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
        const parts = splitInlineImportantNote(activityText);
        if (parts.note) notes.push(parts.note);
        else if (parts.activity) notes.push(parts.activity);
        if (parts.heading && !parts.note) inNotes = true;
        continue;
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
    else {
      const parts = splitInlineImportantNote(heading);
      if (parts.heading) {
        if (parts.activity) other.push(parts.activity);
        if (parts.note) notes.push(parts.note);
        else inNotes = true;
      } else if (!/^(?:trip:|route:|travelers:|dates:)\b/i.test(heading)) other.push(line);
    }
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
  // Canonical names match those used by the original Planner photo lookup.
  const aliases = [
    [/\bSaheliyon[\s-]*(?:ki|i)[\s-]*(?:Bari|Barah|Badi)\b/iu, 'Saheliyon Ki Bari'],
    [/\bGarden\s+of\s+the\s+Maidens\b/iu, 'Saheliyon Ki Bari'],
    [/\bBagore[\s-]*Ki[\s-]*Haveli\b/iu, 'Bagore Ki Haveli'],
    [/\bHathi[\s-]*Pol\b/iu, 'Hathi Pol'],
    [/\bJantar[\s-]*Mantar\b/iu, 'Jantar Mantar'],
    [/\bLake\s+Pichola\b/iu, 'Lake Pichola']
  ];
  const alias = aliases.find(([pattern]) => pattern.test(text));
  if (alias) return alias[1];
  const known = COMMON_LANDMARKS.find(place => new RegExp(`(^|[^\\p{L}])${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'iu').test(text));
  if (known) return known;
  const named = text.match(new RegExp(`\\b([A-Z][\\p{L}\\p{N}'’-]*(?:\\s+(?:[A-Z][\\p{L}\\p{N}'’-]*|of|the|and)){0,4}\\s+(?:${LANDMARK_ENDINGS}))\\b`, 'iu'));
  if (named) return named[1].replace(/^(?:Visit|Explore|Tour|See|Admire|View|Walk|Discover|Take|Head|Enjoy)\s+/i, '').trim();
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
const photoCache = new Map();
const photoInFlight = new Map();
const FALLBACK_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" fill="#e8ecf7"/><path d="M0 345L165 170l120 125 95-105 260 155v75H0z" fill="#c1cce6"/><circle cx="470" cy="115" r="42" fill="#d5b8f8"/><text x="320" y="385" font-family="sans-serif" font-size="21" text-anchor="middle" fill="#536486">Destination photo unavailable</text></svg>')}`;
const cleanPhotoWords = value => cleanText(value).toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Match verified Wikimedia file titles, never arbitrary search result photos.
const chooseCommonsImage = (pages, place, destination) => {
  const wanted = cleanPhotoWords(place);
  const words = wanted.split(' ').filter(Boolean);
  const city = cleanPhotoWords(cleanText(destination).split(',')[0]);
  const ambiguous = /^(city palace|central park|town hall|city museum|fort|temple|garden|palace|museum|lake|park)$/i.test(place);
  if (words.length < 2) return null;
  const results = pages.map(page => {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(?:jpeg|png|webp)$/i.test(info.mime || '')) return null;
    if (info.width && info.height && (info.width < 360 || info.height < 220)) return null;
    const filename = cleanPhotoWords(cleanText(page.title).replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, ''));
    if (/\b(map|logo|icon|diagram|illustration|drawing|painting|poster|flag|floorplan|sketch|render|collage|certificate|model|replica|screenshot|train|railway|bus)\b/i.test(filename)) return null;
    const exact = (` ${filename} `).includes(` ${wanted} `);
    const allWords = words.every(word => (` ${filename} `).includes(` ${word} `));
    const cityMatch = Boolean(city && (` ${filename} `).includes(` ${city} `));
    if ((!exact && !(allWords && cityMatch)) || (ambiguous && !cityMatch)) return null;
    const meta = info.extmetadata || {};
    const plain = html => cleanText(html).replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');
    return { score: (exact ? 50 : 20) + (cityMatch ? 30 : 0) - Math.min(15, filename.split(' ').length - words.length),
      src: info.thumburl, page: safeLink(info.descriptionurl),
      license: plain(meta.LicenseShortName?.value || meta.UsageTerms?.value) || 'View license',
      author: plain(meta.Artist?.value).slice(0, 100) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return results[0] || null;
};
const commonsPhoto = async (place, destination) => {
  const city = cleanText(destination).split(',')[0];
  const searches = [...new Set([[place, city].filter(Boolean).join(' '), place])];
  for (const search of searches) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*', generator: 'search',
      gsrsearch: search, gsrnamespace: '6', gsrlimit: '15',
      prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '480',
      iiextmetadatafilter: 'LicenseShortName|UsageTerms|Artist'
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) throw new Error(`Wikimedia Commons responded ${response.status}`);
    const data = await response.json();
    const found = chooseCommonsImage(Object.values(data?.query?.pages || {}), place, destination);
    if (found) return found;
  }
  return null;
};
const cachedCommonsPhoto = (place, destination) => {
  const key = `${cleanPhotoWords(place)}|${cleanPhotoWords(destination)}`;
  const cached = photoCache.get(key);
  if (cached && (cached.photo || Date.now() - cached.at < 5 * 60 * 1000)) return Promise.resolve(cached.photo);
  if (photoInFlight.has(key)) return photoInFlight.get(key);
  const job = commonsPhoto(place, destination)
    .catch(() => null)
    .then(photo => { photoCache.set(key, { photo, at: Date.now() }); return photo; })
    .finally(() => photoInFlight.delete(key));
  photoInFlight.set(key, job);
  return job;
};
function PlacePhoto({ place, destination }) {
  const [photo, setPhoto] = useState(null);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(item => item.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    let active = true;
    setPhoto(null); setPhotoChecked(false);
    if (visible && place) {
      cachedCommonsPhoto(place, destination)
        .then(result => { if (active) { setPhoto(result); setPhotoChecked(true); } })
        .catch(() => { if (active) { setPhoto(null); setPhotoChecked(true); } });
    }
    return () => { active = false; };
  }, [place, destination, visible]);
  return <div ref={ref} className={`saved-day-photo-wrap${photoChecked && !photo ? ' photo-unavailable' : ''}`}>
    <img src={photo?.src || FALLBACK_PHOTO} alt={photo ? `Photo of ${place}` : `Photo unavailable for ${place}`}
      loading="lazy" decoding="async" onError={() => { setPhoto(null); setPhotoChecked(true); }}/>
    {photo?.page && <a href={photo.page} target="_blank" rel="noopener noreferrer"
      title={[photo.author || 'Wikimedia Commons contributor', photo.license].join(' · ')}>Photo credit · {photo.license}</a>}
  </div>;
}

const replaceSingleDay = (original, targetDay, replacement) => {
  const lines = normalizeMarkdown(original).split('\n');
  const start = lines.findIndex(line => Number(dayHeading(line)?.[1]) === targetDay);
  if (start < 0) throw new Error(`Day ${targetDay} was not found in this saved itinerary.`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (dayHeading(lines[index]) || summaryHeading(lines[index])) { end = index; break; }
  }
  let changed = normalizeMarkdown(replacement);
  if (!changed) throw new Error('The regenerated day is empty. Original itinerary preserved.');
  const firstDay = changed.split('\n').map(dayHeading).find(Boolean);
  if (firstDay && Number(firstDay[1]) !== targetDay) throw new Error('The server returned the wrong day. Original itinerary preserved.');
  if (!firstDay) changed = `## Day ${targetDay}\n${changed}`;
  const result = [...lines.slice(0, start), changed, ...lines.slice(end)].join('\n').trim();
  const before = [...new Set(splitItinerary(original).filter(item => item.type === 'day').map(item => item.dayNumber))];
  const after = [...new Set(splitItinerary(result).filter(item => item.type === 'day').map(item => item.dayNumber))];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('The replacement would change other itinerary days, so it was rejected.');
  return result;
};

function PreviewDayContent({ markdown }) {
  const parsed = useMemo(() => parseDayContent(markdown), [markdown]);
  const heading = normalizeMarkdown(markdown).split('\n').find(line => dayHeading(line));
  if (!parsed.items.length) return <MarkdownContent content={markdown}/>;
  return <div className="saved-day-preview-body">
    {heading && <h3 className="saved-day-preview-heading">{cleanActivity(heading.replace(/^\s*#{1,6}\s*/, ''))}</h3>}
    <ul className="saved-day-preview-list">{parsed.items.map((item, index) => <li key={`${index}-${item.activity}`}>
      <strong>{item.time}</strong><span>{item.activity}</span>
    </li>)}</ul>
    {parsed.other && <div className="saved-day-extra"><MarkdownContent content={parsed.other}/></div>}
    {parsed.notes.length > 0 && <aside className="saved-day-notes"><strong>Important notes</strong>
      <ul>{parsed.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></aside>}
  </div>;
}

function DayCard({ section, destination, preview, onRegenerate, onAccept, onReject, busy, feedback, onFeedback }) {
  const { items, notes, other } = useMemo(() => parseDayContent(section.content), [section.content]);
  const heading = section.content.split('\n').find(line => dayHeading(line));
  const title = cleanActivity(heading?.replace(/^\s*#{1,6}\s*/, '') || `Day ${section.dayNumber}`);
  const sightseeing = items.map(item => {
    if (/\b(?:breakfast|lunch|dinner|tea|coffee|hotel|hostel|airport|station|train|bus|flight|check-in|check-out|travel|return)\b/i.test(item.activity)) return '';
    return getActivityPlace(item.activity);
  }).filter(Boolean);
  const route = dayRoute(sightseeing, destination);
  const showPreview = preview?.dayNumber === section.dayNumber;
  return <article className="trip-details-itinerary-section trip-details-day-section saved-day-card">
    <div className="trip-details-day-actions trip-details-no-print">
      <span>DAY {section.dayNumber}</span>
    </div>
    <h3 className="saved-day-title">{title}</h3>
    <p className="saved-day-stats">{items.length} scheduled {items.length === 1 ? 'item' : 'items'}{sightseeing.length ? ` · ${sightseeing.length} sightseeing ${sightseeing.length === 1 ? 'stop' : 'stops'}` : ''} · Times are suggested unless confirmed</p>
    {route && <div className="saved-day-route trip-details-no-print">
      <a href={route} target="_blank" rel="noopener noreferrer"><Navigation size={16}/> View Day {section.dayNumber} Route ({Math.min(new Set(sightseeing).size, 5)} stops)</a>
      <small>Google Maps calculates the route after opening it. Confirm travel times before leaving.</small>
    </div>}
    {items.length ? <div className="saved-day-activities">{items.map((item, index) => {
      const place = getActivityPlace(item.activity);
      const photoPlace = place && !/\b(?:breakfast|lunch|dinner|snack|hotel|hostel|train|bus|flight|check-in|check-out)\b/i.test(item.activity) ? place : '';
      return <div className={`saved-day-activity${photoPlace ? ' has-photo' : ''}`} key={`${index}-${item.activity}`}>
        <div className="saved-day-time"><Clock3 size={15}/>{item.time}</div>
        {photoPlace && <PlacePhoto place={photoPlace} destination={destination}/>}
        <div className="saved-day-details"><strong>{item.activity}</strong>
          {place && <a className="saved-day-maps" href={mapSearch(place, destination)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/> Search Google Maps</a>}
          {item.cost && <small>Listed cost: {item.cost} (verify before booking)</small>}
        </div>
      </div>;
    })}</div> : <MarkdownContent content={section.content}/>}
    {other && items.length > 0 && <div className="saved-day-extra"><MarkdownContent content={other}/></div>}
    {items.some(item => /\b(?:return|back to|travel home)\b/i.test(item.activity) && /^(?:flexible|time not specified|time to confirm)$/i.test(item.time)) &&
      <p className="saved-day-return-note">Return arrival time is not specified. Confirm the actual transport schedule before finalizing this day.</p>}
    {notes.length > 0 && <aside className="saved-day-notes"><strong>Important notes</strong><ul>{notes.map((note, index) => <li key={index}>{note}</li>)}</ul></aside>}
    <div className="saved-day-regenerate-action trip-details-no-print">
      <button type="button" className="trip-details-regenerate-btn" disabled={busy} onClick={() => onRegenerate(section.dayNumber)}>
        <RefreshCw size={16} className={busy && !showPreview ? 'trip-details-spinner' : ''}/>
        {busy && !showPreview ? 'Working...' : `Regenerate Day ${section.dayNumber}`}
      </button>
    </div>
    {showPreview && <div className="saved-day-preview trip-details-no-print" role="region" aria-label={`Alternative Day ${section.dayNumber}`}>
      <h4>Preview: Alternative Day {section.dayNumber}</h4>
      <PreviewDayContent markdown={preview.markdown}/>
      <div className="saved-day-preview-actions">
        <button type="button" className="saved-day-accept" disabled={busy} onClick={onAccept}><CheckCircle2 size={17}/> {busy ? 'Saving...' : 'Accept & Save This Day'}</button>
        <button type="button" className="saved-day-reject" disabled={busy} onClick={onReject}><XCircle size={17}/> Keep Original</button>
      </div>
    </div>}
    {!showPreview && busy === false && <details className="saved-day-feedback trip-details-no-print">
      <summary>Optional instructions for regenerating Day {section.dayNumber}</summary>
      <textarea value={feedback} onChange={event => onFeedback(event.target.value)} maxLength={1500} placeholder="More shopping, fewer monuments, less walking..." aria-label="Day regeneration instructions"/>
    </details>}
  </article>;
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
function SavedResearch({ formData }) {
  const structured = formData.agentResearch || {};
  const legacy = formData.agentResults || {};
  const selected = RESEARCH_FIELDS.filter(({ key }) => structured[key] || legacy[key]);
  const estimate = formData.budgetEstimate;
  if (!selected.length && !estimate) return null;
  return <section className="saved-research-panel">
    {selected.length > 0 && <><h2><Info size={20}/> Flight, Hotel & Travel Research</h2>
      <p>These are findings saved with your generated trip, not confirmed bookings. Verify prices and availability directly with providers.</p>
      {selected.map(({ key, label, Icon }) => {
        const entry = structured[key];
        const raw = legacy[key];
        const sources = Array.isArray(entry?.sources) ? entry.sources.filter(source => safeLink(source?.url)).slice(0, 8) : [];
        const summary = cleanText(entry?.summary || '');
        return <details key={key}><summary><Icon size={17}/> {label} <ChevronDown size={15}/></summary>
          <div className="saved-research-content">
            {summary && <p>{summary}</p>}
            {sources.length > 0 && <ul>{sources.map((source, index) => <li key={index}><a href={safeLink(source.url)} target="_blank" rel="noopener noreferrer">{cleanText(source.title) || new URL(source.url).hostname}</a>{source.description && <small>{source.description}</small>}</li>)}</ul>}
            {!summary && sources.length === 0 && raw && <pre>{typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)}</pre>}
            {!summary && sources.length === 0 && !raw && <p>No detailed findings were stored for this agent.</p>}
          </div>
        </details>;
      })}</>}
    {estimate?.currency === 'INR' && estimate?.type === 'illustrative_partial_allowance' && estimate?.verified_quote === false &&
      <div className="saved-budget-preview"><strong>Example planning subtotal: ₹{Number(estimate.min || 0).toLocaleString('en-IN')}–₹{Number(estimate.max || 0).toLocaleString('en-IN')}</strong>
        <p>Illustrative costs for all travelers; <b>not a confirmed total</b>. Excludes unpriced costs, including round-trip intercity transport.</p>
        {Array.isArray(estimate.categories) && <details><summary>View included allowances and exclusions</summary><ul>
          {estimate.categories.map((category, index) => <li key={index}>{category.label || category.category}: ₹{Number(category.min).toLocaleString('en-IN')}–₹{Number(category.max).toLocaleString('en-IN')}</li>)}
          {(estimate.excluded_categories || []).map((item, index) => <li key={`excluded-${index}`}>Excluded: {item}</li>)}
        </ul></details>}
      </div>}
  </section>;
}

const SAVED_TRIP_CSS = `
.trip-details-page .saved-trip-overview{display:flex;flex-direction:column;gap:12px;padding:18px 22px;border:1px solid #35466d;border-radius:17px;background:rgba(31,44,83,.42);margin:0 0 22px}
.trip-details-page .saved-trip-overview strong{font-size:16px;line-height:1.5;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.trip-details-page .saved-trip-overview strong svg{color:#bc89ff}
.trip-details-page .saved-trip-tags{display:flex;flex-wrap:wrap;gap:9px}
.trip-details-page .saved-trip-tags span{padding:7px 11px;border-radius:9px;border:1px solid #465a88;background:rgba(100,117,180,.13);font-size:12px}
.trip-details-page .saved-day-title{font-size:21px;line-height:1.4;margin:12px 0 4px;color:inherit}
.trip-details-page .saved-day-stats{font-size:12px;color:#b7c8ef;margin:0 0 14px;line-height:1.5}
.trip-details-page .saved-day-activities{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.trip-details-page .saved-day-activity{display:grid;grid-template-columns:150px minmax(0,1fr);gap:11px;align-items:center;padding:12px 14px;border:1px solid #42517c;border-radius:13px;background:#1b264b;color:#f7f5ff;min-width:0}
.trip-details-page .saved-day-activity.has-photo{grid-template-columns:150px 84px minmax(0,1fr)}
.trip-details-page .saved-day-time{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:750;color:#d7a8ff;min-width:0}
.trip-details-page .saved-day-time svg{flex-shrink:0}
.trip-details-page .saved-day-details{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
.trip-details-page .saved-day-details strong{font-size:14px;font-weight:700;line-height:1.55;overflow-wrap:anywhere}
.trip-details-page .saved-day-details small{font-size:11px;color:#b8c5ea}
.trip-details-page .saved-day-maps{display:inline-flex;gap:7px;align-items:center;padding:6px 9px;border-radius:8px;border:1px solid #6c518e;color:#dcaaff!important;background:rgba(148,86,230,.13);font-size:12px;font-weight:700;text-decoration:none}
.trip-details-page .saved-day-maps:hover{text-decoration:underline}
.trip-details-page .saved-day-route{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:12px 0}
.trip-details-page .saved-day-route>a{display:inline-flex;align-items:center;gap:8px;padding:9px 13px;border-radius:10px;background:#60389e;border:1px solid #a77ae1;color:#fff;text-decoration:none;font-size:12px;font-weight:750}
.trip-details-page .saved-day-route small{color:#b8c8e7;font-size:11px}
.trip-details-page .saved-day-photo-wrap{width:84px;min-height:0;max-width:84px;display:flex;flex-direction:column;gap:3px}
.trip-details-page .saved-day-photo-wrap img{height:66px;width:84px;object-fit:cover;border-radius:9px;border:1px solid #56658c}
.trip-details-page .saved-day-photo-wrap a{font-size:9px;color:#d6b2ff;text-decoration:underline;line-height:1.2;overflow-wrap:anywhere}
.trip-details-page .saved-day-return-note{font-size:12px;line-height:1.5;color:#bcc7e4;margin:10px 0 0}
.trip-details-page .saved-day-notes{border:1px solid #43517a;border-radius:12px;padding:14px;margin-top:14px;background:rgba(89,73,145,.11);font-size:13px}
.trip-details-page .saved-day-notes ul{margin:8px 0 0;padding-left:20px;line-height:1.6}
.trip-details-page .saved-day-extra{margin-top:12px;color:#d7def6;font-size:13px}
.trip-details-page .saved-day-regenerate-action{display:flex;align-items:center;justify-content:flex-start;margin:18px 0 10px}
.trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:9px 15px;border:1px solid #7461b2;border-radius:11px;color:#f3e7ff;background:#29234e;font-size:14px;font-weight:650;cursor:pointer;transition:background .2s ease,border-color .2s ease}
.trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn:hover:not(:disabled){background:#383066;border-color:#a28cfa}
.trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn:disabled{opacity:.6;cursor:not-allowed}
.trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn:focus-visible{outline:3px solid #b58bff;outline-offset:3px}
:root[data-theme='light'] .trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn{color:#542c8c;background:#f1ebff;border-color:#b39cdb}
:root[data-theme='light'] .trip-details-page .saved-day-regenerate-action .trip-details-regenerate-btn:hover:not(:disabled){color:#432079;background:#e6daff;border-color:#8f6ac7}
.trip-details-page .saved-day-feedback{margin-top:13px;font-size:12px;color:#b9c6e7}
.trip-details-page .saved-day-feedback summary{cursor:pointer}
.trip-details-page .saved-day-feedback textarea{display:block;box-sizing:border-box;width:100%;min-height:75px;margin-top:8px;background:#1f2c57;border:1px solid #60719c;border-radius:11px;padding:12px;color:#fff;font:inherit;font-size:14px;resize:vertical}
/* High-contrast regeneration instructions in light and dark themes. */
.trip-details-page .saved-day-feedback{color:#eadbff}
.trip-details-page .saved-day-feedback summary{display:list-item;list-style:disclosure-closed inside;box-sizing:border-box;padding:10px 13px;border:1px solid #6969a2;border-radius:10px;background:#202a50;color:#eadbff!important;font-size:14px;font-weight:750;line-height:1.55;cursor:pointer}
.trip-details-page .saved-day-feedback[open] summary{list-style-type:disclosure-open;margin-bottom:10px}
.trip-details-page .saved-day-feedback summary::marker{color:#d1a8ff}
.trip-details-page .saved-day-feedback summary:hover{background:#29355f}
.trip-details-page .saved-day-feedback summary:focus-visible{outline:3px solid #d5aaff;outline-offset:3px}
.trip-details-page .saved-day-feedback textarea{margin-top:0;border:1px solid #8997c6;font-weight:500;line-height:1.55}
.trip-details-page .saved-day-feedback textarea::placeholder{color:#becce9;opacity:1}
:root[data-theme='light'] .trip-details-page .saved-day-feedback{color:#432277}
:root[data-theme='light'] .trip-details-page .saved-day-feedback summary{color:#48217d!important;background:#f1eaff;border:1px solid #ac90dc}
:root[data-theme='light'] .trip-details-page .saved-day-feedback summary::marker{color:#6d39ad}
:root[data-theme='light'] .trip-details-page .saved-day-feedback summary:hover{background:#e7dafe}
:root[data-theme='light'] .trip-details-page .saved-day-feedback summary:focus-visible{outline-color:#7040b4}
:root[data-theme='light'] .trip-details-page .saved-day-feedback textarea{border-color:#8d83ae;color:#263452;background:#fff}
:root[data-theme='light'] .trip-details-page .saved-day-feedback textarea::placeholder{color:#61708f;opacity:1}
.trip-details-page .saved-day-preview{border:1px solid #826bc0;background:#111b3a;border-radius:14px;padding:16px;margin:18px 0 0}
.trip-details-page .saved-day-preview h4{margin:0 0 10px;font-size:15px;color:#fff}
.trip-details-page .saved-day-preview-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:17px}
.trip-details-page .saved-day-preview-list{list-style:none;padding:0;margin:12px 0;display:grid;gap:9px}
.trip-details-page .saved-day-preview-list li{display:grid;grid-template-columns:115px minmax(0,1fr);gap:14px;align-items:start;padding:10px 12px;background:rgba(118,91,193,.12);border:1px solid #485584;border-radius:10px;font-size:13px;line-height:1.55}
.trip-details-page .saved-day-preview-list li strong{color:#d7b0ff;font-size:12px;white-space:nowrap}
.trip-details-page .saved-day-preview-heading{font-size:19px;margin:8px 0 13px;line-height:1.4;color:inherit}
.trip-details-page .saved-day-accept,.trip-details-page .saved-day-reject{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:11px 17px;border-radius:11px;font:inherit;font-size:13px;font-weight:700;line-height:1.4;cursor:pointer;transition:filter .15s ease,transform .15s ease}
.trip-details-page .saved-day-accept{background:linear-gradient(110deg,#b33be7,#4b4cf1);border:1px solid #895cf1;color:#fff!important;box-shadow:0 7px 17px rgba(95,54,195,.17)}
.trip-details-page .saved-day-reject{background:#1e2a52;border:1px solid #8f9cc0;color:#f5f6ff!important}
.trip-details-page .saved-day-accept:hover:not(:disabled),.trip-details-page .saved-day-reject:hover:not(:disabled){filter:brightness(1.12)}
.trip-details-page .saved-day-accept:disabled,.trip-details-page .saved-day-reject:disabled{opacity:.58;cursor:not-allowed}
.trip-details-page .saved-day-maps:focus-visible,.trip-details-page .saved-day-accept:focus-visible,.trip-details-page .saved-day-reject:focus-visible{outline:3px solid #b58bff;outline-offset:2px}
.trip-details-page .saved-day-photo-wrap.photo-unavailable img{opacity:.8}
.trip-details-page .saved-research-panel{border:1px solid #47577e;border-radius:17px;padding:18px 21px;background:#19254b;margin:0 0 22px;color:#f8f7ff}
.trip-details-page .saved-research-panel h2{font-size:18px;display:flex;gap:9px;align-items:center;margin:0 0 6px;color:inherit}
.trip-details-page .saved-research-panel>p{font-size:12px;color:#bbc9e8;line-height:1.6;margin:5px 0 15px}
.trip-details-page .saved-research-panel>details{border-top:1px solid #3b4a74;padding:10px 0}
.trip-details-page .saved-research-panel>details>summary{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:14px;font-weight:700;list-style:none}
.trip-details-page .saved-research-panel>details>summary>svg:last-child{margin-left:auto}
.trip-details-page .saved-research-content{border:1px solid #48577b;border-radius:12px;padding:13px 15px;background:#101a37;margin:11px 0 1px;font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.trip-details-page .saved-research-content pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;font:inherit}
.trip-details-page .saved-research-content ul{padding-left:19px;margin:9px 0}
.trip-details-page .saved-research-content a{color:#b5d5ff;text-decoration:underline}
.trip-details-page .saved-research-content small{display:block;color:#b8c9e8}
.trip-details-page .saved-budget-preview{border:1px solid #7d6baa;border-radius:12px;padding:13px 15px;background:rgba(127,91,188,.12);margin-top:13px}
.trip-details-page .saved-budget-preview strong{font-size:16px}
.trip-details-page .saved-budget-preview p{font-size:12px;line-height:1.6;color:#cbd5ef;margin:7px 0}
.trip-details-page .saved-budget-preview details{font-size:12px}.trip-details-page .saved-budget-preview summary{cursor:pointer}
:root[data-theme='light'] .trip-details-page .saved-day-activity,:root[data-theme='light'] .trip-details-page .saved-trip-overview{background:#f8f7ff;color:#1d2b4d;border-color:#d4d4ed}
:root[data-theme='light'] .trip-details-page .saved-day-time{color:#753cb2}
/* These controls sit inside the content region, not the header button styling. */
:root[data-theme='light'] .trip-details-page .saved-day-maps{color:#512590!important;background:#eee7ff;border-color:#ad8bdc}
:root[data-theme='light'] .trip-details-page .saved-day-maps:hover{background:#e2d4fc;color:#3f146f!important}
:root[data-theme='light'] .trip-details-page .saved-day-accept{color:#fff!important}
:root[data-theme='light'] .trip-details-page .saved-day-reject{background:#fff;border-color:#9d99bb;color:#352b62!important}
:root[data-theme='light'] .trip-details-page .saved-day-preview-list li{background:#fff;color:#273253;border-color:#d7c9ef}
:root[data-theme='light'] .trip-details-page .saved-day-preview-list li strong{color:#6731a3}
:root[data-theme='light'] .trip-details-page .saved-day-notes{background:#eeebf8;color:#19284d;border-color:#9782bf}
:root[data-theme='light'] .trip-details-page .saved-day-photo-wrap a{color:#54278c}
:root[data-theme='light'] .trip-details-page .saved-research-content a{color:#2352a1}
:root[data-theme='light'] .trip-details-page .saved-research-content small{color:#4e6083}
:root[data-theme='light'] .trip-details-page .saved-day-return-note{color:#566482}
:root[data-theme='light'] .trip-details-page .saved-day-details strong{color:#1d2b4d}
:root[data-theme='light'] .trip-details-page .saved-day-stats,:root[data-theme='light'] .trip-details-page .saved-day-route small,:root[data-theme='light'] .trip-details-page .saved-day-details small{color:#546382}
:root[data-theme='light'] .trip-details-page .saved-research-panel{background:#f4f2ff;color:#253153;border-color:#d4cbe9}
:root[data-theme='light'] .trip-details-page .saved-research-panel>p,:root[data-theme='light'] .trip-details-page .saved-budget-preview p{color:#546382}
:root[data-theme='light'] .trip-details-page .saved-research-content{background:#fff;color:#253153;border-color:#d3d3e9}
:root[data-theme='light'] .trip-details-page .saved-day-preview{background:#f4f0ff;color:#253153}
:root[data-theme='light'] .trip-details-page .saved-day-preview h4{color:#253153}
:root[data-theme='light'] .trip-details-page .saved-day-feedback textarea{background:#fff;color:#253153}
@media(max-width:700px){.trip-details-page .saved-day-activity,.trip-details-page .saved-day-activity.has-photo{grid-template-columns:1fr;gap:9px}.trip-details-page .saved-day-activity.has-photo{grid-template-columns:74px minmax(0,1fr)}.trip-details-page .saved-day-activity.has-photo .saved-day-time{grid-column:1/-1}.trip-details-page .saved-day-activity.has-photo .saved-day-photo-wrap{grid-column:1;grid-row:2}.trip-details-page .saved-day-activity.has-photo .saved-day-details{grid-column:2;grid-row:2}.trip-details-page .saved-day-activity:not(.has-photo) .saved-day-details{grid-column:1}.trip-details-page .saved-day-title{font-size:18px}.trip-details-page .saved-trip-overview{padding:15px}}
@media(max-width:550px){.trip-details-page .saved-day-preview-list li{grid-template-columns:1fr;gap:3px}.trip-details-page .saved-day-accept,.trip-details-page .saved-day-reject{width:100%}}
@media print{.trip-details-page .trip-details-no-print,.trip-details-page .saved-day-maps,.trip-details-page .saved-day-route,.trip-details-page .saved-day-photo-wrap a,.trip-details-page .saved-research-panel{display:none!important}.trip-details-page .saved-day-activity{background:#fff!important;color:#111!important;border-color:#bbb!important;break-inside:avoid}.trip-details-page .saved-day-details strong,.trip-details-page .saved-day-time{color:#111!important}.trip-details-page .saved-day-card{break-inside:avoid}}
`;

export default function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qrCodeRef = useRef(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [savingDay, setSavingDay] = useState(false);
  const [dayPreview, setDayPreview] = useState(null);
  const [dayMessage, setDayMessage] = useState('');
  const [regenerationFeedback, setRegenerationFeedback] = useState('');

  useEffect(() => {
    let active = true;
    setDayPreview(null); setDayMessage(''); setShareUrl('');
    (async () => {
      try {
        setLoading(true); setError('');
        const result = await getTrip(id);
        if (active) setTrip(result);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load trip details.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  const formData = trip?.formData || {};
  const destination = formData.destination || trip?.title || 'Untitled Trip';
  const source = formData.source || 'Not specified';
  const itinerary = typeof trip?.itinerary === 'string' ? trip.itinerary : '';
  const sections = useMemo(() => splitItinerary(itinerary), [itinerary]);
  const days = [...new Set(sections.filter(section => section.type === 'day').map(section => section.dayNumber))];
  const completeText = () => [
    'MY TRAVEL ITINERARY', '==============================',
    `Destination: ${destination}`, `Starting Location: ${source}`,
    `Start Date: ${formatDate(formData.startDate || formData.travelDate)}`,
    `End Date: ${formatDate(formData.endDate)}`,
    `Travelers: ${getTravelerLabel(formData)}`, `Budget: ${formData.budget || 'Not specified'}`,
    `Interests: ${getInterests(formData.interests)}`, '',
    'COMPLETE ITINERARY', '==============================', normalizeMarkdown(itinerary), '',
    'Created using Journey Gen AI'
  ].join('\n');

  const handleRegenerateDay = async dayNumber => {
    if (regeneratingDay !== null || savingDay) return;
    try {
      setRegeneratingDay(dayNumber); setDayMessage(''); setDayPreview(null);
      const result = await regenerateTripDay(trip.id, dayNumber, regenerationFeedback.trim());
      const markdown = normalizeMarkdown(result?.day_itinerary || result?.draft_itinerary || result?.itinerary);
      if (!markdown) throw new Error('The server did not return a replacement day. Your original trip is unchanged.');
      // Check it can replace exactly one day without changing day numbers.
      replaceSingleDay(itinerary, dayNumber, markdown);
      setDayPreview({ dayNumber, markdown });
      setDayMessage(`Preview ready for Day ${dayNumber}. Accept it to save, or keep the original.`);
    } catch (err) {
      setDayMessage(err.message || `Unable to regenerate Day ${dayNumber}.`);
    } finally { setRegeneratingDay(null); }
  };
  const handleAcceptDay = async () => {
    if (!dayPreview || savingDay) return;
    try {
      setSavingDay(true); setDayMessage('');
      const combined = replaceSingleDay(itinerary, dayPreview.dayNumber, dayPreview.markdown);
      const updated = await updateTrip(trip.id, {
        title: trip.title || `${source} to ${destination}`,
        formData: trip.formData || {}, itinerary: combined, savedAt: trip.savedAt
      });
      if (!updated || updated.itinerary !== combined) throw new Error('The server did not confirm the complete saved itinerary. Please reload to check.');
      setTrip(updated); setDayPreview(null);
      setRegenerationFeedback('');
      setDayMessage(`Day ${dayPreview.dayNumber} saved. All other days remain unchanged.`);
    } catch (err) { setDayMessage(err.message || 'Unable to save the updated day.'); }
    finally { setSavingDay(false); }
  };
  const handleShareTrip = async () => {
    try {
      setSharingLoading(true); setShareMessage('');
      const result = await enableTripSharing(trip.id);
      if (!result?.shareToken) throw new Error('The server did not return a sharing token.');
      const url = `${window.location.origin}/shared/${result.shareToken}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setShareMessage('Public link created and copied.'); }
      catch { setShareMessage('Public link created. Copy it using the field below.'); }
    } catch (err) { setShareMessage(err.message || 'Unable to enable public sharing.'); }
    finally { setSharingLoading(false); }
  };
  const handleDisableSharing = async () => {
    try {
      setSharingLoading(true); setShareMessage('');
      await disableTripSharing(trip.id);
      setShareUrl(''); setShareMessage('Public sharing disabled. The previous link has been revoked.');
    } catch (err) { setShareMessage(err.message || 'Unable to disable public sharing.'); }
    finally { setSharingLoading(false); }
  };
  const handleCopy = async (value, successMessage) => {
    try { await navigator.clipboard.writeText(value); setShareMessage(successMessage); }
    catch { setShareMessage('Copy failed. Please check browser permissions or copy manually.'); }
  };
  const handleDownloadQR = () => {
    const canvas = qrCodeRef.current?.querySelector('canvas');
    if (!canvas) { setShareMessage('QR code is not available to download.'); return; }
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${destination.replace(/[^a-z0-9]/gi, '_')}_QR.png`;
    document.body.appendChild(link); link.click(); link.remove();
    setShareMessage('QR code downloaded successfully.');
  };
  const handleDownloadText = () => {
    const url = URL.createObjectURL(new Blob([completeText()], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${destination.replace(/[^a-z0-9]/gi, '_')}_Itinerary.txt`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShareMessage('Itinerary text file downloaded.');
  };

  if (loading || error || !trip) {
    return <><div className="trip-details-no-print"><Navbar/></div><main className="trip-details-page"><div className="trip-details-message">
      {loading ? <><RefreshCw className="trip-details-spinner" size={30}/><p>Loading your saved journey...</p></>
        : <><AlertCircle size={32}/><h2>Unable to open this trip</h2><p>{error || 'The requested trip could not be found.'}</p>
          <button className="trip-details-secondary-btn" onClick={() => navigate('/dashboard')}><ArrowLeft size={17}/> Back to Dashboard</button></>}
    </div></main><div className="trip-details-no-print"><Footer/></div></>;
  }

  const infoCards = [
    { label: 'Starting Location', value: source, Icon: MapPin },
    { label: 'Departure', value: formatDate(formData.startDate || formData.travelDate), Icon: CalendarDays },
    { label: 'Return', value: formatDate(formData.endDate), Icon: CalendarDays },
    { label: 'Travelers', value: getTravelerLabel(formData), Icon: Users },
    { label: 'Budget', value: formData.budget || 'Not specified', Icon: Wallet }
  ];

  return <>
    <style>{SAVED_TRIP_CSS}</style>
    <div className="trip-details-no-print"><Navbar/></div>
    <main className="trip-details-page"><div className="trip-details-container">
      <button className="trip-details-back-btn trip-details-no-print" onClick={() => navigate('/dashboard')}><ArrowLeft size={17}/> Back to Dashboard</button>
      <section className="trip-details-header">
        <div className="trip-details-heading"><span className="trip-details-label"><Sparkles size={16}/> YOUR SAVED JOURNEY</span>
          <h1>{destination}</h1><p>Your personalized journey, exactly as saved.</p>
          {days.length > 0 && <div className="trip-details-day-count"><Clock3 size={15}/>{days.length} itinerary days</div>}
        </div>
        <div className="trip-details-header-actions trip-details-no-print">
          <button className="trip-details-download-btn" onClick={() => window.print()}><Download size={17}/> Download PDF</button>
          <button className="trip-details-share-btn" disabled={sharingLoading} onClick={handleShareTrip}><Share2 size={17}/>{sharingLoading ? 'Please wait...' : 'Create Public Link'}</button>
          <button className="trip-details-edit-btn" onClick={() => navigate('/planner', { state: { tripId: trip.id } })}><Pencil size={17}/> Edit Trip</button>
        </div>
      </section>
      {(shareMessage || shareUrl) && <section className="trip-details-share-panel trip-details-no-print">
        <h2><Share2 size={19}/> Share your journey</h2>
        {shareMessage && <p className="trip-details-share-message" role="status">{shareMessage}</p>}
        {shareUrl && <><label htmlFor="public-trip-url">Anyone with this link can view your itinerary:</label>
          <div className="trip-details-share-link"><input id="public-trip-url" value={shareUrl} readOnly onFocus={event => event.target.select()}/><button onClick={() => handleCopy(shareUrl, 'Public link copied.')}><Copy size={16}/> Copy</button></div>
          <div className="trip-details-export-actions">
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out my travel itinerary for ${destination}!\n\n${shareUrl}`)}`, '_blank', 'noopener,noreferrer')}><Share2 size={16}/> WhatsApp</button>
            <button onClick={() => handleCopy(completeText(), 'Complete itinerary copied.')}><FileText size={16}/> Copy Itinerary</button>
            <button onClick={handleDownloadText}><Download size={16}/> Download .txt</button>
            <button onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={16}/> Open Link</button>
          </div>
          <div className="trip-details-qr-section"><div className="trip-details-qr-code" ref={qrCodeRef}><QRCodeCanvas value={shareUrl} size={168} level="H" includeMargin/></div>
            <div><strong>Scan to view the trip</strong><p>Open the shared itinerary on another device without signing in.</p>
              <button className="trip-details-qr-download-btn" onClick={handleDownloadQR}><Download size={16}/> Download QR Code</button></div></div>
          <button className="trip-details-revoke-btn" disabled={sharingLoading} onClick={handleDisableSharing}><XCircle size={16}/> Disable Public Link</button>
        </>}
      </section>}
      <section className="trip-details-info-grid">
        {infoCards.map(({ label, value, Icon }) => <div className="trip-details-info-card" key={label}><div className="trip-details-info-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong></div></div>)}
      </section>
      <section className="trip-details-extra">
        <div><Heart size={17}/><span>Interests</span><strong>{getInterests(formData.interests)}</strong></div>
        <div><CalendarDays size={17}/><span>Saved on</span><strong>{formatDate(trip.savedAt)}</strong></div>
      </section>
      <section className="trip-details-itinerary">
        <div className="trip-details-itinerary-heading"><div className="trip-details-itinerary-icon"><Plane size={24}/></div><div><h2>Your Travel Itinerary</h2><p>Explore the details of your AI-generated travel plan.</p></div></div>
        <div className="trip-details-itinerary-content">
          <div className="saved-trip-overview"><strong><MapPin size={21}/>{source} → {destination}</strong>
            <div className="saved-trip-tags"><span>{formatDate(formData.startDate || formData.travelDate)} – {formatDate(formData.endDate)}</span>
              <span>{getTravelerLabel(formData)}</span>
              {Array.isArray(formData.transportation) && formData.transportation.length > 0 && <span>{formData.transportation.join(' / ')} (flexible)</span>}
              {formData.accommodation && <span>Stay: {formData.accommodation}</span>}
              {formData.travelPace && <span>Pace: {formData.travelPace}</span>}
              {formData.weatherPreference && <span>Preferred weather: {formData.weatherPreference}</span>}
              {Array.isArray(formData.foodPreferences) && formData.foodPreferences.length > 0 && <span>Food: {formData.foodPreferences.join(', ')}</span>}
            </div></div>
          <SavedResearch formData={formData}/>
          {dayMessage && <p className="trip-details-day-message trip-details-no-print" role="status"><Info size={17}/>{dayMessage}</p>}
          {sections.map((section, index) => section.type === 'day'
            ? <DayCard key={section.key || index} section={section} destination={destination} preview={dayPreview}
                onRegenerate={handleRegenerateDay} onAccept={handleAcceptDay} onReject={() => { setDayPreview(null); setDayMessage('Original itinerary kept unchanged.'); }}
                busy={regeneratingDay !== null || savingDay} feedback={regenerationFeedback} onFeedback={setRegenerationFeedback}/>
            : <article key={section.key || index} className="trip-details-itinerary-section"><MarkdownContent content={section.content}/></article>
          )}
        </div>
      </section>
      <div className="trip-details-bottom-action trip-details-no-print"><p>Want to make changes to your journey?</p><button className="trip-details-edit-btn" onClick={() => navigate('/planner', { state: { tripId: trip.id } })}><Pencil size={17}/> Edit This Trip</button></div>
    </div></main>
    <div className="trip-details-no-print"><Footer/></div>
  </>;
}
