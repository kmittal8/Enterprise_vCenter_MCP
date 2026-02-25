# Enterprise vCenter MCP — v2

AI-powered vCenter operations assistant for the whole team.
Browser-accessible, always-on, hosted on OCI.

> **v1 (local)** lives in the parent `vCenter_MCP/` folder and requires Claude Desktop + a Mac SSH tunnel.
> This folder is **v2 (enterprise)** — no Claude Desktop, no laptop dependency.

## Architecture

```
Browser → :8501
    ↓
[app container]   Streamlit + LangChain Agent
    │  HTTP/SSE :8080
[mcp_server]      FastMCP + pyVmomi → vCenter

Agent also calls:
  OCI GenAI (ap-hyderabad-1)   Cohere Command A + Embed
  OCI PostgreSQL (pgvector)    RAG over runbooks
```

## Quick Start

### 1. Prerequisites
- Docker + Docker Compose on the OCI VM
- OCI PostgreSQL DB system provisioned (see `scripts/deploy_oci.sh`)
- `pgvector` extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- IAM Dynamic Group + Policy for Instance Principal GenAI access (created by deploy script)
- Network connectivity from OCI VM to vCenter on port 443 (pre-established by you)

### 2. Configure
```bash
cp .env.example .env
# Edit .env — set VCENTER_*, COMPARTMENT_ID, PG_CONNECTION_STRING
```

### 3. Add the Oracle logo
```bash
cp /path/to/oracle_logo.png app/assets/oracle_logo.png
```

### 4. Start
```bash
docker-compose up -d
docker-compose ps        # mcp_server → healthy, app → running
```

### 5. Ingest runbooks
```bash
# Drop PDFs or Markdown files into runbooks/
./scripts/ingest_docs.sh
```

### 6. Open the UI
```
http://<your-vm-public-ip>:8501
```

## Project Structure

```
Enterprise_vCenter_MCP/
├── docker-compose.yml          — multi-container orchestration
├── .env.example                — copy to .env, fill in credentials
├── plan_v1.html                — implementation plan (open in browser)
│
├── mcp_server/
│   ├── server.py               — FastMCP, 13 vCenter tools, SSE transport
│   ├── Dockerfile
│   └── requirements.txt
│
├── app/
│   ├── streamlit_app.py        — chat UI (Oracle logo in sidebar)
│   ├── agent.py                — LangGraph ReAct agent
│   ├── config.py               — all settings from env vars
│   ├── oci_llm.py              — OCI GenAI LLM + embeddings
│   ├── assets/oracle_logo.png  — add manually
│   ├── rag/
│   │   ├── ingest.py           — PDF/MD → OCI PostgreSQL pgvector
│   │   └── retriever.py        — pgvector → LangChain Tool
│   ├── Dockerfile
│   └── requirements.txt
│
├── runbooks/                   — drop PDFs/MDs here, then run ingest
└── scripts/
    ├── deploy_oci.sh           — OCI infra provisioning
    └── ingest_docs.sh          — trigger doc ingest in running container
```

## vCenter Tools (13 total)

| Tool | Description |
|---|---|
| `list_vms` | All VMs — power state, CPU, memory, IP |
| `get_vm_details` | Detailed info for a specific VM |
| `power_on_vm` | Power on a VM |
| `power_off_vm` | Power off (requires confirm=True) |
| `restart_vm` | Restart (requires confirm=True) |
| `list_hosts` | ESXi hosts — state, CPU, memory, model |
| `get_host_performance` | CPU/memory utilisation for a host |
| `list_datastores` | Storage capacity and free space |
| `list_networks` | Network and port group inventory |
| `list_vm_snapshots` | Snapshots for a VM |
| `create_vm_snapshot` | Create a snapshot |
| `get_inventory_summary` | High-level VM/host/datastore counts |
| `get_alarms` | Triggered alarms |

## Network Connectivity

The OCI VM connects directly to vCenter on port 443.
Pre-establish connectivity before deploying:

| vCenter source | How |
|---|---|
| VMware on-premises | OCI Site-to-Site VPN or FastConnect |
| OCVS | VCN peering |
| AWS VMware (VMC) | AWS–OCI interconnect |
| Azure VMware | Azure–OCI interconnect |

## OCI Auth

On the OCI VM, **Instance Principal** is used — no API keys required.
The VM's identity is granted GenAI access via IAM Dynamic Group + Policy (created by `deploy_oci.sh`).

For local development, set `OCI_AUTH_TYPE=api_key` in `.env` and configure `~/.oci/config`.
