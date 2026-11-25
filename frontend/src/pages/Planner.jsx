import { useEffect, useMemo, useRef, useState } from 'react';



import { useLocation, useNavigate } from 'react-router-dom';



import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './TripDetails.css';



import {



  ArrowRight, Plane, MapPin, CalendarDays, Users, Wallet, Sparkles, Compass,



  LoaderCircle, Download, Share2, Heart, Home, Bot, Activity,



  Settings, UserRound, SlidersHorizontal, ChevronDown, ChevronRight,



  ChevronLeft, BriefcaseBusiness, Palmtree, Mountain, Building2,



  Check, Plus, Bookmark, Menu, X, List, Database, Ticket,



  Info, Clock, ExternalLink, RefreshCw, AlertCircle, Printer,

  Globe2, Camera, ShoppingBasket, CarFront, Gauge, Rocket, Sun, Wind,

  Snowflake, CloudSun, CloudRain, Star, House, HeartHandshake, Leaf, Vegan,

  WheatOff, MoonStar, Scale, TrainFront, Bus, Navigation, Utensils,

  TicketsPlane, Network, CircleHelp, Moon, MapPinned, Calculator, Hotel, Landmark



} from 'lucide-react';



import { saveTrip, getTrip, updateTrip } from '../services/aiService';
import API from '../services/api';



import './Planner.css';

const PLANNER_REFINEMENT_CSS = "\n/* Planner refinements: compact trip form, local validation, share dialog and budget breakdown */\n.jgp-app .jgp-form-panel{padding:13px 20px 15px!important}\n.jgp-app .jgp-form-panel h2{margin-bottom:9px!important;font-size:23px}\n.jgp-app .jgp-ref-topfields{gap:11px!important}\n.jgp-app .jgp-ref-divider{margin:10px 0!important}\n.jgp-app .jgp-ref-field .jgp-ref-label{margin-bottom:5px!important;line-height:1.32!important}\n.jgp-app .jgp-ref-choices{gap:6px 8px!important}\n.jgp-app .jgp-ref-extras{margin-top:10px!important;padding-top:10px!important}\n.jgp-app .jgp-ref-extras-heading{margin-bottom:8px!important}\n.jgp-app .jgp-ref-extra-grid{margin-bottom:8px!important;gap:8px!important}\n.jgp-app .jgp-ref-extras input,.jgp-app .jgp-ref-extras select{min-height:37px!important}\n.jgp-app .jgp-ref-extras textarea{min-height:55px!important}\n.jgp-app .jgp-ref-actions-bottom{margin-top:9px!important;padding-top:10px!important}\n.jgp-inline-validation{display:flex;align-items:center;gap:9px;color:#ffd5db;background:rgba(183,45,80,.13);border:1px solid #d86b8b;border-radius:11px;padding:11px 13px;margin-top:13px;font-size:14px;font-weight:600}\n.jgp-inline-validation svg{flex-shrink:0}\n.jgp-budget-calculator{display:flex;flex-direction:column;gap:14px!important}\n.jgp-budget-context{display:flex;gap:10px;flex-wrap:wrap}.jgp-budget-context span{display:flex;align-items:center;gap:7px;padding:7px 11px;background:#27365d;border:1px solid #40547c;border-radius:20px;color:#cbd9ff;font-size:13px}\n.jgp-budget-breakdown{background:rgba(7,15,43,.35);border:1px solid #3b4d78;border-radius:13px;padding:14px 17px}\n.jgp-budget-breakdown h4{margin:0 0 10px;font-size:15px;color:#f5f5ff}\n.jgp-budget-breakdown-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #394a70;color:#c9d7f5;font-size:14px}\n.jgp-budget-breakdown-row strong{color:#fff;font-variant-numeric:tabular-nums}\n.jgp-budget-total{margin:0!important;background:linear-gradient(105deg,#283269,#422a76)!important;border-color:#9a70e8!important}\n@media(max-width:700px){.jgp-app .jgp-form-panel{padding:13px!important}.jgp-share-options{grid-template-columns:repeat(2,minmax(0,1fr))}}\n:root[data-theme='light'] .jgp-budget-context span{background:#f0eeff;color:#303b61}\n:root[data-theme='light'] .jgp-budget-breakdown{background:#f7f6ff}\n:root[data-theme='light'] .jgp-budget-breakdown-row strong,:root[data-theme='light'] .jgp-budget-breakdown h4{color:#202c51}\n\n.jgp-trip-overview{display:flex;flex-direction:column;gap:12px;padding:3px 0}\n.jgp-trip-overview-route{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:17px;line-height:1.5;color:inherit}\n.jgp-trip-overview-route svg{color:#bb88ff;flex-shrink:0}\n.jgp-trip-overview-tags{display:flex;flex-wrap:wrap;gap:9px}\n.jgp-trip-overview-tags span{padding:7px 11px;border:1px solid #415681;background:rgba(104,121,180,.14);border-radius:9px;font-size:13px;line-height:1.4;color:inherit}\n@media(max-width:650px){.jgp-trip-overview-route{font-size:15px}.jgp-trip-overview-tags span{font-size:12px}}\n";



// Live progress uses actual backend SSE events, not simulated timers.
const AGENT_RESEARCH_FIELDS = [
  {key: 'flight_results', label: 'Flight research', Icon: Plane},
  {key: 'train_results', label: 'Train research', Icon: TrainFront},
  {key: 'bus_results', label: 'Bus research', Icon: Bus},
  {key: 'road_results', label: 'Road directions', Icon: CarFront},
  {key: 'hotel_results', label: 'Hotel research', Icon: Hotel},
  {key: 'weather_results', label: 'Weather research', Icon: CloudSun},
  {key: 'budget_results', label: 'Budget research', Icon: Calculator}
];

// The API returns research as plain text. Display exactly what was returned,
// with a clear caveat: web-search snippets are not bookable flight/hotel offers.
const normalizeAgentResearch = values => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  const result = {};
  for (const {key} of AGENT_RESEARCH_FIELDS) {
    const value = values[key];
    const text = typeof value === 'string' ? value :
      value && typeof value === 'object' ? JSON.stringify(value, null, 2) : '';
    if (text.trim()) result[key] = text.trim().slice(0, 3500);
  }
  return result;
};

// Search tools may return JSON envelopes, nested JSON text or even truncated
// JSON snippets. Convert them to reader-friendly citations instead of showing
// escaped tool payloads as if they were verified flight/hotel offers.
const researchNotice = {
  flight_results: 'Search references only. No operating flight, departure time, fare, or seat availability has been confirmed.',
  train_results: 'Search references only. Confirm train numbers, schedules, fares, and seats with the railway provider.',
  bus_results: 'Bus listings do not confirm operators, service dates, prices or available seats. Check with the bus provider.',
  road_results: 'Google Maps directions are for planning only. Check driving time, tolls, road conditions and costs.',
  hotel_results: 'Hotel search references are not room offers. Check property details, rates, and availability directly.',
  weather_results: 'Weather research is advisory. Check an updated forecast nearer your travel dates.',
  budget_results: 'Costs are not a confirmed quote. Use sourced amounts or enter your own budget estimates.'
};

const safeResearchUrl = value => {
  try {
    const uri = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(uri.protocol) ? uri.href : '';
  } catch { return ''; }
};

const collectResearchSources = (payload, sources, visited = new Set(), depth = 0) => {
  if (depth > 6 || payload == null || sources.length >= 6) return;
  if (typeof payload === 'string') {
    const content = payload.trim();
    if ((content.startsWith('{') || content.startsWith('[')) && content.length < 180000) {
      try { collectResearchSources(JSON.parse(content), sources, visited, depth + 1); } catch { /* Partial tool response. */ }
    }
    return;
  }
  if (typeof payload !== 'object' || visited.has(payload)) return;
  visited.add(payload);
  if (Array.isArray(payload)) {
    payload.slice(0, 12).forEach(item => collectResearchSources(item, sources, visited, depth + 1));
    return;
  }
  const uri = safeResearchUrl(payload.url || payload.link || payload.href || '');
  if (uri && !sources.some(item => item.url === uri)) {
    const title = String(payload.title || payload.name || '').trim();
    const description = String(payload.content || payload.snippet || '').replace(/\s+/g, ' ').trim();
    sources.push({url: uri, title: title.slice(0, 125) || new URL(uri).hostname,
      description: description.slice(0, 220)});
  }
  for (const key of ['results', 'sources', 'content', 'text', 'data', 'items', 'response']) {
    if (payload[key] != null) collectResearchSources(payload[key], sources, visited, depth + 1);
  }
};

// Weather is not a bookable service. Present only fields actually returned
// by its MCP tools; current conditions must never be passed off as a forecast
// for the selected future travel dates.
const formatWeatherFindings = rawValue => {
  const raw = String(rawValue || '').trim();
  const notice = researchNotice.weather_results;
  if (!raw || /(?:weather tools returned no usable information|weather information is unavailable|no weather forecast has been verified)/i.test(raw)) {
    return {sources: [], message: 'Weather information is unavailable or unverified for these dates.', notice};
  }
  const city = raw.match(/DESTINATION:\s*\n+([^\n]+)/i)?.[1]?.trim();
  const dateBlock = raw.match(/TRAVEL DATES:\s*\n+([0-9-]+)\s*\n+to\s*\n+([0-9-]+)/i);
  const start = dateBlock?.[1];
  const end = dateBlock?.[2];
  const matchField = (field) => {
    const expression = new RegExp(`(?:["']?${field}["']?)\\s*[:=]\\s*["']?([^,}\\n"']+)`, 'i');
    return raw.match(expression)?.[1]?.trim();
  };
  const temperature = matchField('temperature_c');
  const condition = matchField('condition');
  const humidity = matchField('humidity');
  const place = city || matchField('city') || 'the destination';
  const details = [];
  if (temperature && /^-?\d+(?:\.\d+)?$/.test(temperature)) details.push(`${temperature}°C`);
  if (condition && !/^(?:null|none|unknown)$/i.test(condition)) details.push(condition);
  if (humidity && /^\d+(?:\.\d+)?$/.test(humidity)) details.push(`humidity ${humidity}%`);
  const message = details.length
    ? `Current conditions in ${place}: ${details.join(' · ')}. These are not a forecast for ${start && end ? `${start} to ${end}` : 'your travel dates'}. Confirm nearer departure.`
    : `Weather results for ${place} could not be reliably summarized. ${start && end ? `Your selected dates are ${start} to ${end}. ` : ''}Check a date-specific forecast closer to the trip.`;
  return {sources: [], message, notice};
};

const formatResearchFindings = (rawValue, kind) => {
  if (kind === 'weather_results') return formatWeatherFindings(rawValue);
  const text = String(rawValue || '').trim();
  const sources = [];
  collectResearchSources(text, sources);

  // The backend limits research length, so the JSON may be truncated before a
  // closing brace. Recover only actual URLs/titles; do not manufacture facts.
  const decoded = text.replace(/\\\\\"/g, '"').replace(/\\\"/g, '"')
    .replace(/\\n/g, ' ').replace(/\\t/g, ' ');
  const candidateUrls = [...decoded.matchAll(/"(?:url|link)"\s*:\s*"(https?:\/\/[^"\s]+)"/g)];
  for (const match of candidateUrls.slice(0, 8)) {
    const uri = safeResearchUrl(match[1].replace(/\\\//g, '/'));
    if (!uri || sources.some(item => item.url === uri)) continue;
    const block = decoded.slice(match.index, match.index + 1000);
    const title = block.match(/"title"\s*:\s*"([^"\n]{3,150})"/);
    const content = block.match(/"content"\s*:\s*"([^"\n]{12,260})/);
    sources.push({url: uri, title: (title?.[1] || new URL(uri).hostname).slice(0, 125),
      description: (content?.[1] || '').trim().slice(0, 220)});
    if (sources.length >= 6) break;
  }

  const hasToolEnvelope = /(?:\\"|"|')\s*(?:type|query|follow_up_questions|results|imageinfo|images|answer)\s*(?:\\"|"|')\s*:|\[\s*\{\s*"type"/i.test(decoded) ||
    /\\"(?:query|results|url|content)\\"/i.test(text);
  const plainText = !hasToolEnvelope ? text.replace(/\n{3,}/g, '\n\n').slice(0, 1100) : '';
  const errorMessage = /(?:research unavailable|no (?:train|flight|bus|road|hotel|accommodation) research|no (?:live |verified )?(?:flight|bus|road|hotel|train)|could not (?:find|verify))/i.test(text) && !sources.length
    ? (text.split('\n').find(line => /unavailable|not verified|not confirmed|no (?:train|flight|bus|road|hotel|accommodation)/i.test(line)) || '').trim().slice(0, 240)
    : '';
  return {sources, message: errorMessage || plainText, notice: researchNotice[kind] || 'Results have not been independently verified.'};
};

// Newer API versions return these structured, source-linked findings alongside
// legacy agent_results. Keep both so saved trips from older releases still work.
const normalizeStructuredResearch = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const {key} of AGENT_RESEARCH_FIELDS) {
    const entry = value[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const sources = [];
    const rawSources = Array.isArray(entry.sources) ? entry.sources : [];
    for (const item of rawSources.slice(0, 8)) {
      if (!item || typeof item !== 'object') continue;
      const url = safeResearchUrl(item.url);
      if (!url || sources.some(source => source.url === url)) continue;
      sources.push({
        url,
        title: String(item.title || new URL(url).hostname).trim().slice(0, 125),
        description: String(item.description || '').replace(/\s+/g, ' ').trim().slice(0, 230)
      });
    }
    result[key] = {
      summary: String(entry.summary || '').trim().slice(0, 450),
      sources
    };
  }
  return result;
};

// This API field is an example whole-trip allowance, not an air fare, room quote
// or full trip total. Never automatically transfer it into per-night/per-person
// calculator inputs: those inputs have a different cost basis.
const normalizeIllustrativeBudget = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.currency !== 'INR' || value.type !== 'illustrative_partial_allowance' ||
      value.complete_trip_cost !== false || value.verified_quote !== false ||
      value.basis !== 'total_for_all_travelers') return null;
  const valid = number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1000000000;
  if (!valid(value.min) || !valid(value.max) || value.min > value.max) return null;
  const categories = Array.isArray(value.categories) ? value.categories.slice(0, 8)
    .filter(item => item && item.basis === 'whole_trip' && valid(item.min) &&
      valid(item.max) && item.min <= item.max)
    .map(item => ({
      label: String(item.label || item.category || 'Expense').slice(0, 48),
      min: item.min, max: item.max
    })) : [];
  const excluded = Array.isArray(value.excluded_categories)
    ? value.excluded_categories.filter(item => typeof item === 'string').slice(0, 8) : [];
  return {min: value.min, max: value.max, categories, excluded,
    message: String(value.message || '').slice(0, 330)};
};

const displayResearchFindings = (rawValue, structured, kind) => {
  const legacy = formatResearchFindings(rawValue, kind);
  // Weather and budget agents are descriptive; their existing text formatter
  // is more informative than the API's generic metadata summary.
  if (kind === 'weather_results' || kind === 'budget_results' || !structured) return legacy;
  const message = structured.summary && !/^[\s]*[\[{]/.test(structured.summary)
    ? structured.summary : '';
  if (structured.sources.length) {
    return {...legacy, message, sources: structured.sources};
  }
  return {...legacy, message: legacy.message || message};
};

const ILLUSTRATIVE_BUDGET_CSS = `
.jgp-budget-preview{border:1px solid #7662b2;border-radius:13px;background:rgba(109,84,171,.13);padding:13px 16px;margin:10px 0 14px;color:#eee8ff}
.jgp-budget-preview-title{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:14px;font-weight:650}
.jgp-budget-preview-title strong{font-size:18px;font-variant-numeric:tabular-nums}
.jgp-budget-preview>p{font-size:12px;line-height:1.55;margin:6px 0 0;color:#d7cff0}
.jgp-budget-preview details{margin-top:9px;font-size:13px}
.jgp-budget-preview summary{cursor:pointer;max-width:max-content;color:inherit}
.jgp-budget-preview ul{margin:9px 0 0;padding-left:19px;display:grid;gap:5px}
.jgp-budget-preview li{line-height:1.45}
:root[data-theme='light'] .jgp-budget-preview{background:#f2edff;color:#283158;border-color:#c5b3f2}
:root[data-theme='light'] .jgp-budget-preview>p{color:#526083}
@media print{.jgp-budget-preview details{display:none}}
`;

const AGENT_RESEARCH_CSS = `
.jgp-research-panel{border:1px solid #485884;border-radius:16px;padding:17px 19px;background:#172348;margin:0 0 17px;color:#f3f6ff}
.jgp-app .jgp-new-results .jgp-research-panel > h3{display:flex;gap:9px;align-items:center;font-size:18px;line-height:1.4;margin:0 0 6px;color:#f7f5ff!important;opacity:1!important;font-weight:750;text-shadow:none}
.jgp-app .jgp-new-results .jgp-research-panel > h3 svg{color:#c59bff;flex-shrink:0}
.jgp-research-panel>p{font-size:12px;line-height:1.6;color:#c0cceb;margin:0 0 12px}
.jgp-research-panel details{border-top:1px solid #3b496f;padding:10px 1px}
.jgp-research-panel summary{display:flex;align-items:center;gap:9px;cursor:pointer;font-size:14px;font-weight:650;list-style:revert}
.jgp-research-panel summary .jgp-research-tag{margin-left:auto;color:#c3cdea;font-size:11px;font-weight:400}
.jgp-research-panel .jgp-research-raw{font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;margin:12px 0 0;padding:12px;border:1px solid #3b496f;border-radius:10px;background:#101a37;color:#dbe4ff}
:root[data-theme='light'] .jgp-research-panel{background:#f3f2ff;color:#17244c;border-color:#c6c2e2}
:root[data-theme='light'] .jgp-app .jgp-new-results .jgp-research-panel > h3{color:#1c2850!important}
:root[data-theme='light'] .jgp-app .jgp-new-results .jgp-research-panel > h3 svg{color:#7d4bbf}
:root[data-theme='light'] .jgp-research-panel>p,:root[data-theme='light'] .jgp-research-panel summary .jgp-research-tag{color:#505d84}
:root[data-theme='light'] .jgp-research-panel details{border-color:#d9d5ed}
:root[data-theme='light'] .jgp-research-panel .jgp-research-raw{background:#fff;color:#21325c;border-color:#d0cdeb}

.jgp-research-panel .jgp-research-raw{white-space:normal;max-height:none}
.jgp-research-panel .jgp-research-disclaimer{margin:0 0 10px;font-size:12px;line-height:1.55;color:#d3defa}
.jgp-research-panel .jgp-research-summary{margin:0 0 8px;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.jgp-research-panel .jgp-source-list{margin:6px 0 0;padding-left:18px;list-style:disc;display:grid;gap:9px}
.jgp-research-panel .jgp-source-list li{line-height:1.5;color:#dbe4ff;font-size:13px;overflow-wrap:anywhere}
.jgp-research-panel .jgp-source-list a{color:#add5ff;text-decoration:underline;text-underline-offset:2px}
.jgp-research-panel .jgp-source-list small{display:block;font-size:11px;color:#b9c8ee;margin-top:2px;overflow-wrap:anywhere}
:root[data-theme='light'] .jgp-research-panel .jgp-research-disclaimer,:root[data-theme='light'] .jgp-research-panel .jgp-source-list li{color:#25365b}
:root[data-theme='light'] .jgp-research-panel .jgp-source-list a{color:#2259aa}
:root[data-theme='light'] .jgp-research-panel .jgp-source-list small{color:#526184}
@media print{.jgp-research-panel{display:none}}
`;

const AGENT_NAMES = {
  supervisor: 'Validating trip preferences',
  flight_agent: 'Flight Agent',
  train_agent: 'Train Agent',
  bus_agent: 'Bus Agent',
  road_agent: 'Road Agent',
  hotel_agent: 'Hotel Agent',
  weather_agent: 'Weather Agent',
  budget_agent: 'Budget Agent',
  itinerary_agent: 'Itinerary Agent'
};

// Preview the deterministic backend selection while waiting for the first SSE event.
// The backend's agents_selected event remains authoritative once received.
const plannedAgentsFromForm = (form) => {
  const transport = Array.isArray(form.transportation) ? form.transportation : [];
  const selected = [];
  if (transport.some(value => /flight|plane|air/i.test(value))) selected.push('flight_agent');
  if (transport.some(value => /train|rail/i.test(value))) selected.push('train_agent');
  if (transport.some(value => /bus|coach/i.test(value))) selected.push('bus_agent');
  if (transport.some(value => /road|car|driv|taxi/i.test(value))) selected.push('road_agent');
  if (String(form.accommodation || '').trim()) selected.push('hotel_agent');
  if (String(form.weatherPreference || '').trim()) selected.push('weather_agent');
  if (String(form.budget || '').trim()) selected.push('budget_agent');
  selected.push('itinerary_agent');
  return selected;
};

const readTripProgress = async (request, onEvent, signal) => {
  const baseURL = String(API.defaults.baseURL || '').replace(/\/$/, '');
  const url = `${baseURL}/generate-trip/stream`;
  const token = localStorage.getItem('access_token');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? {'Authorization': `Bearer ${token}`} : {})
    },
    body: JSON.stringify(request),
    signal
  });
  if (!response.ok) {
    let detail = `Trip generation failed (HTTP ${response.status}).`;
    try {
      const payload = await response.json();
      detail = typeof payload.detail === 'string' ? payload.detail : detail;
    } catch { /* Keep the HTTP error if the server did not return JSON. */ }
    throw new Error(detail);
  }
  if (!response.body) throw new Error('Your browser cannot read the live generation stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = null;
  const handleFrame = frame => {
    let event = 'message';
    const dataLines = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let data;
    try { data = JSON.parse(dataLines.join('\n')); }
    catch { throw new Error('The server sent an invalid live-progress message.'); }
    if (signal?.aborted) return;
    onEvent(event, data);
    if (event === 'workflow_completed') completed = data;
    if (event === 'workflow_error') throw new Error(data.message || 'Trip generation failed.');
  };
  try {
    while (true) {
      const {done, value} = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), {stream: !done}).replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (frame.trim()) handleFrame(frame);
      }
      if (done) break;
    }
    if (buffer.trim()) handleFrame(buffer);
  } finally {
    reader.releaseLock();
  }
  if (signal?.aborted) throw new DOMException('Generation cancelled.', 'AbortError');
  if (!completed) throw new Error('The generation stream ended without a completed itinerary.');
  return completed;
};

const INTERESTS = ['Beaches', 'Culture', 'Food', 'Nature', 'Adventure', 'Shopping', 'History', 'Relaxation'];



const TRIP_TYPES = [



  { label: 'Leisure', icon: Palmtree },



  { label: 'Adventure', icon: Mountain },



  { label: 'Family', icon: Users },



  { label: 'Business', icon: BriefcaseBusiness }



];



const initialValues = (input = {}) => {



  const state = input ?? {};



  return {



  source: state.source || '', destination: state.destination || '',



  startDate: state.startDate || state.travelDate || '', endDate: state.endDate || '',



  travelers: String(state.travelers ?? ''), adults: state.adults != null ? String(state.adults) : (state.travelers != null ? String(state.travelers) : ''),



  children: state.children != null ? String(state.children) : '', budget: state.budget || '',



  tripType: state.tripType || '', interests: state.interests || [],



  travelPace: state.travelPace || '', weatherPreference: state.weatherPreference || '',



  accommodation: state.accommodation || '', foodPreferences: state.foodPreferences || [],



  transportation: state.transportation || [], specialRequirements: state.specialRequirements || ''



  };



};


// A complete generated plan must always be stored with the preferences that
// actually produced it. The editable form is not the source of truth after a
// successful generation, because a user may change fields before clicking Save.
const snapshotTripForm = (value = {}) => {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fields = initialValues(input);
  const count = value => Math.max(0, Math.trunc(Number(value) || 0));
  const adults = count(fields.adults);
  const children = count(fields.children);
  return {
    ...input,
    ...fields,
    source: String(fields.source || '').trim(),
    destination: String(fields.destination || '').trim(),
    startDate: String(fields.startDate || '').trim(),
    endDate: String(fields.endDate || '').trim(),
    travelDate: String(fields.startDate || '').trim(), // Legacy saved-trip readers.
    adults,
    children,
    travelers: adults + children,
    interests: [...(Array.isArray(fields.interests) ? fields.interests : [])],
    foodPreferences: [...(Array.isArray(fields.foodPreferences) ? fields.foodPreferences : [])],
    transportation: [...(Array.isArray(fields.transportation) ? fields.transportation : [])],
    itineraryLanguage: 'en'
  };
};

const tripFormSignature = value => {
  const values = initialValues(value);
  return JSON.stringify([
    String(values.source).trim(), String(values.destination).trim(),
    values.startDate, values.endDate,
    Number(values.adults || 0), Number(values.children || 0),
    values.budget, values.tripType,
    [...(Array.isArray(values.interests) ? values.interests : [])].sort(),
    values.travelPace, values.weatherPreference, values.accommodation,
    [...(Array.isArray(values.foodPreferences) ? values.foodPreferences : [])].sort(),
    [...(Array.isArray(values.transportation) ? values.transportation : [])].sort(),
    String(values.specialRequirements).trim()
  ]);
};



const safeDate = (date) => date ? date.split('-').reverse().join('/') : 'Not selected';

const rangeDate = (start, end) => {
  if (!start) return 'Choose departure & return';
  return `${safeDate(start)}${end ? ` – ${safeDate(end)}` : ' – Return date'}`;
};



const tripDays = (start, end) => {



  if (!start || !end) return null;



  const a = Date.parse(`${start}T12:00:00`), b = Date.parse(`${end}T12:00:00`);



  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 86400000) + 1 : null;



};



// Extract numbered days while excluding the overview and closing summaries.*

const parseDays = (markdown) => {

  const sections = [];

  let current = null;

  for (const line of String(markdown || '').split('\n')) {

    const plain = line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/\*\*/g, '').trim();

    const heading = plain.match(/^Day\s+(\d+)\b(?:\s*[-–—:]\s*(.*))?/i);

    if (heading) {

      if (current) sections.push(current);

      current = { day: Number(heading[1]), title: `Day ${heading[1]}${heading[2] ? ` — ${heading[2]}` : ''}`, body: '' };

      continue;

    }

    if (current && /^(transportation summary|accommodation|food & dining|budget snapshot|budget breakdown|booking|travel tips|important notes|conclusion|packing list|trip overview)\b/i.test(plain)) {

      sections.push(current);

      current = null;

    }

    if (current) current.body += `${line}\n`;

  }

  if (current) sections.push(current);

  return [...new Map(sections.filter(item => Number.isInteger(item.day) && item.day > 0).map(item => [item.day, item])).values()].sort((a, b) => a.day - b.day);

};



const cleanActivity = (value) => String(value || '')
  .replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '')
  .replace(/\*\*/g, '').replace(/[`*_]/g, '')
  .replace(/^[-•]\s*/, '')
  // Older saved itineraries may include unsupported cost annotations inside the activity.
  .replace(/\s*\(\s*(?:estimated\s+)?cost\s*:\s*(?:not verified|unverified|unknown|not available|n\/?a|tbd|verify price|free|not specified|not provided|to be confirmed)\s*\)/gi, '')
  .replace(/\s*[—–-]\s*(?:estimated\s+)?cost\s*:\s*(?:not verified|unverified|unknown|not available|n\/?a|tbd|verify price|free|not specified|not provided|to be confirmed)\s*$/gi, '')
  .replace(/\s+/g, ' ').trim();

const summarizeDay = (body) => {
  const items = [];
  let period = 'Activity';
  let checklist = false;
  const add = (label, value) => {
    const text = cleanActivity(value).replace(/\s+[—–-]\s*(?:Verified|Suggested|Not verified|Verification needed)\b.*$/i, '').trim();
    if (!text || text.length < 8 || /^(?:verification checklist|confirm|book airport|reserve|identify|check availability|action required|note:)/i.test(text)) return;
    if (/^[-|: ]+$/.test(text) || items.some(x => x.activity.toLowerCase() === text.toLowerCase())) return;
    items.push({label: cleanActivity(label), activity: text});
  };
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const plain = cleanActivity(line.replace(/^#{1,6}\s*/, ''));
    if (/^(verification checklist|booking checklist|things to confirm|important notes|notes|tips|what to confirm)\b/i.test(plain)) { checklist = true; continue; }
    if (checklist) continue;
    const heading = plain.match(/^(morning|mid[- ]?morning|afternoon|early afternoon|late afternoon|evening|night)\s*:?$/i);
    if (heading) { period = heading[1]; continue; }
    if (/^\s*\|/.test(line)) {
      const cells = line.split('|').map(cleanActivity).filter(Boolean);
      if (cells.length >= 2 && !/^(time|segment|item|suggested activity|activity|leg|category|[-: ]+)$/i.test(cells[0])) {
        if (/^(morning|mid.morning|afternoon|early afternoon|late afternoon|evening|night)$/i.test(cells[0])) period = cells[0];
        add(period, cells[1]);
      }
      continue;
    }
    const timed = plain.match(/^(morning|mid[- ]?morning|afternoon|early afternoon|late afternoon|evening|night)\s*[-–—:]\s*(.+)$/i);
    if (timed) { period = timed[1]; add(period, timed[2]); continue; }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) { add(period, bullet[1]); continue; }
    if (!/^#{1,6}\s/.test(line) && period !== 'Activity' && plain.length > 14) add(period, plain);
  }
  return items.slice(0, 24);
};

// Preserve real AI-provided times and costs. Never invent a clock time or price.
const parseTimedActivities = (body) => {
  const activities = [];
  const lines = String(body || '').split('\n');
  const clock = '(?:[01]?\\d|2[0-3])(?::[0-5]\\d)?\\s*(?:[AaPp]\\.?[Mm]\\.?)?';
  const timePattern = new RegExp(`^(${clock}\\s*(?:[-–—]|to)\\s*${clock}|${clock})\\s*(?:[:|–—-]\\s*)?(.+)$`, 'i');
  const seen = new Set();
  let period = '';
  const add = (time, description, cost = '') => {
    const activity = cleanActivity(description);
    if (!activity || activity.length < 4 || /^(activity|description|details|time|cost|estimated cost)$/i.test(activity)) return;
    const key = `${time}|${activity}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    activities.push({time: cleanActivity(time), label: cleanActivity(time) || period || 'Time not specified', activity, cost: cleanActivity(cost)});
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const plain = cleanActivity(line.replace(/^#{1,6}\s*/, ''));
    if (/^(morning|afternoon|evening|night|midday)\s*:?$/i.test(plain)) { period = plain; continue; }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1,-1).map(cleanActivity);
      if (cells.length >= 2 && !/^[:\s-]+$/.test(cells[0]) && !/^(time|slot|schedule|period)$/i.test(cells[0])) {
        const match = cells[0].match(timePattern);
        if (match) add(match[1], [match[2], cells[1]].filter(Boolean).join(' — '), cells.slice(2).join(' · '));
        else if (/^(morning|afternoon|evening|night)$/i.test(cells[0])) add('', cells[1], cells.slice(2).join(' · '));
      }
      continue;
    }
    const stripped = plain.replace(/^\d+[.)]\s*/, '');
    const match = stripped.match(timePattern);
    if (match && /\d/.test(match[1])) add(match[1], match[2]);
  }
  return activities.length ? activities.slice(0, 36) : summarizeDay(body).map(item => ({...item, time: ''}));
};



const dateForDay = (startDate, day) => {

  if (!startDate) return null;

  const date = new Date(`${startDate}T12:00:00`);

  date.setDate(date.getDate() + Number(day) - 1);

  return date;

};



// Place photos are fetched from Wikimedia Commons, not random unrelated stock images.
// A neutral local fallback is used whenever no suitable image is returned.
const FALLBACK_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" fill="#e8ecf7"/><path d="M0 345L165 170l120 125 95-105 260 155v75H0z" fill="#c1cce6"/><circle cx="470" cy="115" r="42" fill="#d5b8f8"/><text x="320" y="385" font-family="sans-serif" font-size="21" text-anchor="middle" fill="#536486">Destination photo unavailable</text></svg>')}`;
// A Maps search URL is a search, not proof that the venue exists.
const mapLink = (place, destination = '') =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place, destination].filter(Boolean).join(', '))}`;

// Maps URLs open in Google Maps without a Maps Platform API key.
// Map directions are calculated by Google Maps when the link opens.
const dayRouteLink = (places, destination = '') => {
  // Limit to five stops (three intermediates) for mobile browser compatibility.
  const stops = places.slice(0, 5).map(place => [place, destination].filter(Boolean).join(', '));
  if (stops.length < 2) return '';
  const params = new URLSearchParams({api: '1', origin: stops[0], destination: stops[stops.length - 1], travelmode: 'driving'});
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const PLACE_ENDINGS = 'Palace|Fort|Temple|Museum|Bazaar|Market|Lake|Garden|Park|Beach|Falls|Waterfall|Church|Mosque|Hotel|Restaurant|Cafe|Café|Station|Airport|Valley|Monastery|Road|Pass|Springs|Square|Point|Viewpoint';
const identifyPlace = (activity) => {
  const text = cleanActivity(activity);
  const named = text.match(new RegExp(`\\b([A-Z][\\p{L}\\p{N}'’.-]*(?:\\s+(?:[A-Z][\\p{L}\\p{N}'’.-]*|of|the|and|&)){0,5}\\s+(?:${PLACE_ENDINGS}))\\b`, 'iu'));
  if (named) return named[1].trim();
  const direct = text.match(/\b(?:visit|explore|at|near|around|tour)\s+(?:the\s+)?([A-Z][\p{L}\p{N}'’.-]*(?:\s+[A-Z][\p{L}\p{N}'’.-]*){0,3})/u);
  if (direct && direct[1].split(' ').length >= 2) return direct[1].trim();
  return '';
};

const activityType = (activity) => {
  const text = cleanActivity(activity);
  if (/\b(flight|airport|train|station|bus|taxi|cab|drive|transfer|transport|depart|arrive|travel to)\b/i.test(text)) return 'Travel & Transport';
  if (/\b(hotel|hostel|resort|homestay|check.in|accommodation|airbnb)\b/i.test(text)) return 'Hotels & Stays';
  if (/\b(restaurant|cafe|café|breakfast|lunch|dinner|food|eat|snack|dining)\b/i.test(text)) return 'Food & Dining';
  return 'Places to Visit';
};

const currency = value => `₹${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
const costFromText = text => {
  const match = String(text || '').match(/(?:₹|INR|Rs\.?)[\s]*([\d,]+)(?:\s*[-–]\s*(?:₹|INR|Rs\.?)?\s*([\d,]+))?/i);
  if (!match) return null;
  const first = Number(match[1].replace(/,/g, ''));
  const second = match[2] ? Number(match[2].replace(/,/g, '')) : first;
  return Number.isFinite(first) && first >= 0 && first <= 10000000 ? Math.round((first + second) / 2) : null;
};
const activityCost = (activity) => costFromText(activity);
const dayCost = (activities) => {
  const costs = activities.map(item => costFromText(item.cost) ?? activityCost(item.activity)).filter(value => value !== null);
  return costs.length ? {total: costs.reduce((sum, cost) => sum + cost, 0), known: costs.length, count: activities.length} : null;
};
const guideSummary = (markdown, days) => {
  const source = String(markdown || '');
  const lines = source.split('\n');
  const sections = [];
  let section = {title: 'Trip Overview', lines: []};
  const push = () => { if (section.lines.some(line => line.trim())) sections.push(section); };
  for (const line of lines) {
    const raw = line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    if (/^Day\s+\d+\b/i.test(raw)) { push(); section = {title: 'SKIP_DAY', lines: []}; continue; }
    if (/^(transportation summary|transportation details|accommodation|food & dining|budget snapshot|budget breakdown|booking|travel tips|important notes|conclusion|packing list|trip overview)\b/i.test(raw) && (line.startsWith('#') || !line.startsWith('-'))) {
      push(); section = {title: raw, lines: []}; continue;
    }
    if (section.title !== 'SKIP_DAY') section.lines.push(line);
  }
  push();
  const cleanLines = block => {
    const result = [];
    for (const line of block) {
      const trimmed = line.trim();
      if (!trimmed || /^\|?\s*:?-{3,}/.test(trimmed) || /^\*?\*?(?:item|time|segment|leg|category)\b/i.test(trimmed)) continue;
      if (/^\s*\|/.test(trimmed)) {
        const cells = trimmed.split('|').map(cleanActivity).filter(Boolean);
        if (cells.length > 1) result.push(`${cells[0]}: ${cells.slice(1).join(' — ')}`);
      } else if (/^[-*•]\s+/.test(trimmed)) result.push(cleanActivity(trimmed));
      else if (trimmed.length > 20 && !/^#{1,6}\s/.test(trimmed)) result.push(cleanActivity(trimmed));
    }
    return [...new Set(result)].slice(0, 7);
  };
  return sections.map(section => ({title: section.title, points: cleanLines(section.lines)})).filter(section => section.points.length).slice(0, 8);
};

const replaceOneDay = (original, dayNumber, replacement) => {
  const lines = String(original || '').split('\n');
  const isDayHeading = line => /^\s{0,3}#{0,6}\s*\*{0,2}Day\s+\d+\b/i.test(line);
  const dayNumberOf = line => Number(line.match(/Day\s+(\d+)/i)?.[1]);
  const start = lines.findIndex(line => isDayHeading(line) && dayNumberOf(line) === dayNumber);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const clean = lines[i].replace(/^[#*\s]+/, '');
    if (isDayHeading(lines[i]) || /^(transportation summary|transportation details|accommodation|food & dining|budget snapshot|budget breakdown|booking|travel tips|important notes|conclusion|packing list|trip overview)\b/i.test(clean)) { end = i; break; }
  }
  return [...lines.slice(0, start), replacement.trim(), ...lines.slice(end)].join('\n');
};

// Step 4: Search Wikimedia Commons files (not Wikipedia article thumbnails).
// Photos are requested only when visible; no AI requests or API keys are needed.
// A shared promise cache prevents duplicate searches for the same place.
const photoCache = new Map();
const photoInFlight = new Map();
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const cleanPhotoWords = value => String(value || '').toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Only show a photo when the file title identifies the actual landmark.
// An unrelated photograph is less helpful than the existing placeholder.
const chooseCommonsImage = (pages, place, destination) => {
  const wanted = cleanPhotoWords(place);
  const wantedWords = wanted.split(' ').filter(Boolean);
  const city = cleanPhotoWords(String(destination).split(',')[0]);
  const ambiguous = /^(city palace|central park|town hall|city museum|fort|temple|garden|palace|museum|lake|park)$/i.test(place);
  if (wantedWords.length < 2) return null;

  const candidates = pages.map(page => {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !/^image\/(?:jpeg|png|webp)$/i.test(info.mime || '')) return null;
    const filename = String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, '');
    const title = cleanPhotoWords(filename);
    if (/\b(map|logo|icon|diagram|illustration|drawing|painting|poster|flag|floorplan|sketch|render|collage|certificate|model|replica|screenshot|train|railway|bus)\b/i.test(title)) return null;
    if (info.width && info.height && (info.width < 360 || info.height < 220)) return null;

    const exactName = (` ${title} `).includes(` ${wanted} `);
    const allWords = wantedWords.every(word => (` ${title} `).includes(` ${word} `));
    const matchesCity = Boolean(city && (` ${title} `).includes(` ${city} `));
    // For a generic name like City Palace, the city must also be in the file name.
    if ((!exactName && !(allWords && matchesCity)) || (ambiguous && !matchesCity)) return null;
    // Do not accept an unrelated scene even when a broad search returns it.
    const details = info.extmetadata || {};
    const plain = html => String(html || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
    const license = plain(details.LicenseShortName?.value || details.UsageTerms?.value);
    const author = plain(details.Artist?.value);
    return {
      score: (exactName ? 50 : 20) + (matchesCity ? 30 : 0) - Math.min(15, title.split(' ').length - wantedWords.length),
      src: info.thumburl,
      pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
      license, author: author.slice(0, 100)
    };
  }).filter(Boolean).sort((left, right) => right.score - left.score);
  return candidates[0] || null;
};

const lookupCommonsPhoto = async (place, destination) => {
  const name = String(place || '').trim();
  if (!name) return null;
  const city = String(destination || '').split(',')[0].trim();
  // Search Commons file titles and captions, then validate candidates locally.
  const searches = [
    [name, city].filter(Boolean).join(' '),
    name
  ];
  for (const search of [...new Set(searches)]) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrsearch: search, gsrnamespace: '6', gsrlimit: '15',
      prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '480',
      iiextmetadatafilter: 'LicenseShortName|UsageTerms|Artist'
    });
    const response = await fetch(`${COMMONS_API}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikimedia Commons responded ${response.status}`);
    const json = await response.json();
    const pages = Object.values(json?.query?.pages || {});
    const match = chooseCommonsImage(pages, name, destination);
    if (match) return match;
  }
  return null;
};

const cachedCommonsPhoto = (place, destination) => {
  const key = `${cleanPhotoWords(place)}|${cleanPhotoWords(destination)}`;
  const saved = photoCache.get(key);
  if (saved && (saved.photo || Date.now() - saved.at < 5 * 60 * 1000)) {
    return Promise.resolve(saved.photo);
  }
  if (photoInFlight.has(key)) return photoInFlight.get(key);
  const job = lookupCommonsPhoto(place, destination)
    .then(photo => {
      photoCache.set(key, {photo, at: Date.now()});
      return photo;
    })
    .finally(() => photoInFlight.delete(key));
  photoInFlight.set(key, job);
  return job;
};

function PlacePhoto({ place, destination = '', className = '' }) {
  const [photo, setPhoto] = useState(null);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const photoRef = useRef(null);

  useEffect(() => {
    const target = photoRef.current;
    if (!target || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, {rootMargin: '250px'});
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    let active = true;
    setPhoto(null);
    setPhotoChecked(false);
    if (visible && place) {
      cachedCommonsPhoto(place, destination)
        .then(result => { if (active) { setPhoto(result); setPhotoChecked(true); } })
        .catch(() => { if (active) { setPhoto(null); setPhotoChecked(true); } });
    }
    return () => { active = false; };
  }, [visible, place, destination]);

  return <div className={`jgp-commons-photo${photoChecked && !photo ? " jgp-photo-unavailable" : ""}`} ref={photoRef}>
    <img
      className={className}
      src={photo?.src || FALLBACK_PHOTO}
      alt={photo ? `Photo of ${place}` : 'Place photo unavailable'}
      loading="lazy"
      decoding="async"
      onError={() => { setPhoto(null); setPhotoChecked(true); }}
    />
    {photo?.pageUrl && <a className="jgp-commons-credit" href={photo.pageUrl}
      target="_blank" rel="noopener noreferrer"
      title={[photo.author || 'Wikimedia Commons contributor', photo.license || 'View file license'].join(' · ')}>
      Photo credit · {photo.license || 'License'}
    </a>}
  </div>;
}

// Convert both two-column and three-column Markdown tables, plus bullet lists,
// into activity cards without any extra AI requests.
const normalizeClock = value => String(value || '').replace(/\b(\d{1,2}):(\d{2})\s*([AP]M)\b/gi, (_, hour, minute, ap) => {
  const numeric = Number(hour);
  return `${numeric > 12 ? numeric - 12 : numeric || 12}:${minute} ${ap.toUpperCase()}`;
});
const normalizeCost = value => {
  const cost = cleanActivity(value).replace(/^(?:estimated\s+)?cost\s*:\s*/i, '').trim();
  if (!cost || /(?:not verified|unverified|unknown|not available|n\/?a|tbd|to be confirmed|not specified|verification needed|verify price|price unavailable|cost unavailable|not provided)/i.test(cost) || /^(?:—|–|-)$/i.test(cost)) return '';
  const priced = cost.match(/(?:₹|\bINR\b|\bRs\.?\s*)\s*\d[\d,]*(?:\s*[-–]\s*(?:₹|INR|Rs\.?)?\s*\d[\d,]*)?/i);
  return priced ? priced[0].trim() : '';
};
const separateActivityCost = (activity, cost) => {
  let description = cleanActivity(activity);
  let amount = cleanActivity(cost);
  const embedded = description.match(/\s*(?:\||[—–-])\s*(?:estimated\s+)?Cost\s*:\s*(.+)$/i)
    || description.match(/\s*\(\s*(?:estimated\s+)?Cost\s*:\s*([^)]*)\)/i);
  if (embedded) {
    description = description.slice(0, embedded.index).trim();
    if (!amount) amount = embedded[1];
  }
  return {description, amount: normalizeCost(amount)};
};
const oneClock = String.raw`(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:AM|PM)?`;
const timeRange = new RegExp(`^(${oneClock}(?:\\s*(?:[-–—]|to)\\s*${oneClock})?)\\s*(?:[:|–—-]\\s+|\\|\\s*)(.+)$`, 'i');
const looksLikeTime = new RegExp(`^${oneClock}(?:\\s*(?:[-–—]|to)\\s*${oneClock})?$`, 'i');
const splitTimeAndActivity = value => {
  const text = cleanActivity(value);
  if (looksLikeTime.test(text)) return {time: text, activity: ''};
  const matched = text.match(timeRange);
  if (matched) return {time: matched[1], activity: matched[2]};
  // Some models use "7:00 AM – Depart Kota" in a single table cell.
  return {time: '', activity: text};
};
const isTableSeparator = cells => cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
const isTableHeader = cells => {
  const first = (cells[0] || '').toLowerCase();
  const second = (cells[1] || '').toLowerCase();
  return /^(time(?:\s*\(local\))?|period|slot|schedule|activity|description|segment)$/.test(first) ||
    /^(activity(?:\s+and\s+named\s+place)?|description|estimated\s+cost(?:\s+per\s+person.*)?|place)$/.test(second);
};
// Time-of-day headings are context, not standalone activities.
const PERIOD_ONLY = /^(?:morning|mid[- ]?morning|midday|afternoon|evening|night|सुबह|दोपहर|शाम|रात|प्रातः|सवेरे|सायं|दोपहर बाद)(?:\s*[:：-])?$/iu;
const PLACEHOLDER_ACTIVITY = /^(?:time not specified|not specified|activity|description|details|flexible|free slot|to be decided|tbd|n\/?a|समय निर्धारित नहीं|समय नहीं दिया|गतिविधि|विवरण)$/iu;

// Reminders belong in the tips panel, never in the activity timeline or Maps links.
const GENERAL_TRAVEL_ADVICE = /^(?:(?:please\s+)?(?:verify|confirm|check|remember|ensure|carry|pack|bring|keep|avoid|consider|pre[- ]?book|book in advance|book tickets|reserve in advance|stay hydrated|wear sunscreen|keep hydrated|download offline maps|allow extra time)\b|(?:tip|reminder|note|important|advice)\s*[:—-])/i;
const isGeneralTravelAdvice = value => {
  const text = cleanActivity(value).replace(/^(?:travel tips?|reminders?)\s*[:—-]\s*/i, '');
  return GENERAL_TRAVEL_ADVICE.test(text) || /^(?:water bottle|sunscreen|comfortable shoes|valid id|photo id|cash for tickets|emergency contacts)\b/i.test(text);
};

const parseActivityCards = markdown => {
  const rows = [];
  const seen = new Set();
  let period = '';
  const add = (time, description, cost = '') => {
    const formattedTime = normalizeClock(cleanActivity(time));
    const {description: activity, amount} = separateActivityCost(description, cost);
    if (!activity || PERIOD_ONLY.test(activity) || PLACEHOLDER_ACTIVITY.test(activity) || isGeneralTravelAdvice(activity) || /^[:\s\-|]+$/.test(activity) ||
        /^(?:time\s*\(local\)|activity and named place|estimated cost per person\s*\(INR\)|activity|description|place)$/i.test(activity)) return;
    const key = activity.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({time: formattedTime || period || 'Time not specified', activity, cost: amount});
  };

  for (const raw of String(markdown || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    if (PERIOD_ONLY.test(heading)) {
      period = heading.replace(/:$/, '');
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;

    if (line.startsWith('|')) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cleanActivity);
      if (cells.length < 2 || isTableSeparator(cells) || isTableHeader(cells)) continue;
      const first = splitTimeAndActivity(cells[0]);
      if (first.time && first.activity) {
        add(first.time, first.activity, cells.slice(1).find(cell => normalizeCost(cell)) || '');
      } else if (first.time && cells.length >= 2) {
        add(first.time, cells[1], cells.slice(2).join(' · '));
      } else if (PERIOD_ONLY.test(cells[0])) {
        add(cells[0], cells[1], cells.slice(2).join(' · '));
      } else if (cells.length >= 3 && cells[1]) {
        // Preserve an activity even when the model omits the clock time.
        add('', cells[1], cells.slice(2).join(' · '));
      } else if (first.activity && cells.length === 2) {
        add('', first.activity, cells[1]);
      }
      continue;
    }

    if (!/^(?:[-*•]\s+|\d+[.)]\s+)/u.test(line)) continue;
    const text = line.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/u, '').trim();
    const pieces = text.split('|').map(cleanActivity);
    if (/^(?:flexible|time to confirm|schedule to confirm|timing TBD)$/i.test(pieces[0]) && pieces[1]) {
      add('Flexible', pieces[1], pieces.slice(2).join(' | '));
      continue;
    }
    const first = splitTimeAndActivity(pieces[0]);
    if (first.time && first.activity) add(first.time, first.activity, pieces.slice(1).join(' | '));
    else if (first.time && pieces.length >= 2) add(first.time, pieces[1], pieces.slice(2).join(' | '));
    else if (first.activity) add('', first.activity, pieces.slice(1).join(' | '));
    else if (pieces.length >= 2) add('', pieces[1], pieces.slice(2).join(' | '));
  }
  return rows.slice(0, 12);
};

// Names in itineraries can contain hyphens, local spelling variants and subtitles.
// Canonicalize only confidently identifiable landmarks; never guess an unrelated place.
const LANDMARK_ALIASES = [
  { pattern: /\bSaheliyon[\s-]*(?:ki|i)[\s-]*(?:Bari|Barah|Badi)\b/iu, name: 'Saheliyon Ki Bari' },
  { pattern: /\bGarden\s+of\s+the\s+Maidens\b/iu, name: 'Saheliyon Ki Bari' },
  { pattern: /\bBagore[\s-]*Ki[\s-]*Haveli\b/iu, name: 'Bagore Ki Haveli' },
  { pattern: /\bJantar[\s-]*Mantar\b/iu, name: 'Jantar Mantar' },
  { pattern: /\bLake\s+Pichola\b/iu, name: 'Lake Pichola' },
  { pattern: /\bCity\s+Palace\b/iu, name: 'City Palace' },
  { pattern: /\bNalanda\s+(?:Archaeological\s+Site|University\s+Ruins)\b/iu, name: 'Nalanda Archaeological Site' },
  { pattern: /\bGandhi\s+Maidan\b/iu, name: 'Gandhi Maidan' },
  { pattern: /\bKanch\s+Mandir\b/iu, name: 'Kanch Mandir' },
  { pattern: /\bRajwada\s+Palace\b/iu, name: 'Rajwada Palace' },
  { pattern: /\bMehtab\s+Bagh\b/iu, name: 'Mehtab Bagh' },
  { pattern: /\bSarafa\s+Bazaar\b/iu, name: 'Sarafa Bazaar' },
  { pattern: /\bLal\s+Bagh\s+Botanical\s+Garden\b/iu, name: 'Lal Bagh Botanical Garden' }
];

// Only generate links for recognizable, specifically named places.
// Generic check-ins, unspecified restaurants, journeys and rest periods stay icon-free.
const PLACE_SUFFIXES = 'Archaeological\\s+Site|World\\s+Heritage\\s+Site|Museum|Palace|Fort|Temple|Mandir|Mahal|Lake|Garden|Park|Barrage|Bazaar|Market|Ghat|Memorial|Monastery|Waterfall|Falls|Haveli|Maidan|Promenade|Beach|Church|Mosque|Cathedral|Zoo|Aquarium|Square|Stadium|Road|Street|Junction|Station|Airport|Restaurant|Cafe|Café|Dhaba|Hotel|Resort|Ashram|Gurudwara|Gurdwara|University';
const PLACE_WORD = String.raw`[A-Z][\p{L}\p{M}\p{N}'’.-]*`;
const placeSuffixPattern = new RegExp(`\\b((?:${PLACE_WORD}\\s+){1,5}(?:${PLACE_SUFFIXES}))\\b`, 'iu');
const suffixFirstPattern = new RegExp(`\\b((?:${PLACE_SUFFIXES})\\s+(?:of\\s+|at\\s+)?(?:${PLACE_WORD}\\s*){1,4})\\b`, 'iu');
const genericLocationName = /^(?:a|an|the|local|nearby|central|centrally|popular|suggested|hotel|restaurant|cafe|museum|market|station|airport|city|town|historic|historical|ancient|famous|private|any|some|good|best|budget|three|star|main|old|new|near|around|at|in|to|from|by|for|on|of|and|the|visit|explore|quick|stop|lunch|dinner|breakfast|taxi|train|bus|flight|return|depart|arrive|check|walk|stroll|watch|sunset|view|photo|tour|head|drive|take|try|enjoy|shopping|relax|rest)\b/i;
const leadingPlaceWords = /^(?:(?:visit|explore|tour|see|walk|stroll|view|taxi|drive|head|go|stop|take|guided|enjoy|photo|quick|lunch|dinner|breakfast|at|to|in|near|along|the|a|an|from|through|around|return|watch|sunset|shopping)\s+)+/i;
const genericActivityPattern = /\b(?:rest|relax|free time|check[ -]?in|check[ -]?out|return to hotel|transfer)\b/i;

const cleanPlaceCandidate = value => String(value || '')
  .replace(leadingPlaceWords, '')
  .replace(/\s+(?:at|near|in|for|with|and|then|by|from|on|during|after|before)\s*$/i, '')
  .replace(/^[“”"'\s,–—-]+|[“”"'\s,–—-]+$/g, '')
  .trim();

const isSpecificPlace = name => {
  const value = cleanPlaceCandidate(name);
  if (!value || value.length < 5 || value.length > 85) return false;
  if (/\b(?:before departure|after arrival|near airport|near station|or a local|or nearby|centrally located|budget hotel|local cafe|nearby cafe)\b/i.test(value)) return false;
  // Words such as 'Light brunch near the hotel' are descriptions, not place names.
  if (/\b(?:brunch|breakfast|lunch|dinner|snack|refreshments)\b/i.test(value) ||
      /\b(?:near the hotel|at the hotel|nearby caf[eé]|local restaurant|nearby restaurant|opposite the|opposite taj|after arrival|if time allows)\b/i.test(value)) return false;
  const words = value.split(/\s+/);
  if (words.length < 2 || words.length > 7) return false;
  if (genericLocationName.test(words[0]) && words.length === 2 && /^(?:hotel|restaurant|cafe|market|station|museum|park|road)$/i.test(words[1])) return false;
  if (/^(?:a|an|the|local|nearby|central|centrally|popular|suggested|budget|some|any)\s/i.test(value)) return false;
  return !/^(?:centrally located|popular stall|local hotel|nearby hotel|hotel check|some restaurant|a restaurant|the restaurant|the hotel|local market|city center|city centre)$/i.test(value);
};

const findActivityPlace = description => {
  const text = cleanActivity(description);
  if (!text) return '';
  // A city name alone does not identify the hotel where someone checks in.
  if (/\b(?:check[ -]?in|check[ -]?out|store luggage|hotel desk|centrally located hotel|return to hotel)\b/i.test(text)
      && !/\b(?:Hotel|Resort|Hostel)\s+[A-Z][\p{L}\p{M}]+/u.test(text)
      && !/\bat\s+[A-Z][\p{L}\p{M}]+\s+(?:Hotel|Resort|Hostel)\b/u.test(text)) return '';
  if (genericActivityPattern.test(text) && !/\b(?:at|near|to|in)\s+[A-Z]/.test(text)) return '';

  for (const {pattern, name} of LANDMARK_ALIASES) {
    if (pattern.test(text)) return name;
  }

  // Prefer the named venue before an alternative generic location.
  // Example: "Early tea at Madhav Veg or a local café before departure"
  // must search for "Madhav Veg", never "café before departure".
  const explicitVenue = text.match(/\b(?:at|near|through|around|along|visit|explore)\s+([\p{Lu}][\p{L}\p{M}\p{N}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}'’.-]*){1,4})(?=\s*(?:\bor\b|\band\b|[—–,;()]|$|\s+\b(?:before|after|for|with|to|in)\b))/u);
  if (explicitVenue && isSpecificPlace(explicitVenue[1]) && !/\b(?:Hotel|Cafe|Restaurant|Station)\s+(?:or|near|before|after)\b/i.test(explicitVenue[1])) return explicitVenue[1];

  // Capture explicitly named attractions and venues, including "Archaeological Site"
  // and "Maidan", which were previously omitted.
  for (const pattern of [placeSuffixPattern, suffixFirstPattern]) {
    const match = text.match(pattern);
    if (match) {
      const candidate = cleanPlaceCandidate(match[1]);
      // Do not mistake "café before departure" or "hotel near airport" for a proper name.
      if (/^(?:cafe|café|hotel|restaurant|market|station|airport|museum|park)\s+(?:before|after|near|for|with|during|departure|arrival|local|nearby)\b/i.test(candidate)) continue;
      if (isSpecificPlace(candidate)) return candidate;
    }
  }

  // Quoted proper names: e.g. lunch at “Bhojohori Manna” or “Mithila Rasoi”.
  // Only accept them when the activity explicitly indicates a visit/meal/venue.
  if (/\b(?:at|visit|explore|lunch|dinner|breakfast|eat|dine|coffee|stop|shopping)\b/i.test(text)) {
    const quoted = text.match(/[“"‘']([A-Z][\p{L}\p{M}\p{N}'’.-]*(?:\s+[A-Z][\p{L}\p{M}\p{N}'’.-]*){1,4})[”"’']/u);
    if (quoted && isSpecificPlace(quoted[1])) return quoted[1];
  }

  // Explicitly named restaurants and hotels can be written without a venue suffix,
  // e.g. "Lunch at Mumtaz, Calangute" or "Dinner at Al-Madina, Baga".
  const venue = text.match(/\b(?:breakfast|lunch|dinner|dine|eat|meal|coffee|stay|check[ -]?in)\s+(?:at|in)\s+([\p{Lu}][\p{L}\p{M}\p{N}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}'’.-]*){0,4})(?=\s*[,([]|\s*[—–-]|$)/u);
  if (venue) {
    const name = venue[1].trim();
    if (!/^(?:hotel|the hotel|a hotel|restaurant|the restaurant|airport|home|local|breakfast|lunch|dinner)$/i.test(name) && name.length >= 5) {
      const locality = text.slice(venue.index + venue[0].length).match(/^,\s*([\p{Lu}][\p{L}\p{M}'’.-]+)/u);
      return [name, locality?.[1]].filter(Boolean).join(', ');
    }
  }
  // Additional recognizable venue names after explicit "at" or "through".
  // Generic hotels and unnamed stops intentionally do not get a Maps link.
  const namedStop = text.match(/\b(?:at|through|around|along|near)\s+([A-Z][\p{L}\p{M}'’.-]*(?:\s+[A-Z][\p{L}\p{M}'’.-]*){1,3})(?=\s*(?:[—–,(-]|$|\s+(?:and|before|after|for|to|with)))/u);
  if (namedStop && isSpecificPlace(namedStop[1]) && !/\b(?:before|after|departure|arrival|nearby|local)\b/i.test(namedStop[1]) &&
      !/^(?:a |the |centrally |local |nearby |hotel |a centrally |a local )/i.test(namedStop[1])) {
    return namedStop[1];
  }
  return '';
};

// Explicit multilingual landmark aliases are conservative: they only match named attractions.
// English canonical names make Commons file searches possible for Hindi itineraries.
const MULTILINGUAL_LANDMARKS = [
  {name: 'Red Fort', terms: ['लाल किला', 'Red Fort', 'Lal Qila']},
  {name: 'Chandni Chowk', terms: ['चांदनी चौक', 'चाँदनी चौक', 'Chandni Chowk']},
  {name: 'Jama Masjid Delhi', terms: ['जामा मस्जिद', 'Jama Masjid']},
  {name: 'Raj Ghat Delhi', terms: ['राजघाट', 'राज घाट', 'Raj Ghat']},
  {name: 'Lodhi Gardens', terms: ['लोधी गार्डन', 'लोदी गार्डन', 'लोधी उद्यान', 'Lodhi Garden', 'Lodi Garden']},
  {name: 'National Museum New Delhi', terms: ['राष्ट्रीय संग्रहालय', 'National Museum']},
  {name: 'Qutb Minar', terms: ['कुतुब मीनार', 'क़ुतुब मीनार', 'कुतुबमीनार', 'Qutub Minar', 'Qutb Minar']},
  {name: 'India Gate', terms: ['इंडिया गेट', 'India Gate']},
  {name: 'Connaught Place', terms: ['कनॉट प्लेस', 'कनाट प्लेस', 'Connaught Place']},
  {name: 'Swaminarayan Akshardham Delhi', terms: ['अक्षरधाम मंदिर', 'अक्षरधाम', 'Akshardham']},
  {name: 'National Gallery of Modern Art New Delhi', terms: ['राष्ट्रीय आधुनिक कला दीर्घा', 'नेशनल गैलरी ऑफ मॉडर्न आर्ट', 'National Gallery of Modern Art']},
  {name: 'Gurudwara Bangla Sahib', terms: ['बंगला साहिब', 'बांग्ला साहिब', 'Bangla Sahib']},
  {name: 'Humayun Tomb', terms: ['हुमायूँ का मकबरा', 'हुमायूं का मकबरा', "Humayun's Tomb", 'Humayun Tomb']},
  {name: 'Lotus Temple', terms: ['लोटस टेम्पल', 'कमल मंदिर', 'Lotus Temple']},
  {name: 'Dilli Haat INA', terms: ['दिल्ली हाट', 'Dilli Haat']},
  {name: 'Sarojini Nagar Market', terms: ['सरोजिनी नगर मार्केट', 'सरोजिनी नगर बाजार', 'Sarojini Nagar Market']},
  {name: 'Janpath Market', terms: ['जनपथ मार्केट', 'जनपथ बाजार', 'Janpath Market']},
  {name: 'Agrasen ki Baoli', terms: ['अग्रसेन की बावली', 'Agrasen ki Baoli']},
  {name: 'Purana Qila', terms: ['पुराना किला', 'Purana Qila']}
];
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namedLandmark = description => {
  const text = cleanActivity(description);
  for (const item of MULTILINGUAL_LANDMARKS) {
    for (const term of item.terms) {
      // Avoid matching an English name embedded in a longer unrelated word.
      const escaped = escapeRegExp(term);
      const expression = new RegExp(`(^|[^\\p{L}\\p{M}])${escaped}(?=$|[^\\p{L}\\p{M}])`, 'iu');
      if (expression.test(text)) return item.name;
    }
  }
  return '';
};

// Named Hindi places also get map links, but generic activity descriptions do not.
const findHindiActivityPlace = description => {
  const text = cleanActivity(description);
  const suffix = '(?:पुरातात्विक\\s+स्थल|संग्रहालय|बाजार|मार्केट|मंदिर|महल|किला|झील|गार्डन|पार्क|घाट|चर्च|जलप्रपात|मैदान|बीच)';
  const match = text.match(new RegExp(`([\\p{Script=Devanagari}\\p{L}\\p{M}]+(?:[\\s-]+[\\p{Script=Devanagari}\\p{L}\\p{M}]+){0,3}\\s+${suffix})`, 'u'));
  if (!match) return '';
  return match[1].replace(/^(?:पर|में|के|से|और|सुबह|शाम|दोपहर|रात|घूमने|जाएँ|जाना|देखें)\s+/u, '').trim();
};

// Reuse this extractor for both the individual map icons and the daily route.
// Resolve only a concrete named venue. Never use an activity description as a Maps query.
const getActivityPlace = description => {
  const text = cleanActivity(description);
  if (!text || isGeneralTravelAdvice(text)) return '';
  // Intercity travel is an action, not a named tourist attraction. Never
  // search Google Maps for the entire flight/train/bus route description.
  if (/^(?:travel|return|journey|depart|departure|head back|drive|transfer)\b/i.test(text) &&
      /\b(?:from|to)\b/i.test(text)) return '';
  // A meal with an unspecified café, stall or restaurant has no known Maps
  // destination. Retain links for explicitly named landmarks/restaurants.
  if (/\b(?:breakfast|brunch|lunch|dinner|snack|meal|tea|coffee)\b/i.test(text) &&
      /\b(?:street stall|street-food stall|halal-friendly|nearby restaurant|nearby caf[eé]|local eatery|local restaurant|reputable local eatery|near the hostel|near the hotel|restaurant serving)\b/i.test(text) &&
      !namedLandmark(text) &&
      !/\bat\s+[A-Z][\p{L}\p{M}'’.-]*(?:\s+[A-Z][\p{L}\p{M}'’.-]*){1,3}/u.test(text)) return '';
  // A generic meal, unnamed hotel, or transport instruction is NOT a Maps place.
  if (/\b(?:breakfast|brunch|lunch|dinner|meal|snack|tea|coffee)\b.*\b(?:at|in|near|around)\s+(?:(?:a|the)\s+)?(?:hotel|nearby|local|any|generic|unspecified)\b/i.test(text) ||
      /\b(?:hotel|caf[eé]|restaurant)\s+or\s+(?:a\s+)?nearby\b/i.test(text) ||
      /\b(?:flight|train|road|bus)\b.*\b(?:from|to)\s+[^,]+\b(?:to|from)\b/i.test(text)) return '';
  // For a named venue followed by an alternative, search the named venue only.
  // e.g. "Early tea at Madhav Veg or a local café before departure".
  const namedAlternative = text.match(/\bat\s+([\p{Lu}][\p{L}\p{M}\p{N}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}\p{N}'’.-]*){1,4})\s+or\s+/u);
  if (namedAlternative && isSpecificPlace(namedAlternative[1])) return namedAlternative[1];
  // A named landmark inside a meal description is still a valid search target.
  const landmark = namedLandmark(text);
  if (landmark) return landmark;
  if (/\b(?:breakfast|brunch|lunch|dinner|meal|snack|tea|coffee)\b.*\b(?:a|the|some|nearby|local|popular|reputable|unnamed|unspecified)\s+(?:\w+\s+){0,3}?(?:hotel|caf[eé]|restaurant|eatery|stall)\b/i.test(text)) return '';
  return findActivityPlace(text) || findHindiActivityPlace(text);
};

// Route links contain only sightseeing landmarks, never meals, hotels, transit or
// vague suggestions. A route is offered only with at least two distinct stops.
const getSightseeingRoutePlace = description => {
  const text = cleanActivity(description);
  if (/\b(?:breakfast|lunch|dinner|tea|coffee|snack|check[ -]?in|check[ -]?out|hotel|train|bus|flight|airport|taxi|transfer|depart|arrive|return)\b/i.test(text)) return '';
  const place = getActivityPlace(text);
  if (!place) return '';
  if (MULTILINGUAL_LANDMARKS.some(({name}) => name.toLowerCase() === place.toLowerCase())) return place;
  if (LANDMARK_ALIASES.some(({name}) => name.toLowerCase() === place.toLowerCase())) return place;
  if (placeSuffixPattern.test(place) || suffixFirstPattern.test(place)) return place;
  if (/[\p{Script=Devanagari}]/u.test(place)) return place;
  return '';
};

const landmarkPhotoPlace = (description, place) => {
  if (!place) return '';
  const activity = cleanActivity(description);
  if (/\b(?:check[ -]?in|check[ -]?out|return to hotel|rest|free time|depart|arrive|transfer|taxi to|drive to|train to|bus to|breakfast|lunch|dinner|snack|tea break)\b/i.test(activity)) return '';
  if (/\b(?:hotel|restaurant|dining hall|cafe|dhaba|station|airport|train|bus)\b/i.test(place)) return '';
  return MULTILINGUAL_LANDMARKS.some(item => item.name === place) ||
    LANDMARK_ALIASES.some(item => item.name === place) || placeSuffixPattern.test(place) ? place : '';
};

const getDayTravelTips = markdown => {
  const tips = [];
  for (const raw of String(markdown || '').split('\n')) {
    const line = raw.trim();
    if (!line || /^\|?\s*:?-{3,}/.test(line)) continue;
    const cells = line.startsWith('|') ? line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cleanActivity) : [];
    const description = cells.length >= 2 ? cells[1] : cleanActivity(line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, ''));
    const tip = description.replace(/^(?:important|note|tip|reminder)\s*[:—-]\s*/i, '').trim();
    if (tip.length >= 12 && /[\p{L}]/u.test(tip) && isGeneralTravelAdvice(description) && !tips.includes(tip)) tips.push(tip);
  }
  return tips.slice(0, 6);
};

function DayActivityCards({section, destination, onRegenerate, disabled}) {
  const entries = useMemo(() => parseActivityCards(section.content), [section.content]);
  const travelTips = useMemo(() => getDayTravelTips(section.content), [section.content]);
  const heading = section.content.split('\n').find(line => /^\s*#{1,6}\s+Day\s+\d+/i.test(line));
  const dayTitle = cleanActivity((heading || '').replace(/^\s*#{1,6}\s*/, '')) || `Day ${section.dayNumber}`;
  const activityCount = entries.length;
  const visitCount = entries.filter(entry => getSightseeingRoutePlace(entry.activity)).length;
  // Use sightseeing stops only, not train journeys, restaurants or hotels.
  // Preserve the order suggested by the itinerary; never claim route optimization.
  const routeStops = [...new Set(entries
    .map(entry => getSightseeingRoutePlace(entry.activity))
    .filter(Boolean))];
  const dailyRoute = dayRouteLink(routeStops, destination);
  const lastActivity = entries[entries.length - 1]?.activity || '';
  const returnArrivalUnspecified = /\b(?:return|back to|depart|onward|train or bus back)\b/i.test(lastActivity)
    && /\b(?:train|bus|flight|travel|depart|back to)\b/i.test(lastActivity)
    && !entries.some(entry => /\b(?:arrive|reach|arrival)\b/i.test(entry.activity) && /\b(?:home|origin)\b/i.test(entry.activity));
  return <article className="trip-details-itinerary-section trip-details-day-section jgp-compact-day">
    <div className="trip-details-day-actions">
      <span>DAY {section.dayNumber}</span>
    </div>
    <h3 className="jgp-compact-day-heading">{dayTitle}</h3>
    {activityCount > 0 && <p className="jgp-day-activity-count">{activityCount} scheduled {activityCount === 1 ? 'item' : 'items'}{visitCount > 0 ? ` · ${visitCount} sightseeing ${visitCount === 1 ? 'stop' : 'stops'}` : ''} · Times are suggested unless confirmed</p>}
    {dailyRoute && <div className="jgp-day-route-actions">
      <a href={dailyRoute} target="_blank" rel="noopener noreferrer" title="See suggested sightseeing stops on Google Maps">
        <Navigation size={16}/> View Day {section.dayNumber} Route ({Math.min(routeStops.length, 5)} stops)
      </a>
      {routeStops.length > 5 && <small>Showing the first 5 recognized stops</small>}
      <small>Route and travel times are calculated by Google Maps; confirm before travelling.</small>
    </div>}
    {entries.length ? <div className="jgp-compact-activities">
      {entries.map((entry, idx) => {
        const place = getActivityPlace(entry.activity);
        // All generated URLs are Google Maps searches, not verified place IDs.
        // Food businesses especially require confirmation before visiting.
        const isFoodStop = /\b(?:breakfast|lunch|dinner|tea|coffee|cafe|café|restaurant|dhaba|eat|dine|snack|meal)\b/i.test(entry.activity);
        const photoPlace = landmarkPhotoPlace(entry.activity, place);
        return <div className={`jgp-compact-activity ${photoPlace ? "jgp-has-place-photo" : "jgp-no-place-photo"}`} key={`${section.dayNumber}-${idx}`}>
          <div className="jgp-compact-time"><Clock size={15}/><span>{entry.time}</span></div>
          {photoPlace && <PlacePhoto className="jgp-compact-photo" place={photoPlace} destination={destination}/>}
          <div className="jgp-compact-details">
            <div className="jgp-compact-activity-main">
              <strong>{entry.activity}</strong>
              {place && <a
                href={mapLink(place, destination)}
                target="_blank"
                rel="noopener noreferrer"
                title={isFoodStop ? `Search Google Maps for ${place}; confirm the exact business before visiting` : `Search for ${place} in Google Maps`}
                aria-label={`Search Google Maps for ${place}`}
                className="jgp-activity-map-link"
              ><MapPin size={19}/><span>{'Search Google Maps'}</span></a>}
            </div>
            {normalizeCost(entry.cost) && <span className="jgp-compact-cost">Cost: {normalizeCost(entry.cost)}</span>}
          </div>
        </div>;
      })}
    </div> : <SavedTripMarkdown content={section.content.replace(/^\s*#{1,6}\s+Day\s+\d+[^\n]*\n?/i, '').replace(/^\s*Day\s+\d+[^\n]*\n?/i, '').replace(/^\s*\*\*Important:\*\*[^\n]*$/gim, '')}/>}
    {travelTips.length > 0 && <aside className="jgp-day-travel-tips"><strong>Travel tips & reminders</strong><ul>{travelTips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></aside>}
    {returnArrivalUnspecified && <p className="jgp-return-arrival-note">Return arrival time is not specified. Check the actual train, bus or flight schedule before finalizing this day.</p>}
  </article>;
}

// Match the Saved Trip page's Markdown sections and table rendering.
const normalizeSavedTripMarkdown = value => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/^\s*\*\*Regenerate Day\s+\d+\*\*\s*$/gim, '')
  .replace(/\s*\(\s*(?:estimated\s+)?cost\s*:\s*(?:not verified|unverified|unknown|not available|n\/?a|tbd|verify price|free|not specified|not provided|to be confirmed)\s*\)/gi, '')
  .replace(/\b(?:Cost\s*:\s*)?(?:Not verified|Verify price|Cost unavailable)\b/gi, '')
  .trim();

const splitSavedTripItinerary = (value, expectedDays = Infinity) => {
  const content = normalizeSavedTripMarkdown(value);
  if (!content) return [];
  const result = [];
  let current = null;
  const flush = () => {
    if (current && current.lines.join('\n').trim()) {
      result.push({ ...current, content: current.lines.join('\n').trim() });
    }
  };
  for (const line of content.split('\n')) {
    const dayMatch = line.match(/^\s{0,3}#{1,6}\s+\*{0,2}Day\s+(\d+)\b/i);
    const otherHeading = /^\s{0,3}#{1,6}\s+/.test(line);
    if (dayMatch) {
      flush();
      current = { key: `day-${dayMatch[1]}-${result.length}`, type: 'day', dayNumber: Number(dayMatch[1]), lines: [line] };
    } else if (otherHeading && current?.type === 'day') {
      flush();
      current = { key: `extra-${result.length}`, type: 'content', lines: [line] };
    } else {
      if (!current) current = { key: 'intro', type: 'content', lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  // A regenerated or repeated model response can contain the same numbered day
  // more than once. Show a single day card per day number, keeping the most
  // complete version rather than displaying duplicate Day 4 (etc.) cards.
  const uniqueDays = new Map();
  for (const section of result) {
    if (section.type !== 'day') continue;
    const previous = uniqueDays.get(section.dayNumber);
    if (!previous || section.content.length > previous.content.length) {
      uniqueDays.set(section.dayNumber, section);
    }
  }
  const renderedDays = new Set();
  return result.filter(section => {
    if (section.type === 'day' && (section.dayNumber < 1 || section.dayNumber > expectedDays)) return false;
    if (section.type !== 'day') return true;
    if (renderedDays.has(section.dayNumber)) return false;
    renderedDays.add(section.dayNumber);
    return true;
  }).map(section => section.type === 'day' ? uniqueDays.get(section.dayNumber) : section);
};

// Display the model's trip summary as readable fields without rewriting its facts.
function TripOverview({content}) {
  const normalized = normalizeSavedTripMarkdown(content);
  const match = normalized.match(/(?:^|\n)\s*(?:\*\*)?Trip:\s*(.*)/i);
  if (!match) return <SavedTripMarkdown content={content}/>;
  const summary = match[1].replace(/\*\*/g, '').trim();
  const parts = summary.split(/\s*\|\s*/).map(part => part.trim()).filter(Boolean);
  const first = parts.shift() || '';
  const route = first.split(/\s*(?:→|->)\s*/);
  const remaining = normalized.replace(match[0], '').trim();
  return <>
    <div className="jgp-trip-overview" aria-label="Trip summary">
      <div className="jgp-trip-overview-route"><MapPin size={18}/><strong>{route.length === 2 ? `${route[0]} → ${route[1]}` : first}</strong></div>
      {parts.length > 0 && <div className="jgp-trip-overview-tags">{parts.map((part, index) => <span key={`${index}-${part}`}>{part.replace(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/i, (_, a, b) => `${formatOverviewDate(a)} – ${formatOverviewDate(b)}`)}</span>)}</div>}
    </div>
    {remaining && <SavedTripMarkdown content={remaining}/>}
  </>;
}
const formatOverviewDate = value => {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

function SavedTripMarkdown({ content }) {
  return <div className="trip-details-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      a: ({ href, children, ...props }) => <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>,
      table: ({ children }) => <div className="trip-details-table-scroll"><table>{children}</table></div>,
      p: ({ children }) => <p>{children}</p>
    }}>
      {normalizeSavedTripMarkdown(content).replace(/<br\s*\/?>/gi, ' • ')}
    </ReactMarkdown>
  </div>;
}


// Progress indicators are driven exclusively by backend SSE agent events.
function AgentWorkflow({progress}) {
  const agents = ['supervisor', ...[...new Set(progress.selected || [])].filter(agent => agent !== 'supervisor')];
  const completed = agents.filter(agent => progress.completed.includes(agent)).length;
  const labels = {
    supervisor: ['Supervisor Agent', 'Checking preferences'], flight_agent: ['Flight Agent', 'Researching flights'],
    train_agent: ['Train Agent', 'Researching trains'], bus_agent: ['Bus Agent', 'Checking bus routes'],
    road_agent: ['Road Agent', 'Preparing directions'], hotel_agent: ['Hotel Agent', 'Checking hotels'],
    weather_agent: ['Weather Agent', 'Analyzing weather'], budget_agent: ['Budget Agent', 'Calculating budget'],
    itinerary_agent: ['Itinerary Agent', 'Planning itinerary']
  };
  const icons = {
    supervisor: <SlidersHorizontal size={23}/>, flight_agent: <Plane size={23}/>,
    train_agent: <TrainFront size={23}/>, bus_agent: <Bus size={23}/>,
    road_agent: <CarFront size={23}/>, hotel_agent: <Hotel size={23}/>,
    weather_agent: <CloudSun size={23}/>, budget_agent: <Calculator size={23}/>,
    itinerary_agent: <MapPinned size={23}/>
  };
  return <div className="jgp-agent-workflow" role="status" aria-live="polite">
    <div className="jgp-agent-workflow-top">
      <h3>AI Agent Workflow</h3>
      <span className="jgp-agent-workflow-badge"><span className="jgp-agent-workflow-dot"/>Generating Trip</span>
    </div>
    <div className="jgp-agent-workflow-track" style={{'--agent-count': agents.length}}>
      {agents.map((agent, index) => {
        const done = progress.completed.includes(agent);
        const active = progress.active === agent && !done;
        const name = labels[agent] || ['Processing', AGENT_NAMES[agent] || agent];
        return <div className="jgp-agent-workflow-step" key={agent}>
          <div className={`jgp-agent-workflow-node ${done ? 'is-done' : active ? 'is-active' : ''}`}>
            {done ? <Check size={24}/> : active ? icons[agent] || <Activity size={23}/> : index + 1}
          </div>
          <div className="jgp-agent-workflow-step-title">{name[0]}</div>
          <div className="jgp-agent-workflow-step-sub">{name[1]}</div>
          <div className="jgp-agent-workflow-step-status">{done ? 'Completed' : active ? 'Working...' : 'Waiting'}</div>
        </div>;
      })}
    </div>
    <div className="jgp-agent-workflow-footer">
      <Activity size={17}/>
      <span>{progress.phase || 'Preparing your trip...'}</span>
      <span className="jgp-agent-workflow-count">{completed} of {agents.length} completed</span>
    </div>
  </div>;
}

const AGENT_WORKFLOW_CSS = `
.jgp-agent-workflow{width:100%;padding:27px 26px 22px;border-radius:20px;background:#1c294e;border:1px solid #34446c;color:#fff;text-align:left;box-sizing:border-box}
.jgp-agent-workflow-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:30px}
.jgp-agent-workflow-top h3{margin:0;color:#fff;font-size:22px;font-weight:800}
.jgp-agent-workflow-badge{display:inline-flex;align-items:center;gap:9px;border-radius:24px;padding:10px 14px;background:#15394d;color:#a3f5d7;font-weight:700;font-size:12px;white-space:nowrap}
.jgp-agent-workflow-dot{width:10px;height:10px;border-radius:50%;background:#4ee0a7;box-shadow:0 0 10px #4ee0a755}
.jgp-agent-workflow-track{display:grid;grid-template-columns:repeat(var(--agent-count),minmax(0,1fr));position:relative;gap:0}
.jgp-agent-workflow-track:before{content:'';position:absolute;top:23px;left:calc(50% / var(--agent-count));right:calc(50% / var(--agent-count));height:3px;background:#52648c;z-index:0}
.jgp-agent-workflow-step{display:flex;align-items:center;flex-direction:column;gap:5px;min-width:0;text-align:center;position:relative;z-index:1}
.jgp-agent-workflow-node{width:47px;height:47px;border:3px solid #8198c9;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:#25355e;color:#e1eaff;font-size:16px;font-weight:800;margin-bottom:4px}
.jgp-agent-workflow-node.is-active{background:#329ce4;border-color:#71c9ff;box-shadow:0 0 0 5px #3aa6f026,0 0 23px #3aa6f066;color:#fff;animation:jgp-agent-glow 1.7s ease-in-out infinite}
.jgp-agent-workflow-node.is-done{background:#185b67;border-color:#41d4b3;color:#7bf2ce}
.jgp-agent-workflow-step-title{font-size:14px;line-height:1.35;color:#f5f7ff;font-weight:600;overflow-wrap:anywhere}
.jgp-agent-workflow-step-sub{font-size:13px;line-height:1.35;color:#b7c6e7;overflow-wrap:anywhere}
.jgp-agent-workflow-step-status{font-size:11px;line-height:1.3;color:#a4b8dc;margin-top:2px}
.jgp-agent-workflow-footer{display:flex;align-items:center;justify-content:center;gap:9px;color:#adbfdf;font-size:12px;margin-top:25px;flex-wrap:wrap;text-align:center}
.jgp-agent-workflow-count{margin-left:auto;color:#9debd3;white-space:nowrap}
@keyframes jgp-agent-glow{50%{box-shadow:0 0 0 8px #3aa6f017,0 0 28px #3aa6f088}}
@media(max-width:750px){.jgp-agent-workflow{padding:20px 14px}.jgp-agent-workflow-top h3{font-size:18px}.jgp-agent-workflow-badge{padding:8px;font-size:11px}.jgp-agent-workflow-track{display:flex;overflow-x:auto;gap:0;padding-bottom:8px}.jgp-agent-workflow-track:before{display:none}.jgp-agent-workflow-step{flex:0 0 105px}.jgp-agent-workflow-step:not(:last-child):after{content:'';position:absolute;top:22px;left:calc(50% + 24px);width:57px;height:3px;background:#52648c;z-index:-1}.jgp-agent-workflow-count{margin-left:0;width:100%}}
`;

export default function Planner() {



  const location = useLocation();



  const navigate = useNavigate();



  const [form, setForm] = useState(() => initialValues(location.state));




  const [itinerary, setItinerary] = useState('');
  const [tripSnapshot, setTripSnapshot] = useState(null);
  const [agentResearch, setAgentResearch] = useState({});
  const [structuredResearch, setStructuredResearch] = useState({});
  const [illustrativeBudget, setIllustrativeBudget] = useState(null);



  const [activeTripId, setActiveTripId] = useState(null);



  const [loading, setLoading] = useState(false);
  const [agentProgress, setAgentProgress] = useState({selected: [], active: '', completed: [], phase: 'Preparing your trip'});
  // Synchronous guard: React state alone does not prevent rapid duplicate submissions.
  const generationInFlight = useRef(false);
  // Each request owns a controller so Reset and page navigation can cancel it.
  const generationController = useRef(null);
  // Invalidate any pending one-day response when the trip resets, changes, or unmounts.
  // This protects the UI even if the underlying API call cannot be aborted.
  const dayRegenerationToken = useRef(0);

  useEffect(() => () => {
    generationController.current?.abort();
    generationController.current = null;
    generationInFlight.current = false;
    dayRegenerationToken.current += 1;
  }, []);



  const [saving, setSaving] = useState(false);



  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);



  const [notice, setNotice] = useState('');



  const [advanced, setAdvanced] = useState(false);






  const [expandedDay, setExpandedDay] = useState(0);



  const [liked, setLiked] = useState(false);




  const [showFullItinerary, setShowFullItinerary] = useState(false);

  const [customTheme, setCustomTheme] = useState('');

  const [showCustomTheme, setShowCustomTheme] = useState(false);

  const [mobileNav, setMobileNav] = useState(false);

  const [placeSuggestions, setPlaceSuggestions] = useState({source: [], destination: []});

  const [focusedPlace, setFocusedPlace] = useState(null);

  const [dateOpen, setDateOpen] = useState(false);
  const [dayInstructions, setDayInstructions] = useState('');
  const [regeneratingDay, setRegeneratingDay] = useState(false);
  const [dayPreview, setDayPreview] = useState(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetValues, setBudgetValues] = useState({transport:'', hotel:'', food:'', activities:'', miscellaneous:''});
  const [budgetEdited, setBudgetEdited] = useState(false);



  // Apply a destination selected on Home without generating a trip.*

  // React Router can reuse this mounted page when navigating to another destination.*

  useEffect(() => {

    if (location.state?.tripId) return; // Saved-trip loading has priority.*



    const fromState = typeof location.state?.destination === 'string'

      ? location.state.destination.trim()

      : '';

    const fromQuery = new URLSearchParams(location.search).get('destination')?.trim() || '';

    const selectedDestination = fromState || fromQuery;

    if (!selectedDestination) return;



    setForm((previous) => ({ ...previous, destination: selectedDestination }));

    setError('');

  }, [location.state, location.search]);



  useEffect(() => {



    if (!location.state?.tripId) return;



    let alive = true;



    getTrip(location.state.tripId).then((trip) => {



      if (!alive) return;



      setForm(initialValues(trip.formData || {}));



      setItinerary(trip.itinerary || '');
      setTripSnapshot(trip.itinerary ? snapshotTripForm(trip.formData || {}) : null);
      setAgentResearch(normalizeAgentResearch(trip.formData?.agentResults));
      setStructuredResearch(normalizeStructuredResearch(trip.formData?.agentResearch));
      setIllustrativeBudget(normalizeIllustrativeBudget(trip.formData?.budgetEstimate));



      setActiveTripId(trip.id);



      setNotice('Saved trip loaded. You can update its preferences and regenerate the itinerary.');



    }).catch((err) => { if (alive) setError(err.message || 'Could not open saved trip.'); });



    return () => { alive = false; };



  }, [location.state?.tripId]);



  // Render the trip exactly as it was generated, not according to any
  // unsaved changes currently being made in the form above it.
  const displayedTrip = itinerary && tripSnapshot ? tripSnapshot : form;
  const duration = tripDays(displayedTrip.startDate, displayedTrip.endDate);
  // Never hide itinerary days due to inconsistent old saved-trip date metadata.
  const days = useMemo(() => parseDays(itinerary), [itinerary]);
  const travelerCount = Number(displayedTrip.adults || 0) + Number(displayedTrip.children || 0);
  const tripFormChanged = Boolean(itinerary && tripSnapshot && tripFormSignature(form) !== tripFormSignature(tripSnapshot));
  const dateDayMismatch = Boolean(itinerary && duration && days.length !== duration);
  const nights = Math.max(0, (duration || 1) - 1);
  const costNumber = value => value === '' || value === null ? 0 : Math.max(0, Number(value) || 0);
  const budgetTotal = costNumber(budgetValues.transport) + costNumber(budgetValues.hotel) * nights + costNumber(budgetValues.food) * (duration || 1) * travelerCount + costNumber(budgetValues.activities) * travelerCount + costNumber(budgetValues.miscellaneous);
  const enteredBudgetCount = Object.values(budgetValues).filter(value => value !== '').length;
  const hasBudget = enteredBudgetCount > 0;
  const budgetComplete = enteredBudgetCount === Object.keys(budgetValues).length;
  const changeBudget = (key, value) => {
    setBudgetEdited(true);
    setBudgetValues(old => ({...old, [key]: value === '' ? '' : String(Math.max(0, Number(value) || 0))}));
  };
  const guide = useMemo(() => guideSummary(itinerary, days), [itinerary, days]);
  const [guideOpen, setGuideOpen] = useState({});
  useEffect(() => { setDayPreview(null); setDayInstructions(''); }, [expandedDay]);

  const regenerateSelectedDay = async () => {
    const selected = days[expandedDay];
    if (!selected || regeneratingDay || generationInFlight.current) return;
    const requestToken = ++dayRegenerationToken.current;

    setRegeneratingDay(true);
    setError('');
    setNotice('');
    setDayPreview(null);

    try {
      // Send the FastAPI model fields directly. This does not rely on the
      // version or calling convention of ../services/aiService.js.
      // A 422 response may still mean the model returned an invalid day;
      // surface the backend's precise error instead of hiding that distinction.
      const source = String(displayedTrip.source || '').trim();
      const destination = String(displayedTrip.destination || '').trim();
      const startDate = String(displayedTrip.startDate || '').trim();
      const endDate = String(displayedTrip.endDate || '').trim();
      const requestedDay = Number(selected.day);
      if (!source || !destination || !startDate || !endDate) {
        throw new Error('Origin, destination, start date and end date are required to regenerate a day.');
      }
      if (!Number.isInteger(requestedDay) || requestedDay < 1 || !tripDays(startDate, endDate) || requestedDay > tripDays(startDate, endDate)) {
        throw new Error('The selected day does not match the trip date range. Review the dates and try again.');
      }
      const total = Number(displayedTrip.adults || 0) + Number(displayedTrip.children || 0);
      const payload = {
        day_number: requestedDay,
        feedback: `${dayInstructions.trim() || 'Suggest a different, practical plan for this day.'}\nWrite the entire day in English only.`.slice(0, 1500),
        formData: {...snapshotTripForm(displayedTrip), source, destination, startDate, endDate, travelers: total},
        existing_itinerary: String(itinerary || '').slice(0, 100000)
      };
      const response = await API.post('/generate-trip/regenerate-day', payload);
      const result = response.data;
      if (requestToken !== dayRegenerationToken.current || generationInFlight.current) return;

      const raw = String(result?.day_itinerary || result?.itinerary || result?.draft_itinerary || '').trim();
      if (!raw) throw new Error('The AI returned no itinerary for this day.');

      const sections = parseDays(raw);
      // A single-day endpoint must not silently substitute a full-trip response.
      if (sections.length !== 1 || sections[0].day !== selected.day) {
        throw new Error(`The AI did not return only Day ${selected.day}. Your original itinerary is unchanged.`);
      }
      const matching = sections[0];
      const activities = parseActivityCards(matching.body);
      if (!activities.length) {
        throw new Error(`Day ${selected.day} has no usable activities. Your original itinerary is unchanged.`);
      }

      setDayPreview({
        day: selected.day,
        markdown: `## ${matching.title}\n${matching.body.trim()}`,
        activities
      });
      setNotice(`Alternative for Day ${selected.day} is ready. Review it before accepting.`);
    } catch (err) {
      if (requestToken === dayRegenerationToken.current) {
        // FastAPI uses 422 for both request validation and day-content
        // validation. Show the exact server reason, including Pydantic fields.
        const detail = err?.response?.data?.detail;
        const explanation = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(item =>
              `${Array.isArray(item?.loc) ? item.loc.join('.') : 'Request'}: ${item?.msg || 'Invalid value'}`).join('; ')
          : err?.message || 'Unable to regenerate this day.';
        setError(explanation);
      }
    } finally {
      if (requestToken === dayRegenerationToken.current) {
        setRegeneratingDay(false);
      }
    }
  };

  const acceptDayPreview = () => {
    if (!dayPreview) return;
    const updated = replaceOneDay(itinerary, dayPreview.day, dayPreview.markdown);
    if (!updated) { setError('Could not find this day in the original itinerary.'); return; }
    setItinerary(updated); setLiked(false); setDayPreview(null); setDayInstructions('');
    setNotice(`Day ${days[expandedDay]?.day} updated. Save or Update Trip to persist this change.`);
  };

  // Cached, short-debounce autocomplete using Photon (public service speed may vary).
  const suggestionsCache = useMemo(() => new Map(), []);

  // Queries begin after two characters to avoid excessive public-service traffic.*

  useEffect(() => {

    if (!focusedPlace) return;

    const query = String(form[focusedPlace] || '').trim();

    if (query.length < 2) {

      setPlaceSuggestions(old => ({...old, [focusedPlace]: []}));

      return;

    }

    const cached = suggestionsCache.get(query.toLowerCase());
    if (cached) { setPlaceSuggestions(old => ({...old,[focusedPlace]:cached})); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {

      try {

        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`, {signal: controller.signal});

        if (!response.ok) return;

        const result = await response.json();

        const unique = new Set();

        const places = (result.features || []).map(({properties: item}) => {

          const name = item.name || item.city || item.state || item.country;

          const location = [name, item.city !== name ? item.city : null, item.state !== name ? item.state : null, item.country !== name ? item.country : null].filter(Boolean);

          return {label: [...new Set(location)].join(', '), value: name || ''};

        }).filter(item => item.value && !unique.has(item.label) && unique.add(item.label));

        suggestionsCache.set(query.toLowerCase(), places);
        setPlaceSuggestions(old => ({...old, [focusedPlace]: places}));

      } catch (error) { if (error.name !== 'AbortError') setPlaceSuggestions(old => ({...old, [focusedPlace]: []})); }

    }, 220);

    return () => {clearTimeout(timer); controller.abort();};

  }, [focusedPlace, form.source, form.destination, suggestionsCache]);



  const placeInput = (field, label, placeholder, Icon) => (

    <div className="jgp-place-field">

      <label htmlFor={`jgp-${field}`}><span><Icon size={18}/>{label}</span></label>

      <input id={`jgp-${field}`} autoComplete="off" role="combobox" aria-autocomplete="list"

        aria-expanded={focusedPlace===field && placeSuggestions[field].length>0}

        value={form[field]} placeholder={placeholder}

        onFocus={() => setFocusedPlace(field)}

        onBlur={() => setTimeout(() => setFocusedPlace(old => old===field ? null : old), 150)}

        onChange={e => {update(field,e.target.value);setFocusedPlace(field);}} />

      {focusedPlace===field && placeSuggestions[field].length>0 && (

        <div className="jgp-place-suggestions" role="listbox" aria-label={`${label} suggestions`}>

          {placeSuggestions[field].map(place => <button key={place.label} type="button" role="option" aria-selected={false}

            onMouseDown={e => e.preventDefault()} onClick={() => {update(field,place.label);setFocusedPlace(null);setPlaceSuggestions(old => ({...old,[field]:[]}));}}>

            <MapPin size={15}/>{place.label}

          </button>)}

          <small>Place data © OpenStreetMap contributors</small>

        </div>

      )}

    </div>

  );



  const toggleMulti = (field, value) => setForm(old => ({

    ...old,

    [field]: (Array.isArray(old[field]) ? old[field] : []).includes(value)

      ? old[field].filter(item => item !== value)

      : [...(Array.isArray(old[field]) ? old[field] : []), value]

  }));

  const resetForm = () => {
    // Invalidate older one-day previews as well as the active full-trip stream.
    dayRegenerationToken.current += 1;
    setRegeneratingDay(false);
    // Cancel the HTTP stream before clearing the UI; late events from the
    // previous request are ignored even if they were already buffered.
    const currentController = generationController.current;
    generationController.current = null;
    generationInFlight.current = false;
    currentController?.abort();
    setLoading(false);
    setAgentProgress({selected: [], active: '', completed: [], phase: 'Preparing your trip'});

    setForm(initialValues()); setItinerary(''); setTripSnapshot(null); setActiveTripId(null); setAgentResearch({});
    setStructuredResearch({}); setIllustrativeBudget(null);

    setError(''); setValidationError(''); setNotice(''); setLiked(false); setExpandedDay(0);

    setBudgetOpen(false); setBudgetEdited(false); setBudgetValues({transport:'',hotel:'',food:'',activities:'',miscellaneous:''}); setCustomTheme(''); setShowFullItinerary(false); setDayPreview(null); setDayInstructions('');

  };



  const update = (field, value) => {



    setForm((old) => ({ ...old, [field]: value }));
    setValidationError('');
    setError('');



  };



  const toggleInterest = (interest) => setForm((old) => ({



    ...old, interests: old.interests.includes(interest)



      ? old.interests.filter((x) => x !== interest) : [...old.interests, interest]



  }));



  const validate = () => {



    if (!form.destination.trim()) return 'Please enter your destination.';



    if (!form.source.trim()) return 'Please enter your starting city.';



    if (form.source.trim().toLowerCase() === form.destination.trim().toLowerCase()) return 'Starting city and destination must be different.';



    if (!form.startDate || !form.endDate) return 'Please select departure and return dates.';



    if (form.endDate < form.startDate) return 'Return date must be on or after departure.';



    if (form.adults === '' && form.children === '') return 'Enter the number of adults or children.';
    if (!Number.isInteger(Number(form.adults || 0)) || !Number.isInteger(Number(form.children || 0)) || Number(form.adults) < 0 || Number(form.children) < 0 || Number(form.adults || 0) + Number(form.children || 0) < 1) return 'Please select at least one adult or child traveler.';



    return '';



  };



  const submit = async (event) => {
    event.preventDefault();
    if (generationInFlight.current) return;

    const problem = validate();
    if (problem) { setValidationError(problem); return; }

    const expectedDays = tripDays(form.startDate, form.endDate);
    if (!expectedDays || expectedDays < 1) {
      setValidationError('Please select a valid departure and return date.');
      return;
    }

    generationInFlight.current = true;
    // A new complete trip must not inherit a pending alternative-day preview.
    dayRegenerationToken.current += 1;
    setRegeneratingDay(false);
    setDayPreview(null);
    const controller = new AbortController();
    generationController.current = controller;
    setError('');
    setValidationError('');
    setNotice('');
    setLoading(true);
    setAgentProgress({selected: plannedAgentsFromForm(form), active: 'supervisor', completed: [], phase: 'Validating trip preferences'});
    setLiked(false);
    setShowFullItinerary(false);

    try {
      const total = Number(form.adults || 0) + Number(form.children || 0);
      const request = {
        ...form,
        travelers: String(total),
        adults: Number(form.adults || 0),
        children: Number(form.children || 0),
        source: form.source.trim(),
        destination: form.destination.trim(),
        specialRequirements: form.specialRequirements.trim(),
        itineraryLanguage: 'en'
      };

      // Exactly one request: /generate-trip invokes the ENTIRE LangGraph workflow.
      // Retrying individual days here would rerun all selected research agents.
      const result = await readTripProgress(request, (eventName, data) => {
        if (controller.signal.aborted || generationController.current !== controller) return;
        setAgentProgress(previous => {
          if (eventName === 'workflow_started' || eventName === 'agents_selected') {
            const backendSelection = Array.isArray(data.selected_agents) ? data.selected_agents : null;
            const selected = backendSelection ? [...new Set(backendSelection.filter(agent => agent !== 'supervisor'))] : previous.selected;
            return {...previous, selected, phase: 'Preparing selected agents'};
          }
          if (eventName === 'agent_started') {
            if (!data.agent) return previous;
            const selected = data.agent === 'supervisor' || previous.selected.includes(data.agent)
              ? previous.selected : [...previous.selected, data.agent];
            return {...previous, selected, active: data.agent,
              phase: `${AGENT_NAMES[data.agent] || data.agent} is working...`};
          }
          if (eventName === 'agent_completed') {
            if (!data.agent) return previous;
            return {...previous, active: previous.active === data.agent ? '' : previous.active,
              completed: [...new Set([...previous.completed, data.agent])],
              phase: `${AGENT_NAMES[data.agent] || data.agent} completed`};
          }
          if (eventName === 'workflow_phase') {
            return {...previous, phase: data.phase === 'human_approval' ? 'Finalizing itinerary' : 'Preparing your result'};
          }
          return previous;
        });
      }, controller.signal);
      if (controller.signal.aborted || generationController.current !== controller) return;
      if (result?.status === 'failed') {
        throw new Error(result?.itinerary_error || 'The backend could not generate a complete trip.');
      }
      const generatedItinerary = String(result?.itinerary || result?.draft_itinerary || '').trim();
      if (!generatedItinerary) {
        throw new Error('The AI returned no itinerary. Check the backend logs and try again later.');
      }

      // Check that every day exists and has substantive content. Do not confuse
      // the absence of a clock-formatted activity with a missing day: brief
      // arrival/departure days may use plain bullets or short paragraphs.
      const daySections = parseDays(generatedItinerary);
      const invalidDays = daySections.filter(day => !Number.isInteger(day.day) ||
        day.day < 1 || day.day > expectedDays);
      if (invalidDays.length) {
        throw new Error(`The backend returned an extra or invalid Day ${invalidDays.map(d => d.day).join(', ')} ` +
          `for a ${expectedDays}-day trip. No incorrect itinerary was saved.`);
      }
      const foundDays = new Set(daySections
        .filter(day => day.day >= 1 && day.day <= expectedDays &&
          String(day.body || '').replace(/\s+/g, ' ').trim().length > 0)
        .map(day => day.day));
      const missingDays = Array.from({length: expectedDays}, (_, index) => index + 1)
        .filter(day => !foundDays.has(day));

      if (missingDays.length) {
        throw new Error(
          `The AI returned an incomplete ${expectedDays}-day itinerary (missing or empty Day ${missingDays.join(', ')}). ` +
          'No additional agent runs were started. Check the backend itinerary output.'
        );
      }

      setItinerary(generatedItinerary);
      setTripSnapshot(snapshotTripForm(request));
      setAgentResearch(normalizeAgentResearch(result?.agent_results));
      setStructuredResearch(normalizeStructuredResearch(result?.agent_research));
      setIllustrativeBudget(normalizeIllustrativeBudget(result?.budget_estimate));
      setExpandedDay(0);
      setBudgetEdited(false);
      setBudgetValues({transport:'', hotel:'', food:'', activities:'', miscellaneous:''});
      setNotice(`Your ${expectedDays}-day AI itinerary is ready. Review it before saving.`);
    } catch (err) {
      if (controller.signal.aborted || generationController.current !== controller) return;
      setNotice('');
      setError(err.message || 'Trip generation failed.');
    } finally {
      // A cancelled older request must never clear a newer request's spinner.
      if (generationController.current === controller) {
        generationController.current = null;
        generationInFlight.current = false;
        setLoading(false);
      }
    }
  };

  const save = async () => {
    if (!itinerary || saving || loading || regeneratingDay || generationInFlight.current) return;
    setSaving(true);
    setError('');
    try {
      // Use the frozen input from the last successful generation, never the
      // live form which may describe another destination/date/group size.
      const savedForm = snapshotTripForm(tripSnapshot || form);
      const expectedDays = tripDays(savedForm.startDate, savedForm.endDate);
      if (!savedForm.source || !savedForm.destination || !expectedDays || savedForm.travelers < 1) {
        throw new Error('This itinerary has incomplete trip details. Regenerate it with valid dates and traveler counts before saving.');
      }
      const sections = parseDays(itinerary);
      const present = new Set(sections.filter(section => String(section.body || '').trim()).map(section => section.day));
      const missing = Array.from({length: expectedDays}, (_, i) => i + 1).filter(day => !present.has(day));
      const extra = sections.filter(section => section.day > expectedDays || section.day < 1);
      if (missing.length || extra.length) {
        throw new Error(`The itinerary does not match the ${expectedDays}-day date range. ` +
          `${missing.length ? `Missing Day ${missing.join(', ')}. ` : ''}` +
          `${extra.length ? `Unexpected Day ${extra.map(section => section.day).join(', ')}. ` : ''}` +
          'Please correct the trip dates and regenerate before saving.');
      }

      const data = {
        title: `${savedForm.source} to ${savedForm.destination}`,
        formData: {
          ...savedForm,
          agentResults: agentResearch,
          agentResearch: structuredResearch,
          budgetEstimate: illustrativeBudget
        },
        // Store the exact original Markdown, not re-parsed cards or a summary.
        itinerary,
        savedAt: new Date().toISOString()
      };
      const result = activeTripId ? await updateTrip(activeTripId, data) : await saveTrip(data);
      if (!result?.id) throw new Error('The server did not return a saved trip ID. Please check your saved trips.');
      // Current FastAPI endpoint returns the stored trip. Validate the round
      // trip instead of showing a success message for altered/missing data.
      if (result.itinerary !== itinerary ||
          tripFormSignature(result.formData || {}) !== tripFormSignature(savedForm)) {
        throw new Error('The saved trip returned by the server differs from the generated plan. Verify it before continuing.');
      }
      setActiveTripId(result.id);
      setTripSnapshot(savedForm);
      setLiked(true);
      setNotice(activeTripId ? 'Saved trip updated with the exact itinerary and original trip details.' :
        'Trip saved with the exact itinerary and original trip details.');
    } catch (err) {
      setError(err.message || 'Could not save trip.');
    } finally {
      setSaving(false);
    }
  };


  const shareText = () => `Journey Gen AI — Trip to ${displayedTrip.destination}\n\n${itinerary}`;
  const share = () => { if (itinerary) setShareOpen(true); };
  const shareVia = async (channel) => {
    const text = shareText();
    const encoded = encodeURIComponent(text);
    const subject = encodeURIComponent(`My trip to ${displayedTrip.destination}`);
    try {
      if (channel === 'whatsapp') window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank', 'noopener,noreferrer');
      if (channel === 'telegram') window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encoded}`, '_blank', 'noopener,noreferrer');
      if (channel === 'email') window.location.href = `mailto:?subject=${subject}&body=${encoded}`;
      if (channel === 'copy') { await navigator.clipboard.writeText(text); setNotice('Itinerary copied to clipboard.'); }
      if (channel === 'system') {
        if (navigator.share) await navigator.share({title: `Trip to ${displayedTrip.destination}`, text});
        else { await navigator.clipboard.writeText(text); setNotice('Itinerary copied to clipboard.'); }
      }
      setShareOpen(false);
    } catch (err) { if (err.name !== 'AbortError') setError('Unable to share itinerary.'); }
  };

  const print = () => window.print();



  const handleNav = (path) => navigate(path);



  const goMap = () => window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(displayedTrip.destination)}`, '_blank', 'noopener,noreferrer');



  const themes = [

    ['Historical Sites & Landmarks', Building2], ['Adventure', Mountain],

    ['Local Culture', Globe2], ['Beaches', Palmtree],

    ['Hills, Nature & Wildlife', Mountain], ['Nightlife', Sparkles],

    ['For the Gram', Camera], ['Shopping & Relaxation', ShoppingBasket]

  ];

  const paces = [['Slow and Easy', CarFront], ['Balanced', Gauge], ['Fast', Rocket]];

  const weathers = [['Warm and Sunny', Sun], ['Cool and Breezy', Wind],

    ['Cold and Snowy', Snowflake], ['Mild and Pleasant', CloudSun], ['Rainy and Cozy', CloudRain]];

  const stays = [['3 Star', Star], ['4 Star', Star], ['5 Star', Star],

    ['Airbnb', House], ['Homestay', HeartHandshake], ['Hostel', Building2]];

  const foods = [['Vegetarian', Leaf], ['Vegan', Vegan], ['Gluten Free', WheatOff],

    ['Halal', MoonStar], ['Kosher', Scale], ['Local Cuisine', MapPin]];

  const transports = [['Flights', Plane], ['Trains', TrainFront], ['Buses', Bus], ['Road', Navigation]];

  const chip = (label, Icon, selected, onClick) => (

    <button key={label} type="button" aria-pressed={selected}

      className={`jgp-choice ${selected ? 'selected' : ''}`} onClick={onClick}>

      <Icon size={16}/>{label}

    </button>

  );  return (
    <div className="jgp-app jgp-reference-layout">
      <style>{`.jgp-place-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}.jgp-photo-shade{position:absolute;inset:0;z-index:1}.jgp-ref-photo-info{position:relative;z-index:2}.jgp-activity-photo{width:116px;height:90px;object-fit:cover;border-radius:10px;background:#111c40;border:1px solid #4c5585;flex-shrink:0}.jgp-day-regenerate button:disabled{opacity:.6;cursor:wait}.jgp-overview-top{display:grid!important;grid-template-columns:minmax(210px,32%) 1fr!important;gap:22px!important;align-items:stretch}.jgp-overview-cover{min-height:215px!important;overflow:hidden;border-radius:15px}.jgp-ref-photo-info{padding:14px!important}.jgp-ref-photo-info strong{font-size:18px!important;overflow-wrap:anywhere}.jgp-overview-details{display:flex;flex-direction:column;justify-content:center;gap:7px}.jgp-overview-details p{margin:0;line-height:1.6}.jgp-activity-photo{width:132px!important;height:100px!important}.jgp-day-cost{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border:1px solid #bda2fb;border-radius:20px;color:#7436bd;font-size:13px;font-weight:700}.jgp-activity-cost{display:inline-block;margin:5px 0;color:#7037b6;font-size:12px;font-weight:700}.jgp-guide-compact{padding:16px 20px}.jgp-guide-compact details{border-bottom:1px solid #dce0ef;padding:14px 0}.jgp-guide-compact summary{font-weight:700;cursor:pointer;color:#1a2850}.jgp-guide-compact ul{margin:12px 0 4px;padding-left:22px}.jgp-guide-compact li{line-height:1.6;margin-bottom:7px;overflow-wrap:anywhere}.jgp-guide-compact .jgp-guide-note{font-size:13px;color:#65718c}.jgp-day-activity p{line-height:1.6!important}.jgp-ref-extras{padding:16px 18px!important;margin-top:16px!important}.jgp-ref-extra-grid{gap:12px!important}.jgp-ref-extras textarea{min-height:70px!important}.jgp-chronological-group .jgp-activity-row{display:block!important}.jgp-chronological-group .jgp-activity-content{min-width:0;width:100%}.jgp-chronological-group .jgp-hybrid-activity-copy>strong{display:inline-flex;align-items:center;gap:7px}.jgp-chronological-group .jgp-activity-cost{display:block}.jgp-chronological-group .jgp-hybrid-timeline{display:flex;flex-direction:column}.jgp-budget-grid input{font-variant-numeric:tabular-nums}@media(max-width:650px){.jgp-overview-top{grid-template-columns:1fr!important}.jgp-overview-cover{min-height:200px!important}.jgp-activity-photo{width:95px!important;height:78px!important}}@media(max-width:650px){.jgp-activity-photo{width:90px;height:75px}}`}</style>

      <style>{`
        .jgp-saved-trip-format .jgp-compact-day-heading{color:var(--jgp-text,#fff);font-size:19px;line-height:1.4;font-weight:750;margin:14px 0 5px;overflow-wrap:anywhere}
        .jgp-saved-trip-format .jgp-day-route-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:9px 0 12px}
        .jgp-saved-trip-format .jgp-day-route-actions>a{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:8px 13px;border:1px solid #b478ed;border-radius:10px;background:#553088;color:#fff!important;font-size:12px;font-weight:750;text-decoration:none}
        .jgp-saved-trip-format .jgp-day-route-actions>a:hover{background:#6940a5}
        .jgp-saved-trip-format .jgp-day-route-actions small{font-size:11px;line-height:1.45;color:var(--jgp-muted,#bbc4e4)}
        .jgp-saved-trip-format .jgp-place-map-actions{display:flex;flex-wrap:wrap;gap:8px 16px}
        :root[data-theme='light'] .jgp-saved-trip-format .jgp-day-route-actions>a{background:#6841a8;color:#fff!important}
        @media print{.jgp-saved-trip-format .jgp-day-route-actions{display:none!important}}
        .jgp-saved-trip-format .jgp-return-arrival-note{margin:8px 0 0;color:var(--jgp-muted,#bbc4e4);font-size:12px;line-height:1.5}
        .jgp-saved-trip-format .jgp-compact-activities{display:flex;flex-direction:column;gap:8px;padding:9px 0 4px;min-width:0}
        .jgp-saved-trip-format .jgp-compact-activity{display:grid!important;grid-template-columns:minmax(105px,145px) auto minmax(0,1fr);align-items:center!important;column-gap:12px;min-width:0;width:100%;padding:11px 14px;background:#202c574d;border:1px solid #44517f;border-radius:13px}
        .jgp-saved-trip-format .jgp-compact-activity.jgp-no-place-photo{grid-template-columns:minmax(105px,145px) minmax(0,1fr)}
        .jgp-saved-trip-format .jgp-compact-time{display:flex!important;align-items:center;gap:8px;min-width:0;width:auto!important;flex:auto!important;color:#d5b5ff;font-size:12px;font-weight:750;line-height:1.45;overflow-wrap:normal;word-break:normal}
        .jgp-saved-trip-format .jgp-compact-time svg{flex-shrink:0}
        .jgp-saved-trip-format .jgp-compact-time span{overflow-wrap:anywhere}
        .jgp-saved-trip-format .jgp-commons-photo.jgp-photo-unavailable{display:none!important}.jgp-saved-trip-format .jgp-commons-photo{display:flex;flex-direction:column;gap:4px;align-items:stretch;width:88px;min-width:0;max-width:88px}
        .jgp-saved-trip-format .jgp-commons-photo .jgp-compact-photo{width:88px!important;height:68px!important;max-width:104px;object-fit:cover}
        .jgp-saved-trip-format .jgp-commons-credit{color:#d3abff!important;font-size:9px!important;line-height:1.25!important;font-weight:500!important;text-decoration:underline;text-underline-offset:2px;white-space:normal;overflow-wrap:anywhere}
        .jgp-saved-trip-format .jgp-compact-photo{display:block;width:88px!important;height:68px!important;max-width:104px;object-fit:cover;border-radius:10px;border:1px solid #5a6795;background:#18234a}
        .jgp-saved-trip-format .jgp-compact-activity-main{display:flex;align-items:flex-start;gap:7px 12px;flex-direction:column;min-width:0}
        .jgp-saved-trip-format .jgp-activity-map-link{padding:5px 9px;border:1px solid #6b548d;border-radius:8px;background:rgba(137,90,211,.12);min-height:30px}
        .jgp-saved-trip-format .jgp-activity-map-link:hover{background:rgba(137,90,211,.23)}
        .jgp-saved-trip-format .jgp-compact-details{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:6px;min-width:0;width:100%;flex:1;color:var(--jgp-text,#fff)}
        .jgp-saved-trip-format .jgp-compact-details strong{display:block!important;width:100%;font-size:14px!important;line-height:1.5!important;color:var(--jgp-text,#fff)!important;letter-spacing:normal!important;text-transform:none!important;overflow-wrap:anywhere;word-break:normal}
        .jgp-saved-trip-format .jgp-compact-details .jgp-compact-cost{display:block;color:var(--jgp-muted,#bbc4e4);font-size:12px;line-height:1.4}
        .jgp-saved-trip-format .jgp-compact-details a{display:inline-flex!important;align-items:center;gap:5px;color:#dda7ff!important;font-size:12px!important;font-weight:700;text-decoration:none;max-width:100%;overflow-wrap:anywhere}
        .jgp-saved-trip-format .jgp-compact-details a:hover{text-decoration:underline}
        :root[data-theme='light'] .jgp-saved-trip-format .jgp-compact-activity{background:#f6f3ff;border-color:#d8c8ee}
        :root[data-theme='light'] .jgp-saved-trip-format .jgp-compact-time{color:#7540ac}
        :root[data-theme='light'] .jgp-saved-trip-format .jgp-compact-details a{color:#7038aa!important}
        @media(max-width:700px){.jgp-saved-trip-format .jgp-compact-activity{grid-template-columns:1fr auto!important;row-gap:9px;padding:12px}.jgp-saved-trip-format .jgp-compact-activity.jgp-no-place-photo{grid-template-columns:1fr!important}.jgp-saved-trip-format .jgp-compact-time{grid-column:1/-1}.jgp-saved-trip-format .jgp-compact-photo{width:82px!important;height:74px!important;grid-column:1;grid-row:2}.jgp-saved-trip-format .jgp-compact-details{grid-column:2;grid-row:2}.jgp-saved-trip-format .jgp-compact-activity.jgp-no-place-photo .jgp-compact-details{grid-column:1;grid-row:2}}
        .jgp-saved-trip-format .jgp-compact-activity{padding:10px 12px;column-gap:10px}
        .jgp-saved-trip-format .jgp-compact-activities{gap:6px}
        .jgp-saved-trip-format .jgp-commons-photo{width:72px;max-width:72px}
        .jgp-saved-trip-format .jgp-commons-photo .jgp-compact-photo,.jgp-saved-trip-format .jgp-compact-photo{width:72px!important;height:56px!important}
        .jgp-saved-trip-format .jgp-day-travel-tips{margin-top:12px;padding:12px 15px;border:1px solid var(--jgp-line);border-radius:12px;color:var(--jgp-text);background:var(--jgp-panel-hi)}
        .jgp-saved-trip-format .jgp-day-travel-tips strong{font-size:13px}
        .jgp-saved-trip-format .jgp-day-travel-tips ul{margin:7px 0 0;padding-left:18px;font-size:12px;line-height:1.6}
        @media(max-width:700px){.jgp-saved-trip-format .jgp-compact-activity.jgp-has-place-photo{grid-template-columns:72px minmax(0,1fr)!important}.jgp-saved-trip-format .jgp-compact-activity.jgp-has-place-photo .jgp-compact-time{grid-column:1/-1;grid-row:1}.jgp-saved-trip-format .jgp-compact-activity.jgp-has-place-photo .jgp-commons-photo{grid-column:1;grid-row:2}.jgp-saved-trip-format .jgp-compact-activity.jgp-has-place-photo .jgp-compact-details{grid-column:2;grid-row:2}}
        @media print{.jgp-saved-trip-format .jgp-compact-activity{background:white!important;color:black!important;border-color:#ddd!important;break-inside:avoid}.jgp-saved-trip-format .jgp-compact-details strong,.jgp-saved-trip-format .jgp-compact-time{color:black!important}}
      `}</style>
      <button className="jgp-mobile-menu" type="button" aria-label="Toggle menu" onClick={() => setMobileNav(!mobileNav)}>

        {mobileNav ? <X size={22}/> : <Menu size={22}/>}

      </button>

      {mobileNav && <button className="jgp-backdrop" type="button" aria-label="Close menu" onClick={() => setMobileNav(false)}/>}

      <aside className={`jgp-sidebar ${mobileNav ? 'jgp-sidebar-open' : ''}`}>

        <button className="jgp-brand jgp-ref-brand" type="button" onClick={() => handleNav('/')}>

          <img src="/journey-gen-ai-logo.png" alt="Journey Gen AI logo"/>

          <span><strong>Journey</strong><strong>Gen AI</strong></span>

        </button>

        <nav className="jgp-nav-group" aria-label="Main navigation">

          {[[Home,'Home','/'],[Network,'Plan Trip','/planner'],[Compass,'My Trips','/dashboard'],[UserRound,'Profile','/profile']].map(([Icon,label,path]) => (

            <button type="button" key={label} className={path === '/planner' ? 'active' : ''}

              onClick={() => {setMobileNav(false);handleNav(path);}}><Icon size={22}/>{label}</button>

          ))}

          <button type="button" onClick={() => { setMobileNav(false); handleNav("/help-and-support"); }}><CircleHelp size={22}/>Help &amp; Support</button>

        </nav>

      </aside>

      <main className="jgp-main jgp-ref-main">
        <style>{PLANNER_REFINEMENT_CSS}</style>
        <style>{`.jgp-snapshot-reminder{display:flex;align-items:flex-start;gap:9px;padding:11px 13px;margin-bottom:12px;border:1px solid #79669e;border-radius:12px;background:rgba(117,84,186,.14);color:var(--jgp-text,#f1eaff);font-size:13px;line-height:1.55}.jgp-snapshot-reminder svg{flex-shrink:0;margin-top:1px;color:#c69dff}:root[data-theme='light'] .jgp-snapshot-reminder{background:#f4efff;color:#283254;border-color:#cbb7f4}:root[data-theme='light'] .jgp-snapshot-reminder svg{color:#7946b8}`}</style>

        <header className="jgp-ref-heading">

          <Sparkles className="jgp-ref-sparkle" size={36}/>

          <div><h1>Plan Your Trip with AI</h1>

            <p>Tell us your travel preferences and let our AI create a personalized itinerary for you.</p></div>

          <div className="jgp-ref-scenery" aria-hidden="true"><Plane size={43}/><Mountain size={70}/></div>

        </header>

        {error && <div className="jgp-alert error" role="alert"><AlertCircle size={18}/>{error}</div>}

        {notice && <div className="jgp-alert success" role="status"><Check size={18}/>{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}

        <div className="jgp-columns">

          <section className="jgp-panel jgp-form-panel" id="jgp-trip-form">

            <form onSubmit={submit}>

              <h2><CalendarDays size={24}/>Trip Details</h2>

              <div className="jgp-ref-topfields">

                {placeInput('source', 'Where are you starting your trip from?', 'Enter your start city here...', MapPin)}

                {placeInput('destination', 'Search for your destination country/city', 'Search for places...', MapPinned)}

                <div className="jgp-ref-dategroup">

                  <span className="jgp-ref-label"><CalendarDays size={18}/>Select Dates</span>

                  <button type="button" className="jgp-date-range-button" aria-expanded={dateOpen} onClick={() => setDateOpen(!dateOpen)}>

                    <span style={{display:"inline-flex",alignItems:"center",gap:6,flex:1,minWidth:0}}><CalendarDays size={17} style={{flexShrink:0}}/><span>{rangeDate(form.startDate, form.endDate)}</span></span>

                    <ChevronDown size={16}/>

                  </button>

                  {dateOpen && <div className="jgp-date-popover">

                    <label>Departure date (DD/MM/YYYY)<input aria-label="Departure date" type="date" value={form.startDate}

                      onChange={e => {update('startDate',e.target.value);if(form.endDate && form.endDate<e.target.value) update('endDate','');}}/></label>

                    <label>Return date (DD/MM/YYYY)<input aria-label="Return date" type="date" min={form.startDate || undefined} value={form.endDate}

                      onChange={e => update('endDate',e.target.value)}/></label>

                    <button type="button" onClick={() => setDateOpen(false)}>Done</button>

                  </div>}

                </div>

              </div>

              <div className="jgp-ref-divider"/>

              <div className="jgp-ref-field"><div className="jgp-ref-label"><BriefcaseBusiness size={18}/>Which of these travel themes best describes your dream getaway? <span className="jgp-optional-label">(Optional)</span></div>

                <div className="jgp-ref-choices">{themes.map(([label,Icon]) => chip(label,Icon,form.interests.includes(label),()=>toggleInterest(label)))}

                  {form.interests.filter(x => !themes.some(([label]) => label === x)).map(x => chip(x,Check,true,()=>toggleInterest(x)))}

                  <button type="button" className="jgp-choice jgp-add-theme" onClick={() => setShowCustomTheme(!showCustomTheme)}><Plus size={16}/>Add theme</button>

                </div>

                {showCustomTheme && <div className="jgp-custom-theme"><input aria-label="Custom travel theme" placeholder="Enter custom theme" value={customTheme} onChange={e => setCustomTheme(e.target.value)} onKeyDown={e => {if(e.key==='Enter'){e.preventDefault();if(customTheme.trim()){if(!form.interests.includes(customTheme.trim()))toggleInterest(customTheme.trim());setCustomTheme('');setShowCustomTheme(false);}}}}/><button type="button" onClick={() => {if(customTheme.trim() && !form.interests.includes(customTheme.trim()))toggleInterest(customTheme.trim());setCustomTheme('');setShowCustomTheme(false);}}>Add</button></div>}

              </div>

              <div className="jgp-ref-divider"/>

              <div className="jgp-ref-pair">

                <div className="jgp-ref-field"><div className="jgp-ref-label"><Camera size={18}/>What pace of travel do you prefer? <span className="jgp-optional-label">(Optional)</span></div>

                  <div className="jgp-ref-choices">{paces.map(([label,Icon]) => chip(label,Icon,form.travelPace === label,()=>update('travelPace',form.travelPace === label ? '' : label)))}</div></div>

                <div className="jgp-ref-field"><div className="jgp-ref-label"><Sparkles size={18}/>What kind of weather do you prefer for your trip? <span className="jgp-optional-label">(Optional)</span></div>

                  <div className="jgp-ref-choices">{weathers.map(([label,Icon]) => chip(label,Icon,form.weatherPreference === label,()=>update('weatherPreference',form.weatherPreference === label ? '' : label)))}</div></div>

              </div>

              <div className="jgp-ref-divider"/>

              <div className="jgp-ref-pair">

                <div className="jgp-ref-field"><div className="jgp-ref-label"><BriefcaseBusiness size={18}/>What type of accommodation would you prefer? <span className="jgp-optional-label">(Optional)</span></div>

                  <div className="jgp-ref-choices">{stays.map(([label,Icon]) => chip(label,Icon,form.accommodation === label,()=>update('accommodation',form.accommodation === label ? '' : label)))}</div></div>

                <div className="jgp-ref-field"><div className="jgp-ref-label"><Utensils size={18}/>What type of food would you like to enjoy during your trip? <span className="jgp-optional-label">(Optional)</span></div>

                  <div className="jgp-ref-choices">{foods.map(([label,Icon]) => chip(label,Icon,form.foodPreferences.includes(label),()=>toggleMulti('foodPreferences',label)))}</div></div>

              </div>

              <div className="jgp-ref-divider"/>

              <div className="jgp-ref-bottomrow">

                <div className="jgp-ref-field"><div className="jgp-ref-label"><TicketsPlane size={18}/>How would you like to travel from departure to destination? <span className="jgp-optional-label">(Optional)</span></div>

                  <div className="jgp-ref-choices">{transports.map(([label,Icon]) => chip(label,Icon,form.transportation.includes(label),()=>toggleMulti('transportation',label)))}</div></div>



              </div>

              <section className="jgp-ref-extras" aria-label="Additional trip details"><h3 className="jgp-ref-extras-heading"><Users size={19}/>Additional Trip Details</h3>

                <div className="jgp-ref-extra-grid"><label>Adults<input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Adults" value={form.adults} onChange={e => { if (/^\d{0,2}$/.test(e.target.value)) update('adults',e.target.value); }}/></label>

                <label>Children<input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Children" value={form.children} onChange={e => { if (/^\d{0,2}$/.test(e.target.value)) update('children',e.target.value); }}/></label>

                <label>Budget per person<select value={form.budget} onChange={e => update('budget',e.target.value)}><option value="">Select budget (optional)</option><option value="Low">Budget friendly</option><option value="Medium">Mid-range</option><option value="High">Premium</option></select></label>

                <label>Trip type<select value={form.tripType} onChange={e => update('tripType',e.target.value)}><option value="">Select trip type</option>{TRIP_TYPES.map(x => <option key={x.label}>{x.label}</option>)}</select></label></div>

                <label>Special requirements<textarea maxLength={1000} value={form.specialRequirements} onChange={e => update('specialRequirements',e.target.value)} placeholder="Accessibility, dietary needs, celebrations, or other requests..."/></label>

              </section>

{validationError && <div className="jgp-inline-validation" role="alert"><AlertCircle size={18}/><span>{validationError}</span></div>}
<div className="jgp-ref-actions jgp-ref-actions-bottom"><button type="button" className="jgp-ref-reset" onClick={resetForm}><RefreshCw size={17}/>{loading ? 'Cancel & Reset' : 'Reset'}</button>

                  <button type="submit" className="jgp-generate" disabled={loading}>{loading ? <><LoaderCircle className="jgp-spin" size={19}/>Generating...</> : <><Sparkles size={19}/>{activeTripId ? 'Regenerate Trip' : 'Generate Trip'}</>}</button></div>

            </form>

          </section>

          <section className="jgp-panel jgp-results" id="jgp-itinerary">

            <div className="jgp-results-head"><div><h2><MapPinned size={27}/>Your Itinerary</h2><p>A personalized day-by-day travel plan for your trip.</p></div>

              <div className="jgp-result-actions"><button type="button" onClick={save} disabled={!itinerary || saving || loading || regeneratingDay}><Bookmark size={18}/>{saving ? 'Saving...' : activeTripId ? 'Update Trip' : 'Save Trip'}</button>

                <button type="button" onClick={print} disabled={!itinerary}><Download size={18}/>Download PDF</button>

                <button type="button" onClick={share} disabled={!itinerary}><Share2 size={18}/>Share</button></div>

            </div>

            {shareOpen && <div className="jgp-share-overlay" onClick={() => setShareOpen(false)} role="presentation">
              <div className="jgp-share-dialog" role="dialog" aria-modal="true" aria-labelledby="jgp-share-title" aria-describedby="jgp-share-description" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setShareOpen(false); }}>
                <div className="jgp-share-head"><div><h3 id="jgp-share-title">Share your trip</h3><p id="jgp-share-description">Send your itinerary using your preferred app.</p></div><button type="button" onClick={() => setShareOpen(false)} aria-label="Close share options"><X size={20}/></button></div>
                <div className="jgp-share-options">
                  <button type="button" className="jgp-share-option jgp-share-option--whatsapp" onClick={() => shareVia('whatsapp')}><span className="jgp-share-emoji" aria-hidden="true">💬</span><span className="jgp-share-option-label">WhatsApp</span></button>
                  <button type="button" className="jgp-share-option jgp-share-option--telegram" onClick={() => shareVia('telegram')}><span className="jgp-share-emoji" aria-hidden="true">✈️</span><span className="jgp-share-option-label">Telegram</span></button>
                  <button type="button" className="jgp-share-option jgp-share-option--email" onClick={() => shareVia('email')}><span className="jgp-share-emoji" aria-hidden="true">✉️</span><span className="jgp-share-option-label">Email</span></button>
                  <button type="button" className="jgp-share-option jgp-share-option--copy" onClick={() => shareVia('copy')}><span className="jgp-share-emoji" aria-hidden="true">🔗</span><span className="jgp-share-option-label">Copy text</span></button>
                  <button type="button" className="jgp-share-option jgp-share-option--system" onClick={() => shareVia('system')}><span className="jgp-share-emoji" aria-hidden="true">📤</span><span className="jgp-share-option-label">More apps</span></button>
                </div>
                <p className="jgp-share-note">Sharing sends the itinerary text. Some apps may shorten very long messages.</p>
              </div>
            </div>}
            <div className="jgp-new-results">
              {loading ? (
                <div style={{width: '100%'}}>
                  <style>{AGENT_WORKFLOW_CSS}</style>
                  <AgentWorkflow progress={agentProgress}/>
                </div>
              ) : !itinerary ? (
                <div className="jgp-empty"><Sparkles size={34}/><h3>Your adventure starts here</h3><p>Complete your preferences above, then select Generate Trip.</p></div>
              ) : (
                <>
                  {tripFormChanged && <div className="jgp-snapshot-reminder" role="status">
                    <Info size={18}/><span>You changed the form after generating this itinerary. The Save Trip button will preserve the <strong>original generated trip details</strong>. Select Generate/Regenerate Trip to apply the new form selections.</span>
                  </div>}
                  {dateDayMismatch && <div className="jgp-snapshot-reminder" role="alert">
                    <AlertCircle size={18}/><span>This itinerary has {days.length} days, but its saved date range spans {duration} days. All itinerary days remain visible; correct the dates and regenerate before saving again.</span>
                  </div>}
                  {(Object.keys(agentResearch).length > 0 || Object.keys(structuredResearch).length > 0) && (
                    <section className="jgp-research-panel" aria-label="Travel research results">
                      <style>{AGENT_RESEARCH_CSS}</style>
                      <h3><Info size={19}/> Flight, Hotel &amp; Travel Research</h3>
                      <p>These are findings returned by your selected agents, not confirmed bookings. Verify schedules, operating routes, hotel rooms, prices and availability before payment.</p>
                      {AGENT_RESEARCH_FIELDS.filter(({key}) => agentResearch[key] || structuredResearch[key]).map(({key, label, Icon}) => (
                        <details key={key}>
                          <summary><Icon size={17}/>{label}<span className="jgp-research-tag">View findings</span></summary>
                          {(() => {
                            const findings = displayResearchFindings(agentResearch[key], structuredResearch[key], key);
                            return <div className="jgp-research-raw">
                              <p className="jgp-research-disclaimer">{findings.notice}</p>
                              {findings.message && <p className="jgp-research-summary">{findings.message}</p>}
                              {findings.sources.length > 0 ? <>
                                <strong>{key === 'road_results' ? 'Directions link' : 'Search references'}</strong>
                                <ul className="jgp-source-list">
                                  {findings.sources.map(item => <li key={item.url}>
                                    <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                                    {item.description && <small>{item.description}</small>}
                                  </li>)}
                                </ul>
                              </> : !findings.message && <p className="jgp-research-summary">The agent did not return usable details for this category. Check the source directly before relying on it.</p>}
                            </div>;
                          })()}
                        </details>
                      ))}
                    </section>
                  )}
                  <section className="trip-details-page jgp-saved-trip-format" style={{minHeight: 'auto', padding: '20px', borderRadius: '18px'}}>
                    <div className="trip-details-itinerary">
                      <div className="trip-details-itinerary-heading">
                        <div className="trip-details-itinerary-icon"><Plane size={24}/></div>
                        <div><h2>Your Travel Itinerary</h2><p>Explore the details of your AI-generated travel plan.</p></div>
                      </div>
                      <div className="trip-details-itinerary-content">
                        {splitSavedTripItinerary(itinerary).map((section, index) => section.type === 'day' ? (
                          <DayActivityCards key={section.key || index} section={section} destination={displayedTrip.destination}
                            disabled={loading || regeneratingDay}
                            onRegenerate={() => { const dayIndex = days.findIndex(item => item.day === section.dayNumber); if (dayIndex >= 0) { setExpandedDay(dayIndex); document.getElementById('jgp-day-regeneration')?.scrollIntoView({behavior: 'smooth', block: 'center'}); } }}/>
                        ) : (
                          <article key={section.key || index} className="trip-details-itinerary-section">
                            <TripOverview content={section.content}/>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                  {days.length > 0 && <section className="jgp-day-regenerate" id="jgp-day-regeneration">
                    <h4><RefreshCw size={18}/> Regenerate Day {days[Math.min(expandedDay, days.length - 1)].day} Only</h4>
                    <p>Choose a day and optionally provide instructions. Other days remain unchanged.</p>
                    <div className="jgp-ref-day-tabs">{days.map((day, index) => <button type="button" key={day.day} className={expandedDay === index ? 'active' : ''} onClick={() => setExpandedDay(index)}>Day {day.day}</button>)}</div>
                    <textarea value={dayInstructions} onChange={e => setDayInstructions(e.target.value)} maxLength={1500} placeholder="More shopping, fewer monuments, less walking..." aria-label="Additional instructions for selected day"/>
                    <button type="button" disabled={regeneratingDay || loading} onClick={regenerateSelectedDay} className="jgp-generate">
                      {regeneratingDay ? <><LoaderCircle className="jgp-spin" size={17}/>Regenerating...</> : <><RefreshCw size={17}/>Regenerate This Day</>}
                    </button>
                    {dayPreview && <div className="jgp-day-preview">
                      <h4>Preview: Alternative Day {dayPreview.day}</h4>
                      <div className="trip-details-page" style={{padding: '12px', minHeight: 'auto'}}><SavedTripMarkdown content={dayPreview.markdown}/></div>
                      <div className="jgp-ref-actions"><button type="button" className="jgp-generate" onClick={acceptDayPreview}><Check size={16}/>Accept Changes</button><button type="button" className="jgp-ref-reset" onClick={() => setDayPreview(null)}><X size={16}/>Keep Original</button></div>
                    </div>}
                  </section>}
                  <div className="jgp-budget-bar"><div><h3><Calculator size={20}/> Budget Calculator</h3><p>Editable estimates, not verified live prices.</p></div><button type="button" className="jgp-ref-reset" onClick={() => setBudgetOpen(!budgetOpen)}><Calculator size={17}/>{budgetOpen ? 'Hide Calculator' : 'Calculate Budget'}</button></div>
                  {illustrativeBudget && <section className="jgp-budget-preview" aria-label="Illustrative planning budget">
                    <style>{ILLUSTRATIVE_BUDGET_CSS}</style>
                    <div className="jgp-budget-preview-title"><Info size={16}/><span>Example planning subtotal:</span>
                      <strong>{currency(illustrativeBudget.min)}–{currency(illustrativeBudget.max)}</strong></div>
                    <p>Whole trip, all travelers. <strong>Not a confirmed total.</strong> Excludes unknown costs, including round-trip intercity tickets. These sample allowances are separate from the editable calculator below.</p>
                    <details>
                      <summary>View included allowances and exclusions</summary>
                      {illustrativeBudget.categories.length > 0 && <ul>
                        {illustrativeBudget.categories.map((item, index) =>
                          <li key={`${item.label}-${index}`}>{item.label}: {currency(item.min)}–{currency(item.max)} (whole trip)</li>)}
                      </ul>}
                      {illustrativeBudget.excluded.length > 0 && <p>Excluded: {illustrativeBudget.excluded.map(item =>
                        item === 'round_trip_intercity_transport' ? 'round-trip intercity transport' :
                        item === 'accommodation' ? 'accommodation (not selected)' : item.replace(/_/g, ' ')).join(', ')}.</p>}
                      {illustrativeBudget.message && <p>{illustrativeBudget.message}</p>}
                    </details>
                  </section>}
                  {budgetOpen && <div className="jgp-budget-calculator">
                    <div className="jgp-budget-grid">{[
                      ['transport','Round-trip transportation (total)'],['hotel','Accommodation per night'],['food','Meals per person per day'],['activities','Sightseeing per person (total)'],['miscellaneous','Miscellaneous (total)']
                    ].map(([key,label]) => <label key={key}>{label}<input type="number" min="0" value={budgetValues[key]} placeholder="Enter amount" onChange={e => changeBudget(key,e.target.value)}/></label>)}</div>
                    <div className="jgp-budget-context"><span><CalendarDays size={16}/>{duration || 0} days / {nights} nights</span><span><Users size={16}/>{travelerCount} traveler{travelerCount === 1 ? '' : 's'}</span></div>
                    <div className="jgp-budget-breakdown">
                      <h4>Cost breakdown</h4>
                      {[
                        ['Transport',costNumber(budgetValues.transport),budgetValues.transport !== ''],
                        ['Accommodation',costNumber(budgetValues.hotel)*nights,budgetValues.hotel !== ''],
                        ['Meals',costNumber(budgetValues.food)*(duration || 1)*travelerCount,budgetValues.food !== ''],
                        ['Sightseeing',costNumber(budgetValues.activities)*travelerCount,budgetValues.activities !== ''],
                        ['Miscellaneous',costNumber(budgetValues.miscellaneous),budgetValues.miscellaneous !== '']
                      ].map(([label,amount,known]) => <div className="jgp-budget-breakdown-row" key={label}><span>{label}</span><strong>{known ? currency(amount) : 'Not entered'}</strong></div>)}
                    </div>
                    <div className="jgp-budget-total"><span>{budgetComplete ? 'Estimated trip total' : 'Subtotal of entered costs'}</span><strong>{hasBudget ? currency(budgetTotal) : 'Not estimated'}</strong></div>
                    <small>{budgetComplete ? 'All five cost categories are entered. These are estimates, not verified prices.' : `${enteredBudgetCount} of 5 cost categories entered. Missing costs are unknown, not ₹0; this subtotal is not the full trip cost.`} Verify prices before booking.</small>
                  </div>}
                </>
              )}
            </div>

          </section>

        </div>

      </main>

    </div>

  );

}
