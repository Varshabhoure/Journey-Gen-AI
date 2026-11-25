# Journey Gen AI — System Architecture Diagrams

This file contains Mermaid source code for editing the two diagrams. You can paste each block into a Mermaid-compatible Markdown editor or Mermaid Live Editor.

## 1. Overall system architecture

```mermaid
flowchart LR
    U[Traveler] --> F[React + Vite frontend]
    F -->|REST JSON + SSE progress| API[FastAPI backend_api:api]
    API --> A[JWT authentication]
    API --> CRUD[Saved trip + sharing endpoints]
    A --> SQL[(SQLite: backend_trips.db)]
    CRUD --> SQL
    API --> LG[LangGraph supervisor]
    LG -->|Only if selected| R[Flight / Train / Hotel / Weather / Budget agents]
    LG -->|Always| I[Itinerary agent]
    R --> I
    R --> MCP[Tavily + Weather MCP tools]
    I --> GROQ[Groq LLM: openai/gpt-oss-120b]
    LG -.-> PG[(PostgreSQL: graph checkpoints)]
    I --> API
    API --> F
    F --> MAPS[Google Maps + landmark photos]
    F --> SHARE[Dashboard / trip details / read-only sharing]
```

**Implementation note:** Bus and road transport options are handled within the itinerary flow; the checked `main.py` does not define separate `bus_agent` or `road_agent` LangGraph nodes.

## 2. Conditional agent workflow

```mermaid
flowchart TD
    A[Traveler enters trip preferences] --> B[LangGraph supervisor]
    B -->|If selected| C[Optional research: Flight, Train, Hotel, Weather, Budget]
    B -->|Always| D[Itinerary agent]
    C --> D
    D --> E[Day-wise itinerary + suggested times + important notes]
    E --> F{Traveler decision}
    F -->|Save| G[(SQLite: saved trip and preferences)]
    F -->|Regenerate one day| H[Preview alternative day]
    H -->|Accept / Keep original| E
    G --> I[Dashboard, trip details, read-only share link]
```

### Key technologies

- **Frontend:** React, Vite, Axios, CSS, `lucide-react`.
- **Backend:** Python, FastAPI, Pydantic, JWT, SSE.
- **AI workflow:** LangGraph, Groq `openai/gpt-oss-120b`.
- **Research:** MCP integrations, Tavily search, weather and forecast tools; other configured services may be available.
- **Storage:** SQLite for users/saved trips; PostgreSQL checkpointing when configured.
- **Presentation:** Google Maps links, landmark photography when available, PDF/export, public read-only shared links.

**Caution:** Travel research, times and indicative budgets are planning information, not confirmed bookings or live quotes.
