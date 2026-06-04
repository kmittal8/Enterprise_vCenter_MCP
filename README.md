# Enterprise vCenter MCP — 

> **AI-powered VMware vCenter operations dashboard — React UI, FastAPI backend**

Manage your vCenter environment from any browser. Built on the **REACT**. Powered by OCI GenAI, deployed on OCI Compute in the same VCN as your OCVS SDDC.

---

## Version History

| Version | UI | Key Change |
|---|---|---|
| v1 | Claude Desktop (stdio) | Local Mac only, Claude Anthropic LLM |
| v2 | Streamlit | OCI VM, OCI GenAI (Cohere), Docker/SSE |
| **v3 (current)** | **React — shell** | **FastAPI backend replaces Streamlit** |

---

## Architecture

```
Browser :8000  (React —  shell)
    │  fetch /api/*
    ▼
┌────────────────────────────────────────────────────────┐
│  OCI VM — ap-sydney-1  (Docker bridge: vcenter_net)    │
│                                                         │
│  ┌──────────────────────┐  SSE :8080  ┌─────────────┐  │
│  │     vcenter_app      │ ──────────► │ vcenter_mcp │  │
│  │  FastAPI :8000       │ ◄────────── │ FastMCP +   │  │
│  │  LangGraph ReAct     │             │ pyVmomi     │  │
│  │  LangChain agent     │             │ 13 tools    │  │
│  │  serves React build  │             └──────┬──────┘  │
│  └──────────┬───────────┘                    │ :443    │
│             │ SQL :5432              [ vCenter — OCVS ] │
│  ┌──────────▼───────────┐           [ Same OCI VCN   ] │
│  │  vcenter_postgres    │                               │
│  │  pgvector:pg16       │                               │
│  └──────────────────────┘                               │
└────────────────────────────────────────────────────────┘
    │  HTTPS
[ OCI GenAI — ap-hyderabad-1 ]
  Cohere Command A  (LLM)
  Cohere Embed Multilingual  (embeddings)
```

---

## UI —  Shell (Ally Avatar-3)

The React dashboard inherits the **AllyOCI v20 design system** — deep navy ops-console aesthetic.

| Page | Description |
|---|---|
| **Home** | Summary tiles — VM count, hosts, alarms, MCP tools |
| **Command Center** | 6-tab live dashboard |
| **AI Search** | Grounded local search over vSphere datasets |
| **Palette** | AllyOCI colour tokens |

### Command Center tabs

| Tab | Live API endpoint | Data |
|---|---|---|
| VM Estate | `GET /api/vms` | All VMs — power state, CPU, mem, tools |
| Compute / Hosts | `GET /api/hosts` | ESXi hosts — CPU%, mem%, VM count |
| Storage | `GET /api/datastores` | Datastores — capacity, free, type |
| Network | `GET /api/networks` | Port groups, VLAN, DVS |
| Alarms | `GET /api/alarms` | Active vSphere alarms |
| MCP Dashboard | static | MCP server health + tool telemetry |

---

## FastAPI Backend (`app/api.py`)

Replaces Streamlit. Bridges React UI ↔ MCP server ↔ vCenter.

| Endpoint | MCP Tool | Description |
|---|---|---|
| `GET /api/summary` | `get_inventory_summary` | High-level counts |
| `GET /api/vms` | `list_vms` | All VM inventory |
| `GET /api/hosts` | `list_hosts` | All ESXi hosts |
| `GET /api/datastores` | `list_datastores` | Storage |
| `GET /api/networks` | `list_networks` | Networks |
| `GET /api/alarms` | `get_alarms` | Active alarms |
| `GET /api/host/{name}/performance` | `get_host_performance` | Host CPU/mem |
| `GET /api/vm/{name}/snapshots` | `list_vm_snapshots` | VM snapshots |
| `POST /api/ask` | LangChain agent | Natural language → vCenter + RAG |
| `GET /healthz` | — | Liveness probe |

In production, FastAPI also serves the React build from `/app/ui_dist`.

---

## Docker — 3 Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `vcenter_postgres` | `pgvector/pgvector:pg16` | 5432 (internal) | pgvector RAG store |
| `vcenter_mcp_server` | built from `mcp_server/` | 8080 | 13 vCenter MCP tools |
| `vcenter_app` | built from `app/` | **8000** | FastAPI + React build |

Start order: postgres → healthy → mcp_server → healthy → app.

---

## vCenter Tools (13 total)

| Tool | Description |
|---|---|
| `list_vms` | All VMs — power state, CPU, memory, IP |
| `get_vm_details` | Detailed info for a specific VM |
| `power_on_vm` | Power on a VM |
| `power_off_vm` | Power off (`confirm=True` required) |
| `restart_vm` | Restart (`confirm=True` required) |
| `list_hosts` | ESXi hosts — state, CPU, memory, model |
| `get_host_performance` | CPU/memory utilisation for a host |
| `list_datastores` | Storage capacity and free space |
| `list_networks` | Network and port group inventory |
| `list_vm_snapshots` | Snapshots for a VM |
| `create_vm_snapshot` | Create a snapshot |
| `get_inventory_summary` | High-level VM/host/datastore counts |
| `get_alarms` | Triggered alarms |

---

## Project Structure

```
Enterprise_vCenter_MCP/
├── docker-compose.yml          3-container orchestration
├── .env.example                copy → .env, fill in secrets
│
├── mcp_server/
│   ├── server.py               13 vCenter tools, FastMCP SSE :8080
│   ├── Dockerfile
│   └── requirements.txt
│
├── app/
│   ├── api.py                  FastAPI backend — REST endpoints + serves React
│   ├── agent.py                LangGraph ReAct agent + MCP client
│   ├── oci_llm.py              OCI GenAI (Cohere Command A) + embeddings
│   ├── config.py               All settings from environment variables
│   ├── streamlit_app.py        Legacy Streamlit UI (kept for reference)
│   ├── rag/
│   │   ├── ingest.py           PDF/MD → chunk → embed → pgvector
│   │   └── retriever.py        pgvector search → LangChain Tool
│   ├── Dockerfile
│   └── requirements.txt
│
├── ui/                         React —  shell
│   ├── vcenter-dashboard.jsx   Main component — live data +  design
│   ├── vite.config.js          Proxy /api → :8000 in dev; build → app/ui_dist
│   ├── src/
│   │   └── App.jsx             Mounts VCenterDashboard
│   └── package.json
│
├── runbooks/                   Drop PDF/MD ops docs here, then ingest
└── scripts/
    ├── deploy_oci.sh           Provision OCI: NSG, VM, IAM
    ├── setup_vm.sh             Bootstrap VM: Docker, Compose, firewall
    ├── ingest_docs.sh          Run RAG ingest pipeline
    └── pg_init.sql             CREATE EXTENSION vector
```

---

## Deployment

### 1. Prerequisites
- OCI CLI configured (`~/.oci/config`) or run on OCI VM with instance principal
- Docker + Docker Compose on the VM
- OCI VM in same VCN as OCVS SDDC (port 443 to vCenter)
- OCI GenAI enabled in your compartment (ap-hyderabad-1)

### 2. Clone & configure
```bash
git clone <repo-url>
cd Enterprise_vCenter_MCP
cp .env.example .env
# Fill in: VCENTER_HOST, VCENTER_USERNAME, VCENTER_PASSWORD
#          COMPARTMENT_ID, PG_PASSWORD, PG_CONNECTION_STRING
```

### 3. Build React UI
```bash
cd ui
npm install
npm run build        # outputs to app/ui_dist
cd ..
```

### 4. Start containers
```bash
docker compose up -d --build
```

### 5. Ingest runbooks (optional)
```bash
# Drop PDFs/Markdown into runbooks/ then:
./scripts/ingest_docs.sh
```

### 6. Access
```
http://<VM_IP>:8000
```

---

## Local Development (React + FastAPI)

```bash
# Terminal 1 — FastAPI backend (needs MCP server running)
cd app
pip install -r requirements.txt
uvicorn api:app --reload --port 8000

# Terminal 2 — React dev server (proxies /api → :8000)
cd ui
npm install
npm run dev          # http://localhost:5173
```

---

## OCI Auth

On the VM: **Instance Principal** — no API keys stored anywhere.
Local dev: set `OCI_AUTH_TYPE=api_key` in `.env` + configure `~/.oci/config`.

---

## OCI DevOps Repository

| | |
|---|---|
| **Region** | ap-sydney-1 |
| **Compartment** | OCVS |
| **Project** | vcenter-mcp- |
| **Repo OCID** | `ocid1.devopsrepository.oc1.ap-sydney-1.amaaaaaakwetmsaadwgn4qyhqhojkzbhf3p6hznpspqje5izpdblskmvkrvq` |
