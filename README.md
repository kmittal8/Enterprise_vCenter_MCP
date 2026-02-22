# vCenter MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects Claude AI directly to VMware vSphere — letting you query and manage your vCenter infrastructure through natural language.

## What you can ask Claude

> "List all powered off VMs"
> "How much free space is left on each datastore?"
> "What's the CPU usage on my ESXi hosts?"
> "Create a snapshot of vm-prod-01 before the maintenance window"
> "Are there any active alarms in vCenter?"

## Tools exposed

| Category | Tools |
|---|---|
| VMs | `list_vms`, `get_vm_details`, `power_on_vm`, `power_off_vm`, `restart_vm` |
| Hosts | `list_hosts`, `get_host_performance` |
| Storage | `list_datastores` |
| Network | `list_networks` |
| Snapshots | `list_vm_snapshots`, `create_vm_snapshot` |
| Overview | `get_inventory_summary`, `get_alarms` |

Destructive operations (`power_off_vm`, `restart_vm`) require `confirm=True` — Claude will always ask before executing.

## Architecture

```
Claude (your machine)
      │  HTTP/SSE  port 8080
      ▼
  MCP Server (Docker)
      │  pyVmomi API
      ▼
  vCenter Server
```

## Requirements

- Docker + Docker Compose
- VMware vCenter Server (any version supported by pyVmomi)
- Network access from the Docker host to vCenter

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/kmittal8/vCenter_MCP.git
cd vCenter_MCP
```

### 2. Configure credentials

```bash
cp .env.example .env
```

Edit `.env`:

```env
VCENTER_HOST=vcenter.your-domain.com
VCENTER_USERNAME=administrator@vsphere.local
VCENTER_PASSWORD=your_password_here
VCENTER_PORT=443
VCENTER_SSL_VERIFY=false
```

### 3. Start the server

```bash
docker compose up -d
```

Check it's running:

```bash
docker compose logs -f
```

### 4. Register with Claude

Add to your Claude config file:

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`

**Claude Code** — `~/.claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vcenter": {
      "url": "http://your-server-ip:8080/sse"
    }
  }
}
```

Restart Claude. You should see the vCenter tools available.

## Running on a remote server (e.g. OCI, AWS, Azure)

If your Docker host is a cloud VM, ensure:
- Port `8080` is open in the security group / firewall
- The VM has network access to your vCenter
- Use the VM's public IP in the Claude config URL

## Security notes

- Keep `.env` out of version control (already in `.gitignore`)
- Consider restricting port 8080 to your IP only in production
- Create a read-only vCenter role for the service account if you don't need power operations
