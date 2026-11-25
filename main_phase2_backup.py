
import os
import json
import re
import asyncio
import uuid
import operator

from typing import TypedDict, Annotated, Any

import psycopg

from dotenv import load_dotenv

from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)

from langchain_groq import ChatGroq

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import interrupt, Command

from mcp_client import (
    tavily_mcp_search,
    aviation_mcp_call,
    extract_destination,
    forecast_mcp_search,
    weather_mcp_search,
)


load_dotenv()


# =========================================================
# CONFIGURATION
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0
)

DATABASE_URL = os.getenv("DATABASE_URL")

MAX_REVISIONS = 3


# =========================================================
# SHARED TRAVEL STATE
# =========================================================

class TravelState(TypedDict, total=False):

    messages: Annotated[list[AnyMessage], operator.add]

    user_query: str

    trip_constraints: dict[str, Any]

    selected_agents: list[str]

    supervisor_reasoning: str

    flight_results: str

    hotel_results: str

    weather_results: str

    budget_results: str

    itinerary: str

    itinerary_error: str

    approval_request: str

    human_feedback: str

    approved: bool

    revision_count: int

    final_response: str

    guardrail_allowed: bool

    llm_calls: int


# =========================================================
# HELPER: PARSE JSON FROM LLM
# =========================================================

def parse_llm_json(response_text: str):

    try:

        cleaned = response_text.strip()

        cleaned = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            cleaned,
            flags=re.IGNORECASE
        )

        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end == -1:
            raise ValueError("JSON object not found.")

        json_text = cleaned[start:end + 1]

        return json.loads(json_text)

    except Exception as e:

        raise ValueError(
            f"Unable to parse supervisor response: {e}"
        )


# =========================================================
# HELPER: LIMIT TEXT TO REDUCE TOKEN USAGE
# =========================================================

def limit_text(value, max_chars=2000):

    text = str(value or "")

    if len(text) > max_chars:

        return (
            text[:max_chars]
            + "\n[Information truncated to reduce prompt size]"
        )

    return text


# =========================================================
# SUPERVISOR AGENT + INPUT GUARDRAIL
# =========================================================

def supervisor_agent(state: TravelState):

    query = state["user_query"]

    print("\n========== SUPERVISOR AGENT ==========\n")

    prompt = f"""
You are the supervisor of a multi-agent travel planning system.

FIRST: Validate the user request.

A valid request should relate to:
- Travel planning
- Flights
- Hotels
- Destinations
- Tourism
- Weather for travel
- Travel budgets
- Itineraries
- Transportation
- Travel recommendations

If the request is unrelated to travel, set allowed to false.

SECOND: If the request is valid, select the specialist agents.

AVAILABLE AGENTS:

1. flight_agent
Use when flights, airports, airlines, routes or airfare guidance
are relevant.

2. hotel_agent
Use when hotels, accommodation or places to stay are relevant.

3. weather_agent
Use when weather, climate, forecasts or packing advice are useful.

4. budget_agent
Use when the user mentions a budget, prices, affordability or
cost estimation.

5. itinerary_agent
Always select this agent for valid travel planning requests.

IMPORTANT:
- Do not select agents unnecessarily.
- Always include itinerary_agent for valid travel requests.
- Never invent missing user information.
- Use empty strings for unknown trip constraints.

RETURN ONLY VALID JSON:

{{
    "allowed": true,
    "reason": "",
    "selected_agents": [
        "flight_agent",
        "hotel_agent",
        "weather_agent",
        "itinerary_agent"
    ],
    "trip_constraints": {{
        "destination": "",
        "origin": "",
        "duration": "",
        "budget": "",
        "travel_style": "",
        "special_preferences": []
    }},
    "reasoning": ""
}}

USER REQUEST:

{query}
"""

    try:

        response = llm.invoke([
            SystemMessage(
                content="You are a strict travel request validator and supervisor. Return valid JSON only."
            ),
            HumanMessage(content=prompt)
        ])

        parsed = parse_llm_json(response.content)

        allowed = parsed.get("allowed", False)

        if not allowed:

            reason = parsed.get(
                "reason",
                "This request is not related to travel planning."
            )

            return {
                "guardrail_allowed": False,
                "selected_agents": [],
                "trip_constraints": {},
                "supervisor_reasoning": reason,
                "final_response": reason,
                "messages": [
                    AIMessage(
                        content=f"Request blocked by input guardrail: {reason}"
                    )
                ],
                "llm_calls": state.get("llm_calls", 0) + 1
            }

        valid_agents = {
            "flight_agent",
            "hotel_agent",
            "weather_agent",
            "budget_agent",
            "itinerary_agent"
        }

        selected_agents = [
            agent
            for agent in parsed.get("selected_agents", [])
            if agent in valid_agents
        ]

        if "itinerary_agent" not in selected_agents:
            selected_agents.append("itinerary_agent")

        constraints = parsed.get("trip_constraints", {})

        if not isinstance(constraints, dict):
            constraints = {}

        constraints.setdefault("destination", "")
        constraints.setdefault("origin", "")
        constraints.setdefault("duration", "")
        constraints.setdefault("budget", "")
        constraints.setdefault("travel_style", "")
        constraints.setdefault("special_preferences", [])

        print("Selected Agents:", selected_agents)

        print("\nTrip Constraints:")
        print(json.dumps(constraints, indent=2))

        return {
            "guardrail_allowed": True,
            "selected_agents": selected_agents,
            "trip_constraints": constraints,
            "supervisor_reasoning": parsed.get("reasoning", ""),
            "messages": [
                AIMessage(
                    content="Supervisor validated the request and selected specialist agents."
                )
            ],
            "llm_calls": state.get("llm_calls", 0) + 1
        }

    except Exception as e:

        error_message = (
            "The supervisor could not validate this request. "
            "Please try describing your travel requirements more clearly. "
            f"Technical detail: {str(e)}"
        )

        return {
            "guardrail_allowed": False,
            "selected_agents": [],
            "trip_constraints": {},
            "supervisor_reasoning": error_message,
            "final_response": error_message,
            "messages": [
                AIMessage(content=error_message)
            ],
            "llm_calls": state.get("llm_calls", 0) + 1
        }


# =========================================================
# FLIGHT AGENT
# =========================================================

def flight_agent(state: TravelState):

    print("\n========== FLIGHT AGENT ==========\n")

    query = state["user_query"]

    constraints = state.get("trip_constraints", {})

    destination = constraints.get("destination", "")

    try:

        airports = asyncio.run(
            aviation_mcp_call("list_airports")
        )

        airlines = asyncio.run(
            aviation_mcp_call("list_airlines")
        )

        prompt = f"""
You are a professional flight planning specialist.

USER REQUEST:
{query}

TRIP CONSTRAINTS:
{constraints}

AIRPORT DATA FROM AVIATIONSTACK MCP:
{str(airports)[:4000]}

AIRLINE DATA FROM AVIATIONSTACK MCP:
{str(airlines)[:4000]}

IMPORTANT DATA ACCURACY RULES:

1. Use the supplied MCP data.
2. Do not invent flight numbers.
3. Do not invent flight schedules.
4. Do not claim that a flight is available unless actual
   availability data is supplied.
5. Do not invent confirmed ticket prices.
6. If origin is missing, do not assume a departure city.
7. If a duration or airfare cannot be verified, say so.
8. Clearly distinguish estimates from verified information.

Provide:

- Relevant departure and arrival airport information,
  if supported by the supplied data.
- Relevant airlines, if supported by the supplied data.
- Flight information limitations.
- Typical duration only if supported by reliable information.
- Airfare guidance only when supported, otherwise explain
  that current fares need to be checked.
- Booking advice.

Destination: {destination}
"""

        response = llm.invoke([
            SystemMessage(
                content="You are a careful flight planning expert. Never fabricate live flight information."
            ),
            HumanMessage(content=prompt)
        ])

        flight_data = response.content

    except Exception as e:

        flight_data = (
            f"Flight information unavailable: {str(e)}"
        )

    return {
        "flight_results": flight_data,
        "messages": [
            AIMessage(content="Flight agent completed.")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# =========================================================
# HOTEL AGENT
# =========================================================

def hotel_agent(state: TravelState):

    print("\n========== HOTEL AGENT ==========\n")

    query = (
        f"Best hotels, accommodation and areas to stay for: "
        f"{state['user_query']}"
    )

    try:

        result = asyncio.run(
            tavily_mcp_search(query)
        )

        hotel_results = str(result)

    except Exception as e:

        hotel_results = (
            f"Hotel information unavailable: {str(e)}"
        )

    return {
        "hotel_results": hotel_results,
        "messages": [
            AIMessage(content="Hotel agent completed.")
        ]
    }


# =========================================================
# WEATHER AGENT
# =========================================================

def weather_agent(state: TravelState):

    print("\n========== WEATHER AGENT ==========\n")

    constraints = state.get("trip_constraints", {})

    city = constraints.get("destination", "")

    try:

        if not city:

            city = extract_destination(
                state["user_query"]
            )

        if not city:

            raise ValueError(
                "Destination city could not be identified."
            )

        weather_data = asyncio.run(
            weather_mcp_search(city)
        )

        forecast_data = asyncio.run(
            forecast_mcp_search(city)
        )

        weather_results = f"""
DESTINATION: {city}

CURRENT WEATHER:
{weather_data}

WEATHER FORECAST:
{forecast_data}
"""

    except Exception as e:

        weather_results = (
            f"Weather information unavailable: {str(e)}"
        )

    return {
        "weather_results": weather_results,
        "messages": [
            AIMessage(content="Weather agent completed.")
        ]
    }


# =========================================================
# BUDGET AGENT
# =========================================================

def budget_agent(state: TravelState):

    print("\n========== BUDGET AGENT ==========\n")

    prompt = f"""
You are a professional travel budget analyst.

USER REQUEST:
{state['user_query']}

TRIP CONSTRAINTS:
{state.get('trip_constraints', {})}

FLIGHT INFORMATION:
{limit_text(state.get('flight_results', ''), 1500)}

HOTEL INFORMATION:
{limit_text(state.get('hotel_results', ''), 1500)}

WEATHER INFORMATION:
{limit_text(state.get('weather_results', ''), 1000)}

YOUR RESPONSIBILITIES:

1. Analyze the user's budget.
2. Identify major travel expenses.
3. Estimate transportation expenses only when possible.
4. Estimate accommodation expenses only when possible.
5. Consider food, local transport and sightseeing.
6. Identify possible budget risks.
7. Suggest ways to save money.
8. Evaluate whether the trip is financially realistic.

IMPORTANT:

- Never present invented prices as verified prices.
- Clearly label estimated expenses.
- If actual prices are unavailable, explain that.
- Do not pretend that an estimated budget is a confirmed quote.
- Do not invent the user's budget if it was not provided.

Return a detailed but understandable budget assessment.
"""

    try:

        response = llm.invoke([
            SystemMessage(
                content="You are an accurate and practical travel budget analyst."
            ),
            HumanMessage(content=prompt)
        ])

        budget_results = response.content

    except Exception as e:

        budget_results = (
            f"Budget analysis unavailable: {str(e)}"
        )

    return {
        "budget_results": budget_results,
        "messages": [
            AIMessage(content="Budget agent completed.")
        ],
        "llm_calls": state.get("llm_calls", 0) + 1
    }


# =========================================================
# ITINERARY AGENT
# =========================================================

def itinerary_agent(state: TravelState):

    print("\n========== ITINERARY AGENT ==========\n")

    previous_itinerary = limit_text(
        state.get("itinerary", ""),
        1500
    )

    feedback = limit_text(
        state.get("human_feedback", ""),
        500
    )

    revision_count = state.get("revision_count", 0)

    # Keep the itinerary prompt compact to reduce Groq token usage.

    flight_info = limit_text(
        state.get("flight_results", "Not available"),
        1000
    )

    hotel_info = limit_text(
        state.get("hotel_results", "Not available"),
        1500
    )

    weather_info = limit_text(
        state.get("weather_results", "Not available"),
        1000
    )

    budget_info = limit_text(
        state.get("budget_results", "Not available"),
        1200
    )

    constraints = state.get("trip_constraints", {})

    prompt = f"""
You are an expert travel itinerary planner.

USER REQUEST:
{state['user_query']}

TRIP CONSTRAINTS:
{json.dumps(constraints, ensure_ascii=False)}

FLIGHT INFORMATION:
{flight_info}

HOTEL INFORMATION:
{hotel_info}

WEATHER INFORMATION:
{weather_info}

BUDGET INFORMATION:
{budget_info}

PREVIOUS ITINERARY:
{previous_itinerary}

USER FEEDBACK FOR REVISION:
{feedback}

REVISION NUMBER:
{revision_count}

YOUR TASK:

Create a practical, well-organized travel itinerary.

Include:

1. Trip overview.
2. Day-wise itinerary.
3. Sightseeing recommendations.
4. Transportation suggestions.
5. Accommodation guidance.
6. Food recommendations.
7. Weather-related suggestions.
8. Budget considerations.
9. Important travel tips.

IMPORTANT ACCURACY RULES:

- Do not invent flight bookings.
- Do not invent hotel reservations.
- Do not invent confirmed prices.
- Do not assume a departure city.
- Do not invent travel dates.
- Clearly distinguish estimates from verified data.
- Do not claim that an activity, hotel or service is booked.
- If information is unavailable, state that clearly.
- Use the supplied research rather than pretending
  unsupported information is verified.

REVISION RULE:

If the user has provided feedback, revise the previous itinerary
according to that feedback.

Do not ignore the user's requested changes.

Create a complete draft suitable for human approval.
"""

    try:

        response = llm.invoke([
            SystemMessage(
                content="You are an expert travel planner. Produce accurate, realistic and useful itineraries."
            ),
            HumanMessage(content=prompt)
        ])

        itinerary = response.content

        if not itinerary or not itinerary.strip():
            raise ValueError(
                "The model returned an empty itinerary."
            )

        approval_request = f"""
Please review the following travel itinerary.

{itinerary}

Approve this itinerary or provide feedback for revision.
"""

        return {
            "itinerary": itinerary,
            "itinerary_error": "",
            "approval_request": approval_request,
            "messages": [
                AIMessage(
                    content="Draft itinerary created for human review."
                )
            ],
            "llm_calls": state.get("llm_calls", 0) + 1
        }

    except Exception as e:

        error_message = str(e)

        print("\nITINERARY GENERATION ERROR:")
        print(error_message)

        return {
            "itinerary": "",
            "itinerary_error": error_message,
            "approval_request": "",
            "messages": [
                AIMessage(
                    content=f"Itinerary generation failed: {error_message}"
                )
            ],
            "llm_calls": state.get("llm_calls", 0) + 1
        }


# =========================================================
# HUMAN APPROVAL AGENT
# =========================================================

def human_approval_agent(state: TravelState):

    print("\n========== HUMAN APPROVAL ==========\n")

    feedback = interrupt({

        "question": "Do you approve this travel itinerary?",

        "draft_itinerary": state.get("itinerary", ""),

        "approval_request": state.get("approval_request", ""),

        "revision_count": state.get("revision_count", 0),

        "expected_response": {
            "approved": True,
            "feedback": "Optional revision feedback"
        }

    })

    approved = bool(
        feedback.get("approved", False)
    )

    human_feedback = feedback.get(
        "feedback",
        ""
    )

    revision_count = state.get(
        "revision_count",
        0
    )

    if not approved:
        revision_count += 1

    return {
        "approved": approved,
        "human_feedback": human_feedback,
        "revision_count": revision_count,
        "messages": [
            AIMessage(
                content=(
                    "Human approved the itinerary."
                    if approved
                    else "Human requested itinerary revisions."
                )
            )
        ]
    }


# =========================================================
# FINAL RESPONSE AGENT
# =========================================================

def final_response_agent(state: TravelState):

    print("\n========== FINAL RESPONSE AGENT ==========\n")

    # Case 1: Itinerary generation failed.

    if (
        state.get("itinerary_error")
        or not state.get("itinerary")
    ):

        final_response = f"""
# Travel Planning Could Not Be Completed

The itinerary generation process failed.

## Error Details

{state.get('itinerary_error', 'No itinerary was generated.')}

No itinerary was created or approved.

Please try again after resolving the generation error.
"""

        return {
            "final_response": final_response,
            "messages": [
                AIMessage(content=final_response)
            ]
        }

    # Case 2: The user did not approve the latest itinerary.

    if not state.get("approved", False):

        final_response = f"""
# Travel Itinerary — Revision Limit Reached

The itinerary was not approved after
{MAX_REVISIONS} revision attempts.

## Latest Draft

{state.get('itinerary', '')}

## Your Last Feedback

{state.get('human_feedback', '')}

The latest draft has not been marked as approved.
You can start another planning request with additional
requirements to continue refining your trip.
"""

        return {
            "final_response": final_response,
            "messages": [
                AIMessage(content=final_response)
            ]
        }

    # Case 3: The user approved the itinerary.
    #
    # Return the exact approved itinerary.
    # Do not call Groq again.
    # Do not rewrite, summarize or modify its content.
    # Do not introduce new hotels, attractions, prices,
    # activities, schedules or travel recommendations.

    final_response = state["itinerary"]

    print("\n========== APPROVED TRAVEL ITINERARY ==========\n")

    print(final_response)

    return {
        "final_response": final_response,
        "messages": [
            AIMessage(content=final_response)
        ]
    }


# =========================================================
# SUPERVISOR ROUTING
# =========================================================

AGENT_ORDER = [
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent"
]


ROUTE_MAP = {
    "flight_agent": "flight_agent",
    "hotel_agent": "hotel_agent",
    "weather_agent": "weather_agent",
    "budget_agent": "budget_agent",
    "itinerary_agent": "itinerary_agent",
    "end": END
}


def route_from_supervisor(state: TravelState):

    if not state.get("guardrail_allowed", False):
        return "end"

    selected = state.get("selected_agents", [])

    for agent in AGENT_ORDER:

        if agent in selected:
            return agent

    return "itinerary_agent"


def route_after_agent(current_agent: str):

    def route(state: TravelState):

        selected = state.get("selected_agents", [])

        current_index = AGENT_ORDER.index(current_agent)

        for next_agent in AGENT_ORDER[current_index + 1:]:

            if next_agent in selected:
                return next_agent

        return "itinerary_agent"

    return route


# =========================================================
# ITINERARY ROUTING
# =========================================================

def route_after_itinerary(state: TravelState):

    # If itinerary generation failed, skip human approval.

    if state.get("itinerary_error"):
        return "final_response"

    if not state.get("itinerary"):
        return "final_response"

    # Only a successfully generated itinerary can be reviewed.

    return "human_approval"


ITINERARY_ROUTE_MAP = {
    "human_approval": "human_approval",
    "final_response": "final_response"
}


# =========================================================
# HUMAN APPROVAL ROUTING
# =========================================================

def route_after_approval(state: TravelState):

    if state.get("approved", False):

        return "final_response"

    if state.get("revision_count", 0) <= MAX_REVISIONS:

        return "itinerary_agent"

    return "final_response"


APPROVAL_ROUTE_MAP = {
    "itinerary_agent": "itinerary_agent",
    "final_response": "final_response"
}


# =========================================================
# BUILD LANGGRAPH WORKFLOW
# =========================================================

def build_graph():

    graph = StateGraph(TravelState)

    # Register agents

    graph.add_node("supervisor", supervisor_agent)

    graph.add_node("flight_agent", flight_agent)

    graph.add_node("hotel_agent", hotel_agent)

    graph.add_node("weather_agent", weather_agent)

    graph.add_node("budget_agent", budget_agent)

    graph.add_node("itinerary_agent", itinerary_agent)

    graph.add_node("human_approval", human_approval_agent)

    graph.add_node("final_response", final_response_agent)

    # Start with supervisor

    graph.add_edge(START, "supervisor")

    # Supervisor selects the first agent

    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        ROUTE_MAP
    )

    # Conditional agent execution

    graph.add_conditional_edges(
        "flight_agent",
        route_after_agent("flight_agent"),
        ROUTE_MAP
    )

    graph.add_conditional_edges(
        "hotel_agent",
        route_after_agent("hotel_agent"),
        ROUTE_MAP
    )

    graph.add_conditional_edges(
        "weather_agent",
        route_after_agent("weather_agent"),
        ROUTE_MAP
    )

    graph.add_conditional_edges(
        "budget_agent",
        route_after_agent("budget_agent"),
        ROUTE_MAP
    )

    # Itinerary generation:
    # Success -> human approval
    # Failure -> final response with error

    graph.add_conditional_edges(
        "itinerary_agent",
        route_after_itinerary,
        ITINERARY_ROUTE_MAP
    )

    # Approved -> final response
    # Rejected -> itinerary revision

    graph.add_conditional_edges(
        "human_approval",
        route_after_approval,
        APPROVAL_ROUTE_MAP
    )

    graph.add_edge(
        "final_response",
        END
    )

    # PostgreSQL checkpointing

    if DATABASE_URL:

        conn = psycopg.connect(
            DATABASE_URL,
            autocommit=True
        )

        checkpointer = PostgresSaver(conn)

        checkpointer.setup()

        return graph.compile(
            checkpointer=checkpointer
        )

    return graph.compile()


# =========================================================
# COMPILE APPLICATION
# =========================================================

app = build_graph()


# =========================================================
# MAIN APPLICATION
# =========================================================

if __name__ == "__main__":

    print("\n========================================")
    print("       JOURNEY GEN AI TRAVEL PLANNER")
    print("========================================\n")

    user_input = input(
        "Enter your travel request: "
    ).strip()

    if not user_input:

        print("Please enter a valid travel request.")

        raise SystemExit(0)

    config = {
        "configurable": {
            "thread_id": str(uuid.uuid4())
        }
    }

    initial_state = {

        "messages": [
            HumanMessage(content=user_input)
        ],

        "user_query": user_input,

        "trip_constraints": {},

        "selected_agents": [],

        "flight_results": "",

        "hotel_results": "",

        "weather_results": "",

        "budget_results": "",

        "itinerary": "",

        "itinerary_error": "",

        "approval_request": "",

        "human_feedback": "",

        "approved": False,

        "revision_count": 0,

        "final_response": "",

        "guardrail_allowed": False,

        "llm_calls": 0
    }

    print("\nStarting travel planning workflow...\n")

    result = app.invoke(
        initial_state,
        config=config
    )

    # Human approval and revision loop

    while "__interrupt__" in result:

        interrupt_data = result["__interrupt__"][0].value

        print("\n========================================")
        print("          ITINERARY FOR REVIEW")
        print("========================================\n")

        print(
            interrupt_data.get(
                "draft_itinerary",
                "No itinerary available."
            )
        )

        print("\n========================================")
        print("          HUMAN APPROVAL")
        print("========================================\n")

        approval = input(
            "Do you approve this itinerary? (yes/no): "
        ).strip().lower()

        approved = approval in [
            "yes",
            "y",
            "approve",
            "approved"
        ]

        feedback = ""

        if not approved:

            feedback = input(
                "\nEnter your feedback or requested changes: "
            ).strip()

            if not feedback:

                feedback = (
                    "Please improve the itinerary and "
                    "make it more practical."
                )

        result = app.invoke(
            Command(
                resume={
                    "approved": approved,
                    "feedback": feedback
                }
            ),
            config=config
        )

    # Final output

    print("\n========================================")
    print("             FINAL RESPONSE")
    print("========================================\n")

    print(
        result.get(
            "final_response",
            "No final response was generated."
        )
    )

    print("\n========================================")

    print(
        "\nTotal LLM Calls:",
        result.get("llm_calls", 0)
    )

    print(
        "Revision Attempts:",
        result.get("revision_count", 0)
    )

    print("========================================\n")
