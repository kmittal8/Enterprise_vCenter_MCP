# vCenter MCP Server

VMware vCenter MCP (Model Context Protocol) Server running on OCI — lets Claude AI query and manage vSphere infrastructure in real time.

## What it does

Exposes 26 vSphere tools directly to Claude:
- List/inspect VMs, hosts, datastores, networks
- Power on/off/restart VMs
- Create/delete snapshots
- Get performance metrics (CPU, memory, disk)
- Bulk operations, alerts, events

## Architecture

```
Claude (your Mac)
      ↓  HTTP/SSE  port 8080
OCI VM (158.179.16.118)
      ↓  Docker
 vSphere MCP Server
      ↓  pyVmomi
 vCenter
```

## Setup on OCI VM

```bash
# 1. Install Docker
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker opc

# 2. Clone this repo
git clone https://github.com/kmittal8/vCenter_MCP.git
cd vCenter_MCP

# 3. Configure credentials
cp .env.example .env
vi .env   # fill in your vCenter password + ADB details

# 4. Start the server
docker compose up -d

# 5. Check logs
docker compose logs -f
```

## Claude Code Integration

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vcenter": {
      "url": "http://158.179.16.118:8080/sse"
    }
  }
}
```

## OCI VM Details

- **IP**: 158.179.16.118
- **Region**: ap-melbourne-1
- **SSH**: `ssh opc@158.179.16.118`
- **MCP URL**: `http://158.179.16.118:8080/sse`
