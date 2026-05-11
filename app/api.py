"""
FastAPI backend — bridges React UI to MCP server + LangChain agent.

Endpoints:
  GET  /api/summary       → get_inventory_summary
  GET  /api/vms           → list_vms
  GET  /api/hosts         → list_hosts
  GET  /api/datastores    → list_datastores
  GET  /api/networks      → list_networks
  GET  /api/alarms        → get_alarms
  POST /api/ask           → LangChain agent (natural language)
  GET  /healthz           → liveness probe
"""

import asyncio
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from langchain_mcp_adapters.client import MultiServerMCPClient

from agent import build_agent, _invoke_agent
from config import MCP_SERVER_URL

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="vCenter MCP API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared MCP client + agent (built once at startup) ─────────────────────────

_agent = None
_mcp_tools = None


async def _get_client():
    return MultiServerMCPClient({
        "vcenter": {"transport": "sse", "url": MCP_SERVER_URL}
    })


async def _call_tool(tool_name: str, args: dict = {}) -> dict | list:
    """Call a single MCP tool and return parsed JSON result."""
    client = await _get_client()
    tools = await client.get_tools()
    tool = next((t for t in tools if t.name == tool_name), None)
    if not tool:
        raise HTTPException(status_code=503, detail=f"MCP tool '{tool_name}' not found")
    raw = await tool.ainvoke(args)
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return {"raw": str(raw)}


@app.on_event("startup")
async def startup():
    global _agent, _mcp_tools
    try:
        client = await _get_client()
        _mcp_tools = await client.get_tools()
        _agent = build_agent(_mcp_tools)
        log.info("Agent ready. %d MCP tools loaded.", len(_mcp_tools))
    except Exception as exc:
        log.warning("Agent startup failed (MCP server may not be ready): %s", exc)


# ── Data endpoints ─────────────────────────────────────────────────────────────

@app.get("/healthz")
async def health():
    return {"status": "ok", "mcp_url": MCP_SERVER_URL}


@app.get("/api/summary")
async def get_summary():
    return await _call_tool("get_inventory_summary")


@app.get("/api/vms")
async def get_vms():
    return await _call_tool("list_vms")


@app.get("/api/hosts")
async def get_hosts():
    return await _call_tool("list_hosts")


@app.get("/api/datastores")
async def get_datastores():
    return await _call_tool("list_datastores")


@app.get("/api/networks")
async def get_networks():
    return await _call_tool("list_networks")


@app.get("/api/alarms")
async def get_alarms():
    return await _call_tool("get_alarms")


@app.get("/api/host/{host_name}/performance")
async def get_host_perf(host_name: str):
    return await _call_tool("get_host_performance", {"host_name": host_name})


@app.get("/api/vm/{vm_name}/snapshots")
async def get_snapshots(vm_name: str):
    return await _call_tool("list_vm_snapshots", {"vm_name": vm_name})


# ── AI Ask endpoint ────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    message: str
    history: list[tuple[str, str]] = []


@app.post("/api/ask")
async def ask(req: AskRequest):
    if not _agent:
        raise HTTPException(status_code=503, detail="Agent not ready — MCP server may still be starting")
    try:
        answer = await _invoke_agent(_agent, req.message, req.history)
        return {"answer": answer}
    except Exception as exc:
        log.error("Agent error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Serve React build (production) ────────────────────────────────────────────
# React build output goes to /app/ui_dist (mounted or COPY'd at build time).
# In dev, React runs on Vite :5173 and proxies /api to this server.

import os
UI_DIST = "/app/ui_dist"
if os.path.isdir(UI_DIST):
    app.mount("/assets", StaticFiles(directory=f"{UI_DIST}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        return FileResponse(f"{UI_DIST}/index.html")
