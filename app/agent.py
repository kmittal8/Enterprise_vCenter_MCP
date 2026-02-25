"""
LangChain/LangGraph agent orchestrator.

Combines:
  - vCenter tools via MCP SSE (langchain-mcp-adapters → mcp_server container)
  - RAG tool (search_runbooks → OCI PostgreSQL PGVector)
  - OCI GenAI LLM (Cohere Command A)

Async bridge: Streamlit runs inside a Tornado event loop. nest_asyncio
patches it to allow asyncio.run() calls from synchronous Streamlit callbacks.
"""

import asyncio
import nest_asyncio

# Patch the running event loop BEFORE any async operations.
# Must be at module import time — before Streamlit's Tornado loop interferes.
nest_asyncio.apply()

from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, AIMessage

from oci_llm import build_llm
from rag.retriever import build_rag_tool
from config import MCP_SERVER_URL, MAX_CHAT_HISTORY


SYSTEM_PROMPT = """You are an expert VMware vCenter administrator assistant for the operations team.

You have access to two categories of tools:

1. LIVE vCenter tools — query or act on the vCenter environment in real time:
   - list_vms, get_vm_details, power_on_vm, power_off_vm, restart_vm
   - list_hosts, get_host_performance
   - list_datastores, list_networks
   - list_vm_snapshots, create_vm_snapshot
   - get_inventory_summary, get_alarms

2. RUNBOOK SEARCH tool (search_runbooks) — search operational runbooks, DR procedures,
   troubleshooting guides, SLAs, and documentation.

Decision guide:
  - Current state queries (power status, resource usage, alarms) → vCenter tools
  - Procedure / how-to / policy questions → search_runbooks
  - Combined questions ("what's the DR procedure AND current state of cluster X") → use both

Always:
  - Confirm vm_name precisely before any destructive action (power off / restart)
  - Cite the runbook source when answering from documentation
  - Be concise and direct — this is an ops team, not end users"""


# ── MCP tool retrieval ─────────────────────────────────────────────────────────

async def _get_mcp_tools() -> list:
    """
    Connect to mcp_server via SSE, retrieve all tool schemas, and return them
    as LangChain tools. Called once at agent build time.
    """
    client = MultiServerMCPClient({
        "vcenter": {
            "transport": "sse",
            "url": MCP_SERVER_URL,
        }
    })
    return await client.get_tools()


def get_mcp_tools() -> list:
    """Synchronous wrapper for use in Streamlit's synchronous context."""
    return asyncio.run(_get_mcp_tools())


# ── Agent construction ─────────────────────────────────────────────────────────

def build_agent(mcp_tools: list):
    """
    Build and return a LangGraph ReAct agent.

    Args:
        mcp_tools: LangChain tools retrieved from the MCP server
    Returns:
        Compiled LangGraph agent (CompiledGraph)
    """
    llm      = build_llm()
    rag_tool = build_rag_tool()
    all_tools = mcp_tools + [rag_tool]

    return create_react_agent(
        model=llm,
        tools=all_tools,
        prompt=SYSTEM_PROMPT,
    )


# ── Agent invocation ───────────────────────────────────────────────────────────

async def _invoke_agent(agent, message: str, history: list[tuple[str, str]]) -> str:
    """
    Async agent invocation with chat history.

    Args:
        agent:   Compiled LangGraph agent
        message: Current user message
        history: List of (role, content) tuples — trimmed to MAX_CHAT_HISTORY
    Returns:
        Agent's response string
    """
    messages = []
    for role, content in history[-(MAX_CHAT_HISTORY):]:
        if role == "user":
            messages.append(HumanMessage(content=content))
        else:
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=message))

    result = await agent.ainvoke({"messages": messages})
    # LangGraph returns a messages list; the last entry is the final AI response
    return result["messages"][-1].content


def invoke_agent(agent, message: str, history: list[tuple[str, str]]) -> str:
    """Synchronous wrapper for Streamlit callbacks."""
    return asyncio.run(_invoke_agent(agent, message, history))
