
import os
import sys
import asyncio
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_groq import ChatGroq


# =========================================================
# ENVIRONMENT CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

# Load .env without overriding environment variables
# already supplied by the operating system.
load_dotenv(BASE_DIR / ".env", override=False)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
AVIATION_STACK_API_KEY = os.getenv("AVIATIONSTACK_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


def validate_environment():
    """Check required environment variables without exposing values."""

    required = {
        "TAVILY_API_KEY": TAVILY_API_KEY,
        "AVIATIONSTACK_API_KEY": AVIATION_STACK_API_KEY,
        "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY,
        "GROQ_API_KEY": GROQ_API_KEY,
    }

    missing = [
        name for name, value in required.items()
        if not value
    ]

    if missing:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing)
        )


# =========================================================
# MCP SERVER PATHS
# =========================================================

AVIATION_PYTHON = (
    BASE_DIR
    / "aviationstack-mcp"
    / ".venv"
    / "Scripts"
    / "python.exe"
)

WEATHER_SERVER = BASE_DIR / "custom_weather_mcp_server.py"

# The main project's Python environment runs the weather server.
WEATHER_PYTHON = Path(sys.executable)


def validate_server_files():
    """Check that the required MCP server files exist."""

    if not AVIATION_PYTHON.is_file():
        raise FileNotFoundError(
            f"AviationStack Python executable not found: {AVIATION_PYTHON}"
        )

    if not WEATHER_SERVER.is_file():
        raise FileNotFoundError(
            f"Weather MCP server file not found: {WEATHER_SERVER}"
        )


# =========================================================
# MCP CLIENT CONFIGURATION
# =========================================================

def create_mcp_client():

    validate_environment()
    validate_server_files()

    tavily_url = (
        "https://mcp.tavily.com/mcp/"
        f"?tavilyApiKey={quote(TAVILY_API_KEY, safe='')}"
    )

    return MultiServerMCPClient(
        {
            "tavily": {
                "transport": "streamable_http",
                "url": tavily_url,
            },

            "aviationstack": {
                "transport": "stdio",
                "command": str(AVIATION_PYTHON),
                "args": [
                    "-m",
                    "aviationstack_mcp",
                ],
                "env": {
                    "AVIATION_STACK_API_KEY": AVIATION_STACK_API_KEY,
                },
            },

            "weather": {
                "transport": "stdio",
                "command": str(WEATHER_PYTHON),
                "args": [
                    str(WEATHER_SERVER),
                ],
                "env": {
                    "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY,
                },
            },
        }
    )


client = create_mcp_client()


# =========================================================
# CACHED MCP TOOLS
# =========================================================

all_tools = {}
search_tool = None
aviation_tools = {}
weather_tool = None
forecast_tool = None

_initialization_lock = asyncio.Lock()


async def initialize_mcp():
    """
    Discover MCP tools once and cache them.

    The cached dictionary is shared by all MCP helper functions.
    """

    global all_tools
    global search_tool
    global aviation_tools
    global weather_tool
    global forecast_tool

    if all_tools:
        return

    async with _initialization_lock:

        if all_tools:
            return

        print("\nInitializing MCP tools...")

        tools = await client.get_tools()

        if not tools:
            raise RuntimeError(
                "No MCP tools were discovered from the configured servers."
            )

        discovered_tools = {
            tool.name: tool
            for tool in tools
        }

        required_tools = [
            "tavily_search",
            "get_current_weather",
            "get_forecast",
            "list_airports",
            "list_airlines",
        ]

        missing = [
            name for name in required_tools
            if name not in discovered_tools
        ]

        if missing:
            raise RuntimeError(
                "Required MCP tools are missing: "
                + ", ".join(missing)
            )

        all_tools = discovered_tools

        search_tool = all_tools["tavily_search"]

        weather_tool = all_tools["get_current_weather"]
        forecast_tool = all_tools["get_forecast"]

        aviation_tools = {
            name: tool
            for name, tool in all_tools.items()
            if name not in {
                "tavily_search",
                "get_current_weather",
                "get_forecast",
            }
        }

        print(
            f"MCP initialization successful. "
            f"Discovered {len(all_tools)} tools."
        )


async def initialize_weather_tools():
    """Initialize and validate weather tools."""

    await initialize_mcp()

    if weather_tool is None or forecast_tool is None:
        raise RuntimeError(
            "Weather MCP tools are not initialized."
        )


# =========================================================
# GENERIC MCP TOOL INVOCATION
# =========================================================

async def call_mcp_tool(tool_name: str, tool_args: dict = None):
    """
    Invoke a discovered MCP tool using the cached tool dictionary.
    """

    await initialize_mcp()

    tool = all_tools.get(tool_name)

    if tool is None:
        raise RuntimeError(
            f"MCP tool '{tool_name}' was not found."
        )

    try:
        return await tool.ainvoke(tool_args or {})

    except Exception as exc:
        raise RuntimeError(
            f"Error invoking MCP tool '{tool_name}': {exc}"
        ) from exc


# =========================================================
# TAVILY SEARCH
# =========================================================

async def tavily_mcp_search(query: str):
    """Search the web through Tavily MCP."""

    if not query or not query.strip():
        raise ValueError("Tavily search query cannot be empty.")

    return await call_mcp_tool(
        "tavily_search",
        {
            "query": query.strip(),
        },
    )


# =========================================================
# AVIATIONSTACK MCP
# =========================================================

async def aviation_mcp_call(
    tool_name: str,
    tool_args: dict = None,
):
    """Invoke an AviationStack MCP tool."""

    await initialize_mcp()

    tool = aviation_tools.get(tool_name)

    if tool is None:
        raise RuntimeError(
            f"AviationStack tool '{tool_name}' was not found."
        )

    try:
        return await tool.ainvoke(tool_args or {})

    except Exception as exc:
        raise RuntimeError(
            f"AviationStack tool '{tool_name}' failed: {exc}"
        ) from exc


async def get_airports():
    """Retrieve airport information."""

    return await aviation_mcp_call("list_airports")


async def get_airlines():
    """Retrieve airline information."""

    return await aviation_mcp_call("list_airlines")


# =========================================================
# CURRENT WEATHER
# =========================================================

async def weather_mcp_search(city: str):
    """Retrieve current weather information."""

    if not city or not city.strip():
        raise ValueError("Weather city cannot be empty.")

    await initialize_weather_tools()

    return await call_mcp_tool(
        "get_current_weather",
        {
            "city": city.strip(),
        },
    )


# =========================================================
# WEATHER FORECAST
# =========================================================

async def forecast_mcp_search(city: str):
    """Retrieve weather forecast information."""

    if not city or not city.strip():
        raise ValueError("Forecast city cannot be empty.")

    await initialize_weather_tools()

    return await call_mcp_tool(
        "get_forecast",
        {
            "city": city.strip(),
        },
    )


# =========================================================
# GROQ LANGUAGE MODEL
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0,
)


# =========================================================
# DESTINATION EXTRACTION
# =========================================================

def extract_destination(query: str):
    """
    Extract the destination city or country from a travel query.

    This function is intentionally synchronous because main.py
    currently calls it without await.
    """

    if not query or not query.strip():
        raise ValueError("Travel query cannot be empty.")

    prompt = f"""
Extract only the destination city or country from the
following travel query.

Return only the destination name.
Do not provide explanations.

Travel query:
{query}
"""

    try:
        response = llm.invoke(prompt)
        destination = response.content.strip()

        if not destination:
            raise ValueError(
                "The language model returned an empty destination."
            )

        return destination

    except Exception as exc:
        raise RuntimeError(
            f"Destination extraction failed: {exc}"
        ) from exc


# =========================================================
# MCP CONNECTION TEST
# =========================================================

async def main():

    print("\nInitializing MCP servers...\n")

    await initialize_mcp()

    print("\nAvailable MCP tools:\n")

    for tool_name in sorted(all_tools):
        print(tool_name)

    print("\nAll required MCP tools initialized successfully.")


if __name__ == "__main__":
    asyncio.run(main())
