import os

import json

import re

import uuid

import sqlite3

import hashlib

import secrets

import traceback
import queue
import threading

from pathlib import Path

from datetime import datetime, timedelta, timezone

from typing import Optional, Any

from fastapi.responses import StreamingResponse

import jwt

from dotenv import load_dotenv

from pwdlib import PasswordHash

from fastapi import FastAPI, HTTPException, Depends

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, EmailStr, Field, AliasChoices, ConfigDict

from langchain_core.messages import HumanMessage

from langgraph.types import Command

# ---------------------------------------------------------
# 1. CONFIGURATION
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env", override=True)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_HOURS = 24

if not JWT_SECRET_KEY:

    raise RuntimeError("JWT_SECRET_KEY is missing from .env")

DATABASE_FILE = BASE_DIR / "backend_trips.db"

password_hash = PasswordHash.recommended()

security = HTTPBearer()

# Import the existing LangGraph application.
# The CLI input loop in main.py will not run during this import.
from main import app as travel_graph, regenerate_itinerary_day, determine_required_agents

# ---------------------------------------------------------
# 2. FASTAPI APPLICATION
# ---------------------------------------------------------
api = FastAPI(

    title="Journey Gen AI API",

    description="Travel planning API powered by Groq, LangGraph and MCP.",

    version="1.1.0",

)

api.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:5173",

        "http://127.0.0.1:5173",

    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

# ---------------------------------------------------------
# 3. DATABASE
# ---------------------------------------------------------
def get_db():

    conn = sqlite3.connect(DATABASE_FILE)

    conn.row_factory = sqlite3.Row

    return conn

def initialize_database():

    with get_db() as conn:

        conn.execute("""

            CREATE TABLE IF NOT EXISTS users (

                id TEXT PRIMARY KEY,

                email TEXT UNIQUE NOT NULL,

                hashed_password TEXT NOT NULL,

                created_at TEXT NOT NULL

            )

        """)

        # Migrate existing installations without deleting users or trips.
        existing_columns = {

            row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()

        }

        for column in ("first_name", "middle_name", "last_name"):

            if column not in existing_columns:

                conn.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")

        conn.execute("""

            CREATE TABLE IF NOT EXISTS trips (

                id TEXT PRIMARY KEY,

                user_id TEXT NOT NULL,

                title TEXT NOT NULL,

                form_data TEXT NOT NULL,

                itinerary TEXT NOT NULL,

                saved_at TEXT NOT NULL,

                share_token_hash TEXT,

                FOREIGN KEY(user_id) REFERENCES users(id)

            )

        """)

        conn.execute("""

            CREATE TABLE IF NOT EXISTS workflow_sessions (

                thread_id TEXT PRIMARY KEY,

                user_id TEXT NOT NULL,

                created_at TEXT NOT NULL,

                FOREIGN KEY(user_id) REFERENCES users(id)

            )

        """)

initialize_database()

# ---------------------------------------------------------
# 4. REQUEST MODELS
# ---------------------------------------------------------
class RegisterRequest(BaseModel):

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr

    password: str = Field(min_length=8, max_length=128)

    first_name: str = Field(

        default="", max_length=100,

        validation_alias=AliasChoices("first_name", "firstName"),

    )

    middle_name: str = Field(

        default="", max_length=100,

        validation_alias=AliasChoices("middle_name", "middleName"),

    )

    last_name: str = Field(

        default="", max_length=100,

        validation_alias=AliasChoices("last_name", "lastName"),

    )

class ProfileUpdateRequest(BaseModel):

    model_config = ConfigDict(populate_by_name=True)

    first_name: str = Field(min_length=1, max_length=100, validation_alias=AliasChoices("first_name", "firstName"))

    middle_name: str = Field(default="", max_length=100, validation_alias=AliasChoices("middle_name", "middleName"))

    last_name: str = Field(default="", max_length=100, validation_alias=AliasChoices("last_name", "lastName"))

class LoginRequest(BaseModel):

    email: EmailStr

    password: str

class TripSaveRequest(BaseModel):

    title: str

    formData: dict[str, Any]

    itinerary: str

    savedAt: Optional[str] = None

class ApprovalRequest(BaseModel):

    thread_id: str

    approved: bool

    feedback: str = ""

class RegenerateDayRequest(BaseModel):

    day_number: int = Field(ge=1)

    feedback: str = Field(default="", max_length=1500)

    thread_id: Optional[str] = None

    trip_id: Optional[str] = None

    formData: Optional[dict[str, Any]] = None

    existing_itinerary: str = Field(default="", max_length=100000)

# ---------------------------------------------------------
# 5. AUTHENTICATION
# ---------------------------------------------------------
def create_access_token(user_id: str):

    now = datetime.now(timezone.utc)

    payload = {

        "sub": user_id,

        "iat": now,

        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),

    }

    return jwt.encode(

        payload,

        JWT_SECRET_KEY,

        algorithm=JWT_ALGORITHM,

    )

def get_current_user(

    credentials: HTTPAuthorizationCredentials = Depends(security),

):

    token = credentials.credentials

    try:

        payload = jwt.decode(

            token,

            JWT_SECRET_KEY,

            algorithms=[JWT_ALGORITHM],

        )

        user_id = payload.get("sub")

        if not user_id:

            raise HTTPException(

                status_code=401,

                detail="Invalid authentication token.",

            )

    except jwt.InvalidTokenError:

        raise HTTPException(

            status_code=401,

            detail="Invalid or expired authentication token.",

        )

    with get_db() as conn:

        user = conn.execute(

            "SELECT id, email, first_name, middle_name, last_name FROM users WHERE id = ?",

            (user_id,),

        ).fetchone()

    if not user:

        raise HTTPException(

            status_code=401,

            detail="User not found.",

        )

    return dict(user)

def public_user(user):

    first_name = (user["first_name"] or "").strip()

    middle_name = (user["middle_name"] or "").strip()

    last_name = (user["last_name"] or "").strip()

    full_name = " ".join(part for part in (first_name, middle_name, last_name) if part)

    return {

        "id": user["id"],

        "email": user["email"],

        "first_name": first_name,

        "middle_name": middle_name,

        "last_name": last_name,

        "firstName": first_name,

        "middleName": middle_name,

        "lastName": last_name,

        "full_name": full_name,

        "name": full_name,

    }

def auth_response(user):

    return {

        "status": "success",

        "access_token": create_access_token(user["id"]),

        "token_type": "bearer",

        "user": public_user(user),

    }

@api.post("/auth/register")

def register_user(data: RegisterRequest):

    email = str(data.email).lower().strip()

    first_name = data.first_name.strip()

    middle_name = data.middle_name.strip()

    last_name = data.last_name.strip()

    with get_db() as conn:

        existing = conn.execute(

            "SELECT id FROM users WHERE email = ?",

            (email,),

        ).fetchone()

        if existing:

            raise HTTPException(

                status_code=409,

                detail="An account with this email already exists.",

            )

        user_id = str(uuid.uuid4())

        hashed_password = password_hash.hash(data.password)

        conn.execute(

            """

            INSERT INTO users (

                id, email, hashed_password, created_at,

                first_name, middle_name, last_name

            )

            VALUES (?, ?, ?, ?, ?, ?, ?)

            """,

            (

                user_id,

                email,

                hashed_password,

                datetime.now(timezone.utc).isoformat(),

                first_name,

                middle_name,

                last_name,

            ),

        )

    return auth_response({

        "id": user_id,

        "email": email,

        "first_name": first_name,

        "middle_name": middle_name,

        "last_name": last_name,

    })

@api.post("/auth/login")

def login_user(data: LoginRequest):

    email = str(data.email).lower().strip()

    with get_db() as conn:

        user = conn.execute(

            "SELECT * FROM users WHERE email = ?",

            (email,),

        ).fetchone()

    if not user or not password_hash.verify(

        data.password,

        user["hashed_password"],

    ):

        raise HTTPException(

            status_code=401,

            detail="Incorrect email or password.",

        )

    return auth_response(dict(user))

@api.get("/auth/me")

def current_user(user=Depends(get_current_user)):

    return public_user(user)

@api.patch("/auth/me")

def update_current_user(data: ProfileUpdateRequest, user=Depends(get_current_user)):

    first_name = data.first_name.strip()

    middle_name = data.middle_name.strip()

    last_name = data.last_name.strip()

    if not first_name:

        raise HTTPException(status_code=422, detail="First name is required.")

    with get_db() as conn:

        conn.execute(

            """

            UPDATE users

            SET first_name = ?, middle_name = ?, last_name = ?

            WHERE id = ?

            """,

            (first_name, middle_name, last_name, user["id"]),

        )

        updated_user = conn.execute(

            "SELECT id, email, first_name, middle_name, last_name FROM users WHERE id = ?",

            (user["id"],),

        ).fetchone()

    return public_user(updated_user)

# ---------------------------------------------------------
# 6. TRIP HELPERS
# ---------------------------------------------------------
def format_trip(row):

    return {

        "id": row["id"],

        "title": row["title"],

        "formData": json.loads(row["form_data"]),

        "itinerary": row["itinerary"],

        "savedAt": row["saved_at"],

    }

def get_owned_trip(trip_id: str, user_id: str):

    with get_db() as conn:

        trip = conn.execute(

            """

            SELECT * FROM trips

            WHERE id = ? AND user_id = ?

            """,

            (trip_id, user_id),

        ).fetchone()

    if not trip:

        raise HTTPException(

            status_code=404,

            detail="Trip not found.",

        )

    return trip

def validate_trip_dates(data: dict):

    start_date = data.get("startDate")

    end_date = data.get("endDate")

    if not start_date or not end_date:

        raise HTTPException(

            status_code=400,

            detail="Start date and end date are required.",

        )

    try:

        start = datetime.strptime(start_date, "%Y-%m-%d").date()

        end = datetime.strptime(end_date, "%Y-%m-%d").date()

    except (TypeError, ValueError):

        raise HTTPException(

            status_code=400,

            detail="Dates must use the YYYY-MM-DD format.",

        )

    if end < start:

        raise HTTPException(

            status_code=400,

            detail="End date cannot be earlier than start date.",

        )

def selected_values(value):

    """Normalize optional Planner multi-select values without adding defaults."""

    if isinstance(value, str):

        value = [value]

    if not isinstance(value, (list, tuple)):

        return []

    ignored = {"", "none", "not specified", "any", "no preference", "all", "select", "select option"}

    result = []

    for item in value:

        if not isinstance(item, str):

            continue

        item = item.strip()

        if item and item.lower() not in ignored and item not in result:

            result.append(item)

    return result

def optional_choice(value):

    """An unselected dropdown must not trigger an optional research agent."""

    if isinstance(value, (int, float)) and not isinstance(value, bool):

        return str(value)

    if isinstance(value, (list, tuple)):

        return ", ".join(selected_values(value))

    return selected_values(value)[0] if selected_values(value) else ""

ITINERARY_LANGUAGE_NAMES = {"en": "English"}

def get_itinerary_language(data: dict) -> str:

    """The current LangGraph itinerary generator supports English only."""

    return "en"

def language_output_guidance(code: str) -> str:

    return (

        "Write all day titles, activities and travel notes in English. "

        "Keep Markdown headings as ## Day 1, ## Day 2, etc. "

        "Use meaningful place names, numeric times, and concise activity bullets."

    )

def build_trip_query(data: dict):

    """Short, structured request; avoid triggering unselected agents in the prompt."""

    lines = [

        "Plan a short, point-wise travel itinerary.",

        f"Origin: {data.get('source')}",

        f"Destination: {data.get('destination')}",

        f"Start date: {data.get('startDate')}",

        f"End date: {data.get('endDate')}",

    ]

    optional_fields = (

        ("Travellers", data.get("travelers")),

        ("Adults", data.get("adults")),

        ("Children", data.get("children")),

        ("Budget", optional_choice(data.get("budget"))),

        ("Travel themes", selected_values(data.get("interests"))),

        ("Travel pace", optional_choice(data.get("travelPace"))),

        ("Weather preference", optional_choice(data.get("weatherPreference"))),

        ("Accommodation", optional_choice(data.get("accommodation"))),

        ("Food preferences", selected_values(data.get("foodPreferences"))),

        ("Transportation", selected_values(data.get("transportation"))),

        ("Special requirements", optional_choice(data.get("specialRequirements"))),

    )

    for label, value in optional_fields:

        if value is not None and value != "" and value != []:

            lines.append(f"{label}: {', '.join(value) if isinstance(value, list) else value}")

    lines.append("For each sightseeing day, give 3-5 concise activities; 2-4 for arrival/departure days.")

    lines.append("Use: Time | Activity or place. Omit unverified costs entirely.")

    lines.append("Apply only the preferences actually selected. Avoid lengthy explanations.")

    lines.append(language_output_guidance(get_itinerary_language(data)))

    return "\n".join(lines)

def build_trip_constraints(data: dict[str, Any]) -> dict[str, Any]:

    """Use identical, explicit Planner preferences for every workflow endpoint."""

    validate_trip_dates(data)

    start = datetime.strptime(data["startDate"], "%Y-%m-%d").date()

    end = datetime.strptime(data["endDate"], "%Y-%m-%d").date()

    language = get_itinerary_language(data)

    themes = selected_values(data.get("interests"))

    return {

        "origin": str(data.get("source") or "").strip(),

        "destination": str(data.get("destination") or "").strip(),

        "start_date": data["startDate"],

        "end_date": data["endDate"],

        "dates": f"{data['startDate']} to {data['endDate']}",

        "duration_days": (end - start).days + 1,

        "traveller_count": data.get("travelers"),

        "adults": data.get("adults"),

        "children": data.get("children"),

        "budget": optional_choice(data.get("budget")),

        "travel_style": optional_choice(data.get("travelPace")),

        "weather_preference": optional_choice(data.get("weatherPreference")),

        "accommodation": optional_choice(data.get("accommodation")),

        "interests": themes,

        "travel_themes": themes,

        "transportation_modes": selected_values(data.get("transportation")),

        "meal_preferences": selected_values(data.get("foodPreferences")),

        "special_preferences": selected_values(data.get("specialRequirements")),

        "itinerary_language": language,

        "itinerary_language_name": ITINERARY_LANGUAGE_NAMES[language],

    }



# ---------------------------------------------------------
# 7. LANGGRAPH RESULT HANDLING
# ---------------------------------------------------------
def get_agent_results(result: dict):

    """

    Extract all available research results from LangGraph.

    The LangGraph TravelState uses plural field names.

    """

    agent_fields = (

        "flight_results",

        "train_results",

        "bus_results",

        "road_results",

        "hotel_results",

        "weather_results",

        "budget_results",

    )

    return {

        key: result.get(key)

        for key in agent_fields

        if result.get(key) is not None

    }

# Structured metadata is additive: older Planner.jsx versions keep reading the
# existing agent_results strings, while newer versions can show compact cards.
def _external_research_url(value: Any) -> str:
    """Reject non-web URLs from untrusted search results."""
    from urllib.parse import urlsplit

    if not isinstance(value, str) or len(value) > 1500:
        return ""
    value = value.strip()
    try:
        parsed = urlsplit(value)
        if (parsed.scheme.lower() in ("http", "https") and parsed.hostname
                and not parsed.username and not parsed.password):
            return value
    except ValueError:
        pass
    return ""


def structured_agent_research(raw_results: dict) -> dict:
    """Expose referenced pages, *not* fabricated bookable transport/stays."""
    categories = {
        "flight_results": "flight",
        "train_results": "train",
        "bus_results": "bus",
        "road_results": "road",
        "hotel_results": "hotel",
        "weather_results": "weather",
        "budget_results": "budget",
    }
    structured = {}
    for field, category in categories.items():
        raw = raw_results.get(field)
        if raw is None:
            continue
        text = raw if isinstance(raw, str) else json.dumps(raw, default=str, ensure_ascii=False)
        sources = []
        summary = ""
        if category in ("flight", "train", "bus", "road", "hotel"):
            try:
                decoded = json.loads(text)
            except (ValueError, TypeError):
                decoded = None
            if isinstance(decoded, dict):
                summary = str(decoded.get("summary") or "")[:400]
                for item in (decoded.get("results") or [])[:4]:
                    if not isinstance(item, dict):
                        continue
                    url = _external_research_url(item.get("url"))
                    if not url:
                        continue
                    sources.append({
                        "title": str(item.get("title") or "Reference")[:150],
                        "url": url,
                        "description": str(item.get("content") or "")[:280],
                        "verified_booking": False,
                    })
            if not summary:
                summary = text[:450]
        elif category == "weather":
            summary = "Weather tool output is advisory; check dates before using a forecast."
        else:
            summary = "Planning allowances only; actual costs may differ."
        structured[field] = {
            "category": category,
            "summary": summary,
            "sources": sources,
            "booking_verified": False,
        }
    return structured


def extract_illustrative_budget(raw_results: dict) -> Optional[dict]:
    """Convert main.py's explicitly *illustrative* INR ranges to data.

    All amounts are trip-level allowances, NOT per-night rates or live quotes;
    transport is unknown and must not be silently counted as zero.
    """
    text = raw_results.get("budget_results")
    if not isinstance(text, str) or "Illustrative planning allowances in INR" not in text:
        return None
    label_keys = (
        ("Accommodation", "accommodation"),
        ("Meals", "meals"),
        ("Local travel", "local_transport"),
        ("Sightseeing", "sightseeing"),
    )
    ranges = []
    for line in text.splitlines():
        stripped = line.strip()
        for prefix, key in label_keys:
            if not stripped.startswith("- " + prefix):
                continue
            match = re.search(r"₹([0-9,]+)\s*[–-]\s*₹([0-9,]+)", stripped)
            if match:
                low, high = (int(part.replace(",", "")) for part in match.groups())
                if 0 <= low <= high:
                    ranges.append({"category": key, "label": prefix,
                                   "min": low, "max": high, "basis": "whole_trip"})
            break
    subtotal_match = re.search(
        r"ILLUSTRATIVE SUBTOTAL[^\n]*?:\s*₹([0-9,]+)\s*[–-]\s*₹([0-9,]+)", text
    )
    if not subtotal_match:
        return None
    low, high = (int(part.replace(",", "")) for part in subtotal_match.groups())
    if not 0 <= low <= high:
        return None
    excluded = ["round_trip_intercity_transport"]
    if "Accommodation: UNKNOWN" in text:
        excluded.append("accommodation")
    return {
        "currency": "INR",
        "type": "illustrative_partial_allowance",
        "min": low,
        "max": high,
        "basis": "total_for_all_travelers",
        "categories": ranges,
        "excluded_categories": excluded,
        "complete_trip_cost": False,
        "verified_quote": False,
        "message": "Example planning subtotal only; missing costs must be added before assessing the full trip budget.",
    }


def normalize_itinerary_headings(itinerary: str) -> str:

    """Normalize actual Day headings, without changing activity descriptions."""

    lines = []

    heading = re.compile(
        r"^\s*(?:#{1,6}\s*)?(?:\*\*|__)?Day\s+(\d+)(?:\*\*|__)?\s*(?:[:–—.-]\s*)?(.*?)\s*$",
        re.IGNORECASE,
    )

    for line in (itinerary or "").splitlines():

        match = heading.fullmatch(line)

        if match:

            day_number, title = match.groups()

            title = title.strip().strip("*_")

            line = f"## Day {int(day_number)}" + (f" — {title}" if title else "")

        lines.append(line)

    return "\n".join(lines)









def report_itinerary_days(itinerary: str, expected_days: int, thread_id: str) -> list[int]:

    """Log the day headings actually returned by LangGraph for diagnosis."""

    found = sorted({int(day) for day in re.findall(

        r"(?im)^\s*#{1,6}\s+Day\s+(\d+)\b", itinerary or ""

    )})

    missing = [day for day in range(1, expected_days + 1) if day not in found]

    print(f"ITINERARY DELIVERY thread={thread_id}: expected={expected_days}, "

          f"found={found}, missing={missing}, chars={len(itinerary or '')}", flush=True)

    return missing

def check_itinerary_completeness(response: dict, expected_days: int, thread_id: str) -> dict:

    """Expose missing days to both JSON and streaming clients consistently."""

    itinerary = response.get("itinerary") or ""

    missing = report_itinerary_days(itinerary, expected_days, thread_id) if itinerary else list(range(1, expected_days + 1))

    # Check duplicate numbered days and empty day bodies as well as missing headers.
    matches = list(re.finditer(r"(?im)^\s*#{1,6}\s+Day\s+(\d+)\b[^\n]*$", itinerary))
    day_numbers = [int(match.group(1)) for match in matches]
    duplicates = sorted({day for day in day_numbers if day_numbers.count(day) > 1})
    empty_days = []
    for index, heading in enumerate(matches):
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(itinerary)
        body = itinerary[heading.end():body_end]
        body = re.split(r"(?im)^\s*#{1,6}\s+(?:Important|Notes|Tips)\b", body, maxsplit=1)[0]
        if not re.search(r"(?m)^\s*[-*]\s+\S", body):
            empty_days.append(int(heading.group(1)))
    response["missing_days"] = sorted(set(missing + empty_days))
    response["duplicate_days"] = duplicates
    response["itinerary_complete"] = bool(itinerary) and not missing and not duplicates and not empty_days
    if not response["itinerary_complete"]:
        details = []
        if missing:
            details.append("missing Day " + ", ".join(map(str, missing)))
        if duplicates:
            details.append("duplicate Day " + ", ".join(map(str, duplicates)))
        if empty_days:
            details.append("empty Day " + ", ".join(map(str, sorted(set(empty_days)))))
        response["itinerary_error"] = (
            f"Incomplete {expected_days}-day itinerary: " + "; ".join(details)
            + ". Check ITINERARY DELIVERY in the backend terminal."
        )
        if not response.get("approval_required"):
            response["status"] = "failed"

    return response



def extract_graph_result(result: dict, thread_id: Optional[str] = None):

    """

    Convert the LangGraph result into a frontend-friendly response.

    Possible statuses:

    - approval_required

    - approved

    - not_approved

    - failed

    """

    interrupt_items = result.get("__interrupt__", [])

    itinerary = normalize_itinerary_headings(result.get("itinerary", "") or "")

    final_response = result.get("final_response", "") or ""

    revision_count = result.get("revision_count", 0)

    revision_limit_reached = bool(

        result.get("revision_limit_reached", False)

    )

    agent_results = get_agent_results(result)
    agent_research = structured_agent_research(agent_results)
    budget_estimate = extract_illustrative_budget(agent_results)

    # -----------------------------------------------------
    # The workflow is waiting for human approval.
    # -----------------------------------------------------
    if interrupt_items:

        interrupt_value = getattr(

            interrupt_items[0],

            "value",

            {},

        )

        return {

            "status": "approval_required",

            "approval_required": True,

            "approved": False,

            "approval_request": interrupt_value,

            "itinerary": itinerary,

            "draft_itinerary": itinerary,

            "final_response": "",

            "thread_id": thread_id,

            "revision_count": revision_count,

            "revision_limit_reached": False,

            "agent_results": agent_results,
        "agent_research": agent_research,
        "budget_estimate": budget_estimate,

        }

    # -----------------------------------------------------
    # The workflow has finished.
    # -----------------------------------------------------
    approved = bool(result.get("approved", False))

    itinerary_error = result.get("itinerary_error")

    if approved and itinerary:

        response_status = "approved"

    elif itinerary_error or not itinerary:

        response_status = "failed"

    else:

        response_status = "not_approved"

    return {

        "status": response_status,

        "approval_required": False,

        "approved": approved,

        "approval_request": None,

        "itinerary": itinerary,

        "draft_itinerary": itinerary,

        "final_response": final_response,

        "thread_id": thread_id,

        "revision_count": revision_count,

        "revision_limit_reached": revision_limit_reached,

        "itinerary_error": itinerary_error,

        "agent_results": agent_results,
        "agent_research": agent_research,
        "budget_estimate": budget_estimate,

    }

# ---------------------------------------------------------
# 8. GENERATE TRIP
# ---------------------------------------------------------
@api.post("/generate-trip")

def generate_trip(

    data: dict[str, Any],

    user=Depends(get_current_user),

):

    required_fields = [

        "source",

        "destination",

        "startDate",

        "endDate",

    ]

    for field in required_fields:

        if not data.get(field):

            raise HTTPException(

                status_code=400,

                detail=f"Missing required field: {field}",

            )

    validate_trip_dates(data)

    thread_id = str(uuid.uuid4())

    user_query = build_trip_query(data)

    itinerary_language = get_itinerary_language(data)

    trip_constraints = build_trip_constraints(data)



    initial_state = {

        "messages": [

            HumanMessage(content=user_query)

        ],

        "user_query": user_query,

        "trip_constraints": trip_constraints,

    }

    config = {

        "configurable": {

            "thread_id": thread_id,

        }

    }

    try:

        result = travel_graph.invoke(

            initial_state,

            config=config,

        )

    except Exception as exc:

        print("LangGraph execution error:", repr(exc))

        raise HTTPException(

            status_code=500,

            detail=(

                "The travel planning workflow failed. "

                "Check the backend terminal for details."

            ),

        )

    response = extract_graph_result(

        result,

        thread_id=thread_id,

    )

    response = check_itinerary_completeness(

        response, trip_constraints["duration_days"], thread_id

    )



    # Save the workflow session only when the graph pauses
    # and requires human approval.
    if response["approval_required"]:

        with get_db() as conn:

            conn.execute(

                """

                INSERT INTO workflow_sessions

                (thread_id, user_id, created_at)

                VALUES (?, ?, ?)

                """,

                (

                    thread_id,

                    user["id"],

                    datetime.now(timezone.utc).isoformat(),

                ),

            )

    return response

# ---------------------------------------------------------
# 8A. LIVE LANGGRAPH AGENT PROGRESS (SERVER-SENT EVENTS)
# ---------------------------------------------------------
def _progress_event(event_type: str, payload: dict) -> str:

    """Encode one SSE event; do not include untrusted tool outputs in progress."""

    return f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"

@api.post("/generate-trip/stream")

def generate_trip_stream(

    data: dict[str, Any],

    user=Depends(get_current_user),

):

    """Stream actual sequential LangGraph node transitions and final itinerary.

    The existing /generate-trip JSON endpoint remains unchanged for older clients.

    Frontend clients should read this POST response as a fetch() ReadableStream.

    """

    for field in ("source", "destination", "startDate", "endDate"):

        if not data.get(field):

            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    validate_trip_dates(data)

    thread_id = str(uuid.uuid4())

    constraints = build_trip_constraints(data)



    query = build_trip_query(data)

    initial_state = {

        "messages": [HumanMessage(content=query)],

        "user_query": query,

        "trip_constraints": constraints,

    }

    config = {"configurable": {"thread_id": thread_id}}

    selected = determine_required_agents(query, constraints, structured=True)

    # The workflow only displays agents supported and selected by main.py.
    supported_agents = ("flight_agent", "train_agent", "bus_agent", "road_agent", "hotel_agent", "weather_agent", "budget_agent")

    agent_order = [agent for agent in supported_agents if agent in selected] + ["itinerary_agent"]

    def _produce_progress_events():

        state_updates = {}

        finished = set()

        running = None

        try:

            yield _progress_event("workflow_started", {

                "thread_id": thread_id,

                "selected_agents": agent_order,

                "total_agents": len(agent_order),

            })

            yield _progress_event("agent_started", {"agent": "supervisor", "phase": "validation"})

            # The workflow is sequential: the next node starts only when the
            # iterator is advanced. Emit its start event after the previous
            # node's completion and before advancing the graph again.
            for update in travel_graph.stream(initial_state, config=config, stream_mode="updates"):

                if not isinstance(update, dict):

                    continue

                if "__interrupt__" in update:

                    state_updates["__interrupt__"] = update["__interrupt__"]

                    break

                for node, changes in update.items():

                    if node == "__interrupt__":

                        state_updates["__interrupt__"] = changes

                        continue

                    if isinstance(changes, dict):

                        state_updates.update(changes)

                    if node == "supervisor":

                        yield _progress_event("agent_completed", {"agent": "supervisor", "phase": "validation"})

                        actual_selected = (changes or {}).get("selected_agents", []) if isinstance(changes, dict) else []

                        if isinstance(changes, dict) and changes.get("guardrail_allowed") is False:

                            agent_order[:] = []

                        elif actual_selected:

                            agent_order[:] = [a for a in supported_agents if a in actual_selected] + ["itinerary_agent"]

                        yield _progress_event("agents_selected", {

                            "selected_agents": agent_order,

                            "total_agents": len(agent_order),

                        })

                    elif node in agent_order:

                        finished.add(node)

                        yield _progress_event("agent_completed", {

                            "agent": node,

                            "completed_agents": len(finished),

                            "total_agents": len(agent_order),

                        })

                    if node in ("human_approval", "final_response"):

                        yield _progress_event("workflow_phase", {"phase": node})

                if state_updates.get("__interrupt__"):

                    break

                next_agent = next((a for a in agent_order if a not in finished), None)

                if (next_agent and state_updates.get("guardrail_allowed", True)

                        and not state_updates.get("__interrupt__")

                        and "final_response" not in update

                        and "human_approval" not in update):

                    if running != next_agent:

                        running = next_agent

                        yield _progress_event("agent_started", {

                            "agent": next_agent,

                            "completed_agents": len(finished),

                            "total_agents": len(agent_order),

                        })

            # A checkpointer may provide the canonical accumulated graph state.
            # The accumulated node updates also work when no checkpointer exists.
            if "__interrupt__" not in state_updates:

                try:

                    snapshot = travel_graph.get_state(config)

                    if getattr(snapshot, "values", None):

                        state_updates.update(snapshot.values)

                    if getattr(snapshot, "tasks", None):

                        interrupts = [i for task in snapshot.tasks for i in getattr(task, "interrupts", ())]

                        if interrupts:

                            state_updates["__interrupt__"] = interrupts

                except Exception:

                    pass

            result = extract_graph_result(state_updates, thread_id=thread_id)

            result = check_itinerary_completeness(

                result, constraints["duration_days"], thread_id

            )

            if result["approval_required"]:

                with get_db() as conn:

                    conn.execute(

                        "INSERT OR REPLACE INTO workflow_sessions (thread_id, user_id, created_at) VALUES (?, ?, ?)",

                        (thread_id, user["id"], datetime.now(timezone.utc).isoformat()),

                    )

            yield _progress_event("workflow_completed", result)

        except Exception as exc:

            print("Streaming LangGraph execution error:", repr(exc), flush=True)

            traceback.print_exc()

            yield _progress_event("workflow_error", {

                "thread_id": thread_id,

                "message": "Trip generation failed. Check the backend terminal for details.",

            })

    # Run the blocking LangGraph iterator in a producer thread so the HTTP
    # stream can send keep-alive comments while an MCP/LLM call is in progress.
    # Comments have no JSON data and are ignored by the existing Planner parser.
    def event_stream():
        messages = queue.Queue(maxsize=16)
        stopped = threading.Event()
        finished = object()
        heartbeat_seconds = 10.0

        def offer(item):
            while not stopped.is_set():
                try:
                    messages.put(item, timeout=0.5)
                    return True
                except queue.Full:
                    continue
            return False

        def produce():
            try:
                for event in _produce_progress_events():
                    if not offer(event):
                        break
            except Exception as exc:
                # This covers errors outside the graph iterator's own guard.
                print("Streaming producer error:", repr(exc), flush=True)
                traceback.print_exc()
                offer(_progress_event("workflow_error", {
                    "thread_id": thread_id,
                    "message": "Trip generation failed. Check the backend terminal for details.",
                }))
            finally:
                offer(finished)

        worker = threading.Thread(
            target=produce, name="journey-trip-stream", daemon=True
        )
        worker.start()
        try:
            while True:
                try:
                    item = messages.get(timeout=heartbeat_seconds)
                except queue.Empty:
                    # SSE comment, not an application event. Keeps intermediaries
                    # from treating a slow agent as an inactive connection.
                    yield ": journey-gen-ai keepalive\n\n"
                    continue
                if item is finished:
                    break
                yield item
        finally:
            # Avoid retaining results in a queue after client disconnection.
            # In-flight third-party calls may still run until their timeout.
            stopped.set()

    return StreamingResponse(

        event_stream(),

        media_type="text/event-stream",

        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Pragma": "no-cache"},

    )

# ---------------------------------------------------------
# 9. APPROVE OR REQUEST ITINERARY REVISION
# ---------------------------------------------------------
@api.post("/generate-trip/approve")

def approve_trip(

    data: ApprovalRequest,

    user=Depends(get_current_user),

):

    # Verify that this workflow belongs to the logged-in user.
    with get_db() as conn:

        session = conn.execute(

            """

            SELECT thread_id

            FROM workflow_sessions

            WHERE thread_id = ? AND user_id = ?

            """,

            (data.thread_id, user["id"]),

        ).fetchone()

    if not session:

        raise HTTPException(

            status_code=404,

            detail="Workflow session not found.",

        )

    config = {

        "configurable": {

            "thread_id": data.thread_id,

        }

    }

    try:

        result = travel_graph.invoke(

            Command(

                resume={

                    "approved": data.approved,

                    "feedback": data.feedback,

                }

            ),

            config=config,

        )

    except Exception as exc:

        print("Approval workflow error:", repr(exc))

        raise HTTPException(

            status_code=500,

            detail=(

                "Unable to continue the approval workflow. "

                "Check the backend terminal for details."

            ),

        )

    response = extract_graph_result(

        result,

        thread_id=data.thread_id,

    )

    # If the graph pauses again, retain the same session.
    # This is important when the user rejects a draft and
    # the workflow generates a revised itinerary.
    if response["approval_required"]:

        return response

    # The graph has finished. It is now safe to remove
    # the saved workflow session.
    with get_db() as conn:

        conn.execute(

            """

            DELETE FROM workflow_sessions

            WHERE thread_id = ? AND user_id = ?

            """,

            (data.thread_id, user["id"]),

        )

    return response

# ---------------------------------------------------------
# 9A. REGENERATE ONE DAY WITHOUT RESTARTING LANGGRAPH
# ---------------------------------------------------------
def regeneration_constraints_from_form(data: dict[str, Any]) -> dict[str, Any]:

    """Translate Planner fields to the same shape used by /generate-trip."""

    return build_trip_constraints(data)



@api.post("/generate-trip/regenerate-day")

def regenerate_trip_day(

    data: RegenerateDayRequest,

    user=Depends(get_current_user),

):

    """Return a preview of one replacement day; never overwrite the trip."""

    constraints = None

    existing_itinerary = data.existing_itinerary

    if data.thread_id:

        with get_db() as conn:

            session = conn.execute(

                "SELECT thread_id FROM workflow_sessions WHERE thread_id = ? AND user_id = ?",

                (data.thread_id, user["id"]),

            ).fetchone()

        if not session:

            raise HTTPException(status_code=404, detail="Workflow session not found.")

        try:

            snapshot = travel_graph.get_state({"configurable": {"thread_id": data.thread_id}})

            state = snapshot.values or {}

        except Exception as exc:

            print("Day regeneration state error:", repr(exc))

            raise HTTPException(status_code=500, detail="Unable to read the existing workflow.")

        constraints = state.get("trip_constraints")

        existing_itinerary = state.get("itinerary") or existing_itinerary

        if not constraints:

            raise HTTPException(status_code=409, detail="Workflow has no trip constraints.")

    elif data.trip_id:

        trip = get_owned_trip(data.trip_id, user["id"])

        try:

            constraints = regeneration_constraints_from_form(json.loads(trip["form_data"]))

        except (TypeError, ValueError, KeyError) as exc:

            raise HTTPException(status_code=422, detail=f"Saved trip preferences are invalid: {exc}")

        existing_itinerary = trip["itinerary"]

    elif data.formData:

        constraints = regeneration_constraints_from_form(data.formData)

    else:

        raise HTTPException(

            status_code=422,

            detail="Provide thread_id, trip_id, or formData to regenerate a day.",

        )

    if not str(constraints.get("destination") or "").strip():

        raise HTTPException(status_code=422, detail="Destination is required.")

    try:

        day_markdown = regenerate_itinerary_day(

            trip_constraints=constraints,

            day_number=data.day_number,

            existing_itinerary=existing_itinerary,

            feedback=data.feedback,

        )

    except ValueError as exc:

        raise HTTPException(status_code=422, detail=str(exc))

    except Exception as exc:

        print("Single-day regeneration error:", repr(exc))

        raise HTTPException(

            status_code=503,

            detail="Could not regenerate this day. Your existing itinerary is unchanged.",

        )

    return {

        "status": "preview_ready",

        "day_number": data.day_number,

        "day_itinerary": day_markdown,

        "itinerary": day_markdown,

        "draft_itinerary": day_markdown,

        "thread_id": data.thread_id,

        "trip_id": data.trip_id,

        "saved": False,

        "message": "Review this day before replacing the original.",

    }

# ---------------------------------------------------------
# 10. SAVE AND RETRIEVE TRIPS
# ---------------------------------------------------------
@api.post("/trips")

def save_trip(

    data: TripSaveRequest,

    user=Depends(get_current_user),

):

    trip_id = str(uuid.uuid4())

    saved_at = (

        data.savedAt

        or datetime.now(timezone.utc).isoformat()

    )

    with get_db() as conn:

        conn.execute(

            """

            INSERT INTO trips

            (id, user_id, title, form_data, itinerary, saved_at)

            VALUES (?, ?, ?, ?, ?, ?)

            """,

            (

                trip_id,

                user["id"],

                data.title,

                json.dumps(data.formData),

                data.itinerary,

                saved_at,

            ),

        )

        trip = conn.execute(

            "SELECT * FROM trips WHERE id = ?",

            (trip_id,),

        ).fetchone()

    return format_trip(trip)

@api.get("/trips")

def get_saved_trips(user=Depends(get_current_user)):

    with get_db() as conn:

        trips = conn.execute(

            """

            SELECT * FROM trips

            WHERE user_id = ?

            ORDER BY saved_at DESC

            """,

            (user["id"],),

        ).fetchall()

    return [

        format_trip(trip)

        for trip in trips

    ]

@api.get("/trips/{trip_id}")

def get_trip(

    trip_id: str,

    user=Depends(get_current_user),

):

    trip = get_owned_trip(

        trip_id,

        user["id"],

    )

    return format_trip(trip)

@api.put("/trips/{trip_id}")

def update_trip(

    trip_id: str,

    data: TripSaveRequest,

    user=Depends(get_current_user),

):

    get_owned_trip(

        trip_id,

        user["id"],

    )

    with get_db() as conn:

        conn.execute(

            """

            UPDATE trips

            SET title = ?, form_data = ?, itinerary = ?

            WHERE id = ? AND user_id = ?

            """,

            (

                data.title,

                json.dumps(data.formData),

                data.itinerary,

                trip_id,

                user["id"],

            ),

        )

        trip = conn.execute(

            "SELECT * FROM trips WHERE id = ?",

            (trip_id,),

        ).fetchone()

    return format_trip(trip)

@api.delete("/trips/{trip_id}")

def delete_trip(

    trip_id: str,

    user=Depends(get_current_user),

):

    get_owned_trip(

        trip_id,

        user["id"],

    )

    with get_db() as conn:

        conn.execute(

            """

            DELETE FROM trips

            WHERE id = ? AND user_id = ?

            """,

            (trip_id, user["id"]),

        )

    return {

        "status": "success",

        "message": "Trip deleted.",

    }

# ---------------------------------------------------------
# 11. TRIP SHARING
# ---------------------------------------------------------
@api.post("/trips/{trip_id}/share")

def enable_trip_sharing(

    trip_id: str,

    user=Depends(get_current_user),

):

    get_owned_trip(

        trip_id,

        user["id"],

    )

    share_token = secrets.token_urlsafe(32)

    token_hash = hashlib.sha256(

        share_token.encode()

    ).hexdigest()

    with get_db() as conn:

        conn.execute(

            """

            UPDATE trips

            SET share_token_hash = ?

            WHERE id = ? AND user_id = ?

            """,

            (

                token_hash,

                trip_id,

                user["id"],

            ),

        )

    return {

        "status": "success",

        "shareToken": share_token,

        "shareEnabled": True,

    }

@api.delete("/trips/{trip_id}/share")

def disable_trip_sharing(

    trip_id: str,

    user=Depends(get_current_user),

):

    get_owned_trip(

        trip_id,

        user["id"],

    )

    with get_db() as conn:

        conn.execute(

            """

            UPDATE trips

            SET share_token_hash = NULL

            WHERE id = ? AND user_id = ?

            """,

            (

                trip_id,

                user["id"],

            ),

        )

    return {

        "status": "success",

        "shareEnabled": False,

    }

@api.get("/public/trips/{token}")

def get_public_trip(token: str):

    token_hash = hashlib.sha256(

        token.encode()

    ).hexdigest()

    with get_db() as conn:

        trip = conn.execute(

            """

            SELECT * FROM trips

            WHERE share_token_hash = ?

            """,

            (token_hash,),

        ).fetchone()

    if not trip:

        raise HTTPException(

            status_code=404,

            detail=(

                "Shared trip not found or sharing "

                "has been disabled."

            ),

        )

    return format_trip(trip)

# ---------------------------------------------------------
# 12. DAY PHOTOS COMPATIBILITY ENDPOINTS
# ---------------------------------------------------------
@api.get("/trips/{trip_id}/day-photos/{day_number}")

def get_trip_day_photos(

    trip_id: str,

    day_number: int,

    user=Depends(get_current_user),

):

    get_owned_trip(

        trip_id,

        user["id"],

    )

    return {

        "photos": [],

    }

@api.get("/public/trips/{token}/day-photos/{day_number}")

def get_public_trip_day_photos(

    token: str,

    day_number: int,

):

    token_hash = hashlib.sha256(

        token.encode()

    ).hexdigest()

    with get_db() as conn:

        trip = conn.execute(

            """

            SELECT id FROM trips

            WHERE share_token_hash = ?

            """,

            (token_hash,),

        ).fetchone()

    if not trip:

        raise HTTPException(

            status_code=404,

            detail="Shared trip not found.",

        )

    return {

        "photos": [],

    }

# ---------------------------------------------------------
# 13. HEALTH CHECK
# ---------------------------------------------------------
@api.get("/")

def root():

    return {

        "message": "Journey Gen AI API is running.",

        "status": "healthy",

    }

@api.get("/health")

def health():

    return {

        "status": "healthy",

        "application": "Journey Gen AI",

        "workflow": "LangGraph",

        "llm": "Groq",

    }

# ---------------------------------------------------------
# 14. RUN SERVER
# ---------------------------------------------------------
if __name__ == "__main__":

    import uvicorn

    uvicorn.run(

        "backend_api:api",

        host="127.0.0.1",

        port=8000,

        reload=True,

    )
