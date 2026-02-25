"""
Central configuration — all settings sourced from environment variables.
Secrets (passwords, connection strings) must never be hardcoded here.
"""

import os

# ── MCP server (Docker internal network) ──────────────────────────────────────
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://mcp_server:8080/sse")

# ── OCI GenAI ─────────────────────────────────────────────────────────────────
OCI_GENAI_REGION   = os.environ.get("OCI_GENAI_REGION", "ap-hyderabad-1")
OCI_GENAI_ENDPOINT = os.environ.get(
    "OCI_GENAI_ENDPOINT",
    f"https://inference.generativeai.{OCI_GENAI_REGION}.oci.oraclecloud.com",
)
# Required — fail fast at startup rather than at first LLM call
COMPARTMENT_ID = os.environ["COMPARTMENT_ID"]

# ── Model IDs ─────────────────────────────────────────────────────────────────
LLM_MODEL_ID   = os.environ.get("LLM_MODEL_ID",   "cohere.command-a-03-2025")
EMBED_MODEL_ID = os.environ.get("EMBED_MODEL_ID", "cohere.embed-multilingual-image-v3.0")

# ── LLM tuning ────────────────────────────────────────────────────────────────
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0"))
LLM_MAX_TOKENS  = int(os.environ.get("LLM_MAX_TOKENS", "2048"))

# ── OCI Auth ──────────────────────────────────────────────────────────────────
# On OCI Compute VM:  leave unset or set to "instance_principal"
# Local dev with ~/.oci/config:  set OCI_AUTH_TYPE=api_key
OCI_AUTH_TYPE = os.environ.get("OCI_AUTH_TYPE", "instance_principal")

# ── Vector store — OCI PostgreSQL + pgvector ──────────────────────────────────
# Format: postgresql+psycopg://user:password@host:5432/dbname
PG_CONNECTION_STRING = os.environ.get("PG_CONNECTION_STRING", "")
PG_COLLECTION_NAME   = os.environ.get("PG_COLLECTION_NAME", "vcenter_runbooks")

# ── RAG tuning ────────────────────────────────────────────────────────────────
RAG_TOP_K         = int(os.environ.get("RAG_TOP_K", "4"))
RAG_CHUNK_SIZE    = int(os.environ.get("RAG_CHUNK_SIZE", "800"))
RAG_CHUNK_OVERLAP = int(os.environ.get("RAG_CHUNK_OVERLAP", "100"))

# ── Runbooks directory (mounted into container) ───────────────────────────────
RUNBOOKS_DIR = os.environ.get("RUNBOOKS_DIR", "/runbooks")

# ── Streamlit UI ──────────────────────────────────────────────────────────────
APP_TITLE        = "vCenter AI Assistant"
MAX_CHAT_HISTORY = int(os.environ.get("MAX_CHAT_HISTORY", "20"))
