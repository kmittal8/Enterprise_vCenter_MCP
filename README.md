# vCenter MCP Server — Mac Local Version 1

A Model Context Protocol (MCP) server that connects **Claude Desktop** to VMware vCenter, letting you manage your vSphere infrastructure through natural language chat.

> **This is the Mac-local setup.** Claude Desktop runs on your laptop, spawns `server.py` via stdio, and reaches vCenter through a persistent SSH tunnel.

---

## What You Can Do From Chat

**Read-only queries**
- List all VMs with power state, CPU, RAM, IP
- Get detailed info on a specific VM
- List all ESXi hosts with specs and utilisation
- List datastores with capacity and free space
- List networks and port groups
- List VM snapshots
- Get an inventory summary (counts)
- Get active alarms

**Actions (require confirmation)**
- Power on / power off a VM
- Restart a VM
- Create a VM snapshot

---

## Prerequisites

| Requirement | Notes |
|---|---|
| macOS | Tested on macOS Sequoia |
| Python 3.13 | Via Homebrew: `brew install python@3.13` |
| Claude Desktop | [claude.ai/download](https://claude.ai/download) |
| OCI VM (jump host) | For SSH tunnel to vCenter |
| SSH key access | To the OCI jump host |

---

## Installation

**1. Clone the repo**
```bash
git clone <repo-url>
cd vCenter_MCP
```

**2. Install Python dependencies**
```bash
pip3.13 install -r requirements.txt
```

**3. Set up the SSH tunnel (launchd)**

Create `~/Library/LaunchAgents/com.vcenter.sshtunnel.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>com.vcenter.sshtunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/ssh</string>
    <string>-N</string>
    <string>-L</string>
    <string>10443:10.0.12.2:443</string>
    <string>opc@&lt;YOUR_OCI_VM_IP&gt;</string>
  </array>
  <key>RunAtLoad</key>        <true/>
  <key>KeepAlive</key>        <true/>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.vcenter.sshtunnel.plist
```

**4. Configure Claude Desktop**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vcenter": {
      "command": "/opt/homebrew/bin/python3.13",
      "args": ["/Users/<you>/Documents/Chatgpt_Codex/vCenter_MCP/server.py"],
      "env": {
        "VCENTER_HOST":     "127.0.0.1",
        "VCENTER_USERNAME": "administrator@vsphere.local",
        "VCENTER_PASSWORD": "<your-password>",
        "VCENTER_PORT":     "10443",
        "VCENTER_SSL_VERIFY": "false"
      }
    }
  }
}
```

**5. Restart Claude Desktop**

The MCP server will appear in Settings → Developer. All 13 tools are auto-discovered.

---

## How It Works

```
Claude Desktop  ──stdio pipe──▶  server.py  ──pyVmomi──▶  localhost:10443
                                                                │
                                                    SSH tunnel  │
                                                                ▼
                                                    OCI VM (jump host)
                                                                │
                                                    internal VCN│
                                                                ▼
                                                    vCenter (10.0.12.2:443)
```

For a full visual walkthrough, open `mac_local_version1.html` in a browser.

---

## Project Structure

```
vCenter_MCP/
├── server.py               # MCP server — all 13 vCenter tools
├── requirements.txt        # mcp[cli], pyVmomi
└── mac_local_version1.html # Visual documentation (how it works)
```

---

## Dependencies

```
mcp[cli]
pyVmomi
```

---

## Security Notes

- Credentials never leave your Mac — stored only in `claude_desktop_config.json`
- vCenter is not directly exposed; all traffic goes through the SSH tunnel
- SSL verification is disabled for self-signed vCenter certificates (`VCENTER_SSL_VERIFY=false`)
- Power-off and restart operations require explicit confirmation to prevent accidents

---

## Next Steps (Enterprise Version)

A Docker-based version using OCI GenAI + LangChain + Streamlit (no Claude Desktop required) is planned. It will include:
- Streamlit chat UI on OCI Container Instance
- LangChain agent with OCI GenAI (Cohere Command A)
- RAG over vCenter runbooks via OCI OpenSearch
- All vCenter tools refactored as LangChain tools
