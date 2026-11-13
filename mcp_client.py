
import os
import asyncio

from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_groq import ChatGroq

# Load environment variables
load_dotenv(override=True)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
AVIATION_STACK_API_KEY = os.getenv("AVIATIONSTACK_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")


# =========================================================
# MCP CLIENT CONFIGURATION
# =========================================================

client = MultiServerMCPClient(
    {
        # -------------------------------------------------
        # TAVILY MCP SERVER
        # -------------------------------------------------

        "tavily": {
            "transport": "streamable_http",
            "url": f"https://mcp.tavily.com/mcp/?tavilyApiKey={TAVILY_API_KEY}"
        },

        # -------------------------------------------------
        # AVIATIONSTACK MCP SERVER
        # -------------------------------------------------

        "aviationstack": {
            "transport": "stdio",

            "command": r"C:\Users\varsh\Journey_Gen_AI_MultiAgent_System_with_MCP\aviationstack-mcp\.venv\Scripts\python.exe",

            "args": [
                "-m",
                "aviationstack_mcp"
            ],

            "env": {
                "AVIATION_STACK_API_KEY": AVIATION_STACK_API_KEY
            }
        },

        # -------------------------------------------------
        # CUSTOM WEATHER MCP SERVER
        # -------------------------------------------------

        "weather": {
            "transport": "stdio",

            "command": r"C:\Users\varsh\Journey_Gen_AI_MultiAgent_System_with_MCP\langgraph_env3\Scripts\python.exe",

            "args": [
                r"C:\Users\varsh\Journey_Gen_AI_MultiAgent_System_with_MCP\custom_weather_mcp_server.py"
            ],

            "env": {
                "OPENWEATHER_API_KEY": OPENWEATHER_API_KEY
            }
        }
    }
)


# =========================================================
# MCP TOOL VARIABLES
# =========================================================

search_tool = None

aviation_tools = {}

weather_tool = None

forecast_tool = None


# =========================================================
# INITIALIZE MCP TOOLS
# =========================================================

async def initialize_mcp():

    global search_tool
    global aviation_tools

    if search_tool is not None and aviation_tools:
        return

    tools = await client.get_tools()

    print("\nAvailable MCP Tools:\n")

    for tool in tools:
        print(tool.name)

    search_tool = next(
        (
            tool
            for tool in tools
            if tool.name == "tavily_search"
        ),
        None
    )

    if search_tool is None:
        raise RuntimeError(
            "Tavily search tool was not found in the MCP server."
        )

    aviation_tools = {
        tool.name: tool
        for tool in tools
        if tool.name not in [
            "tavily_search",
            "get_current_weather",
            "get_forecast"
        ]
    }


# =========================================================
# TAVILY SEARCH
# =========================================================

async def tavily_mcp_search(query: str):

    await initialize_mcp()

    result = await search_tool.ainvoke(
        {
            "query": query
        }
    )

    return result


# =========================================================
# AVIATIONSTACK MCP CALL
# =========================================================

async def aviation_mcp_call(
    tool_name: str,
    tool_args: dict = None
):

    tools = await client.get_tools()

    tool = next(
        (
            t
            for t in tools
            if t.name == tool_name
        ),
        None
    )

    if tool is None:
        return f"AviationStack tool '{tool_name}' was not found."

    result = await tool.ainvoke(
        tool_args or {}
    )

    return result


# =========================================================
# GET AIRPORTS
# =========================================================

async def get_airports():

    await initialize_mcp()

    tool = aviation_tools.get("list_airports")

    if not tool:
        return "Airport tool unavailable"

    result = await tool.ainvoke({})

    return result


# =========================================================
# GET AIRLINES
# =========================================================

async def get_airlines():

    await initialize_mcp()

    tool = aviation_tools.get("list_airlines")

    if not tool:
        return "Airline tool unavailable"

    result = await tool.ainvoke({})

    return result


# =========================================================
# INITIALIZE WEATHER TOOLS
# =========================================================

async def initialize_weather_tools():

    global weather_tool
    global forecast_tool

    if weather_tool is not None and forecast_tool is not None:
        return

    tools = await client.get_tools()

    weather_tool = next(
        (
            t
            for t in tools
            if t.name == "get_current_weather"
        ),
        None
    )

    forecast_tool = next(
        (
            t
            for t in tools
            if t.name == "get_forecast"
        ),
        None
    )

    if weather_tool is None:
        raise RuntimeError(
            "Current weather tool was not found."
        )

    if forecast_tool is None:
        raise RuntimeError(
            "Weather forecast tool was not found."
        )


# =========================================================
# CURRENT WEATHER SEARCH
# =========================================================

async def weather_mcp_search(city: str):

    await initialize_weather_tools()

    result = await weather_tool.ainvoke(
        {
            "city": city
        }
    )

    return result


# =========================================================
# WEATHER FORECAST SEARCH
# =========================================================

async def forecast_mcp_search(city: str):

    await initialize_weather_tools()

    result = await forecast_tool.ainvoke(
        {
            "city": city
        }
    )

    return result


# =========================================================
# GROQ LLM
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0
)


# =========================================================
# DESTINATION EXTRACTOR
# =========================================================

def extract_destination(query: str):

    prompt = f"""
    Extract only the destination city or country.

    Query:
    {query}

    Return only destination name.
    """

    response = llm.invoke(prompt)

    return response.content.strip()


# =========================================================
# TEST MCP CONNECTION
# =========================================================

async def main():

    print("\nInitializing MCP servers...\n")

    tools = await client.get_tools()

    print("MCP servers connected successfully!")

    print("\nAvailable MCP Tools:\n")

    for tool in tools:
        print(tool.name)


if __name__ == "__main__":

    asyncio.run(main())
