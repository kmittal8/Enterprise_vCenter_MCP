# Enterprise vCenter MCP — Oracle Cloud Edition

> **AI-powered VMware vCenter operations assistant — browser-accessible, always-on, 100% Oracle Cloud.**

Chat with your vCenter environment in plain English from any browser. No Claude Desktop. No laptop dependency. Powered entirely by OCI GenAI, deployed on OCI Compute in the same VCN as your OCVS SDDC.

---

## How It Differs from the Claude Desktop Version (v1)

| | v1 — Claude Desktop | v2 — This Project (Oracle Cloud) |
|---|---|---|
| **AI Provider** | Anthropic Claude | OCI GenAI — Cohere Command A |
| **MCP Transport** | stdio (local pipe) | HTTP/SSE (Docker-to-Docker) |
| **MCP Client** | Claude Desktop (built-in) | `langchain-mcp-adapters` |
| **Runs on** | Mac laptop only | OCI VM, always-on |
| **Access** | Claude Desktop app | Any browser via `:8501` |
| **vCenter access** | SSH tunnel from Mac | Direct VCN routing (same OCI VCN as OCVS) |
| **RAG / Runbooks** | No | Yes — pgvector Docker container |
| **Multi-user** | No | Yes — Streamlit multi-session |
| **Data sovereignty** | Leaves OCI → Anthropic | Stays within OCI |

---

## Architecture

```
Browser :8501
    │  HTTPS
    ▼
┌────────────────────────────────────────────────────────┐
│  OCI VM — ap-melbourne-1  (Docker bridge: vcenter_net) │
│                                                         │
│  ┌─────────────────┐  SSE :8080  ┌──────────────────┐  │
│  │   vcenter_app   │ ──────────► │ vcenter_mcp_server│  │
│  │  Streamlit UI   │ ◄────────── │ FastMCP + pyVmomi │  │
│  │  LangGraph ReAct│             │ 13 vCenter tools  │  │
│  │  LangChain      │             └────────┬─────────┘  │
│  └────────┬────────┘                      │ HTTPS :443  │
│           │ SQL :5432                      ▼             │
│  ┌────────▼────────┐            [ vCenter — OCVS SDDC ] │
│  │ vcenter_postgres│            [ Same OCI VCN — direct]│
│  │ pgvector:pg16   │                                     │
│  └─────────────────┘                                     │
└────────────────────────────────────────────────────────┘
    │
    ▼  HTTPS (OCI GenAI API)
[ OCI GenAI — ap-hyderabad-1 ]
  Cohere Command A  (LLM)
  Cohere Embed Multilingual  (embeddings)
```

---

## What's MCP Here?

**MCP Server** (`mcp_server/server.py`)
- Runs in the `vcenter_mcp_server` container on port 8080
- Uses **FastMCP** with **HTTP/SSE transport** (not stdio)
- Wraps 13 pyVmomi vCenter API calls as callable "tools"
- Waits for SSE connections from the app container

**MCP Client** (`app/agent.py`)
- Runs inside the `vcenter_app` container
- Uses `langchain-mcp-adapters` `MultiServerMCPClient`
- On startup: connects to `http://mcp_server:8080/sse`, fetches all 13 tool schemas
- Converts them to LangChain tools and passes them to the LangGraph ReAct agent
- The LLM decides which tool to call based on tool descriptions — no vCenter logic in the app

---

## Docker — 3 Containers

| Container | Image | Port | Purpose |
|---|---|---|---|
| `vcenter_postgres` | `pgvector/pgvector:pg16` | 5432 (internal) | Vector store for RAG over runbooks |
| `vcenter_mcp_server` | built from `mcp_server/` | 8080 | MCP server — 13 vCenter tools via pyVmomi |
| `vcenter_app` | built from `app/` | **8501** | Streamlit UI + LangGraph agent + RAG |

Start order: `vcenter_postgres` → healthy → `vcenter_mcp_server` → healthy → `vcenter_app` starts.

---

## vCenter Tools (13 total)

| Tool | Description |
|---|---|
| `list_vms` | All VMs — power state, CPU, memory, IP |
| `get_vm_details` | Detailed info for a specific VM |
| `power_on_vm` | Power on a VM |
| `power_off_vm` | Power off (requires `confirm=True`) |
| `restart_vm` | Restart (requires `confirm=True`) |
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
├── .env.example                copy → .env, fill in secrets (never committed)
├── plan_v1.html                original planning doc
├── plan_v2.html                full architecture explainer (open in browser)
│
├── mcp_server/
│   ├── server.py               MCP server — 13 vCenter tools, FastMCP SSE :8080
│   ├── Dockerfile              Python 3.12-slim
│   └── requirements.txt
│
├── app/
│   ├── streamlit_app.py        Entry point — Streamlit chat UI
│   ├── agent.py                LangGraph ReAct agent, MCP client, tool assembly
│   ├── oci_llm.py              OCI GenAI LLM (Cohere Command A) + embeddings
│   ├── config.py               All settings read from environment variables
│   ├── assets/
│   │   └── oracle_logo.png     Sidebar logo
│   ├── rag/
│   │   ├── ingest.py           PDF/MD → chunk → embed → pgvector pipeline
│   │   └── retriever.py        pgvector similarity search → LangChain Tool
│   ├── Dockerfile
│   └── requirements.txt
│
├── runbooks/                   Drop PDF/MD operational docs here, then ingest
└── scripts/
    ├── deploy_oci.sh           Provision OCI: NSG/SL, VM, IAM Dynamic Group
    ├── setup_vm.sh             Bootstrap VM: Docker CE, Compose, firewall, up
    ├── ingest_docs.sh          Run ingest pipeline inside running app container
    └── pg_init.sql             CREATE EXTENSION vector — runs on first PG start
```

---

## Deployment

### 1. Prerequisites
- OCI CLI configured (`~/.oci/config`)
- SSH key at `~/.ssh/id_rsa.pub`
- Existing OCI VCN in the same region as your OCVS SDDC

### 2. Provision OCI infrastructure
```bash
# Edit the EXISTING RESOURCES section at the top with your OCIDs
vi scripts/deploy_oci.sh
chmod +x scripts/deploy_oci.sh && ./scripts/deploy_oci.sh
```
Creates: security list (ports 22 + 8501), compute VM, IAM Dynamic Group + Policy.

### 3. Configure environment
```bash
cp .env.example .env
# Fill in: VCENTER_*, COMPARTMENT_ID, PG_PASSWORD, PG_CONNECTION_STRING
```

### 4. Bootstrap the VM
```bash
# Copy repo to VM
scp -r . opc@<VM_IP>:~/Enterprise_vCenter_MCP

# SSH in and run bootstrap
ssh opc@<VM_IP>
bash ~/Enterprise_vCenter_MCP/scripts/setup_vm.sh
```
Installs Docker CE, opens firewall port 8501, runs `docker compose up -d`.

### 5. Ingest runbooks (optional)
```bash
# Drop PDFs/Markdown into runbooks/ then:
./scripts/ingest_docs.sh
```

### 6. Access
```
http://<VM_IP>:8501
```

---

## OCI Auth

On the VM, **Instance Principal** auth is used — no API keys stored anywhere.
The VM's identity is granted GenAI access via IAM Dynamic Group + Policy (created by `deploy_oci.sh`).

For local development: set `OCI_AUTH_TYPE=api_key` in `.env` and configure `~/.oci/config`.

---

## vCenter Connectivity

The OCI VM is deployed into the **same VCN as the OCVS SDDC** — vCenter is reachable over the VCN's internal routing with no VPN or FastConnect needed.

For other vCenter locations:

| vCenter source | Connectivity |
|---|---|
| OCVS (same region) | VCN-internal routing (this project's default) |
| On-premises | OCI Site-to-Site VPN or FastConnect |
| AWS VMware (VMC) | AWS–OCI interconnect |
| Azure VMware | Azure–OCI interconnect |
