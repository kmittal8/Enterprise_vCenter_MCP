import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";

// API base — empty string = same origin (production via FastAPI)
// In Vite dev, proxy /api → http://localhost:8000 via vite.config.js
const API = "";

function useLiveData(endpoint, fallback) {
  const [data, setData]     = useState(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refresh: load };
}

/*
  vCenter MCP Dashboard
  AllyUI shell (AllyOCI v20 design system) applied to vSphere / MCP domain.
  Standalone React JSX — drop into any Vite/CRA app.
*/

const CURRENT_USER = {
  name: "vCenter Admin",
  initials: "VA",
  email: "admin@vcenter.local",
};

// ── Palette (AllyOCI tokens) ────────────────────────────────────────────────

const PALETTE = [
  { token: "--navy0", value: "#060c18", role: "Sidebar and deepest panels" },
  { token: "--navy1", value: "#090f1d", role: "Application background" },
  { token: "--navy2", value: "#0c1428", role: "Input and nested panel background" },
  { token: "--navy3", value: "#0f1a32", role: "Card background" },
  { token: "--navy4", value: "#14213d", role: "Elevated hover surface" },
  { token: "--blue",  value: "#3b7fd4", role: "Primary action and vSphere metric" },
  { token: "--blue2", value: "#4a90e2", role: "Bright highlight" },
  { token: "--teal",  value: "#00c7a3", role: "Healthy and live status" },
  { token: "--amber", value: "#f5a623", role: "Warning and pending state" },
  { token: "--red",   value: "#f87171", role: "Error and failed state" },
  { token: "--violet",value: "#a78bfa", role: "AI, MCP, agentic accent" },
  { token: "--g1",    value: "#e8edf8", role: "Primary text" },
  { token: "--g2",    value: "#a0aec0", role: "Secondary text" },
  { token: "--g3",    value: "#6b7280", role: "Muted text" },
  { token: "--g4",    value: "#3d4f6a", role: "Metadata and table headers" },
  { token: "--g5",    value: "#1e2d45", role: "Low contrast dividers" },
];

// ── CSS (AllyOCI token layer + shell) ──────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy0:#060c18;
  --navy1:#090f1d;
  --navy2:#0c1428;
  --navy3:#0f1a32;
  --navy4:#14213d;
  --blue:#3b7fd4;
  --blue2:#4a90e2;
  --blue-l:rgba(59,127,212,0.12);
  --blue-b:rgba(59,127,212,0.25);
  --teal:#00c7a3;
  --amber:#f5a623;
  --red:#f87171;
  --violet:#a78bfa;
  --white:#ffffff;
  --g1:#e8edf8;
  --g2:#a0aec0;
  --g3:#6b7280;
  --g4:#3d4f6a;
  --g5:#1e2d45;
  --bd:rgba(255,255,255,0.07);
  --bd2:rgba(255,255,255,0.12);
  --f:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --fm:"JetBrains Mono","SFMono-Regular",Consolas,monospace;
}
html,body,#root{height:100%;overflow:hidden}
body{font-family:var(--f);background:var(--navy1);color:var(--g1);-webkit-font-smoothing:antialiased;font-size:14px}
button,input,select,textarea{font-family:var(--f)}
button{cursor:pointer}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:var(--g5);border-radius:8px}
.shell{display:flex;height:100vh;overflow:hidden;background:var(--navy1);color:var(--g1)}
.sidenav{width:60px;flex-shrink:0;background:var(--navy0);border-right:1px solid var(--bd);display:flex;flex-direction:column;align-items:center;padding:16px 0;z-index:20}
.sn-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b7fd4,#1e56a0);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;margin-bottom:24px;box-shadow:0 4px 14px rgba(59,127,212,.35)}
.sn-items{flex:1;display:flex;flex-direction:column;gap:1px;width:100%;padding:0 8px}
.sn-item{width:44px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:all .15s;color:var(--g3);position:relative;border:1px solid transparent;background:transparent}
.sn-item:hover{background:rgba(255,255,255,.06);color:var(--g2)}
.sn-item.active{background:rgba(59,127,212,.15);color:var(--blue);border-color:rgba(59,127,212,.25)}
.sn-item .tooltip{position:absolute;left:52px;top:50%;transform:translateY(-50%);background:var(--navy3);border:1px solid var(--bd2);color:var(--g1);font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:100}
.sn-item:hover .tooltip{opacity:1}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;background:var(--navy1)}
.topbar{height:52px;background:var(--navy1);border-bottom:1px solid var(--bd);padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}
.tb-title{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--g4);font-family:var(--fm)}
.tb-user{display:flex;align-items:center;gap:10px}
.tb-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#1e56a0);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.tb-name{font-size:13px;font-weight:600;color:var(--g1)}
.tb-badge{width:20px;height:20px;border-radius:50%;background:var(--red);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:var(--fm)}
.page-area{flex:1;overflow-y:auto;background:var(--navy1)}
.content-page{padding:28px 32px 60px;min-height:calc(100vh - 52px)}
.pg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:24px}
.pg-title{font-size:22px;font-weight:750;color:var(--g1);margin-bottom:4px}
.pg-sub{font-size:13px;color:var(--g2);line-height:1.6;max-width:760px}
.card{background:var(--navy3);border:1px solid var(--bd);border-radius:12px;padding:20px}
.card-sm{background:var(--navy3);border:1px solid var(--bd);border-radius:8px;padding:14px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.gauto{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
@media(max-width:1100px){.g4{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:repeat(2,1fr)}}
@media(max-width:800px){.g2,.g3,.g4{grid-template-columns:1fr}.content-page{padding:22px 18px 48px}.tb-name{display:none}}
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:650;cursor:pointer;transition:all .14s;border:none}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-blue{background:var(--blue);color:#fff;box-shadow:0 4px 12px rgba(59,127,212,.25)}.btn-blue:hover:not(:disabled){filter:brightness(1.1)}
.btn-ghost{background:transparent;color:var(--g2);border:1px solid var(--bd)}.btn-ghost:hover:not(:disabled){background:rgba(255,255,255,.05);color:var(--g1)}
.btn-sm{padding:5px 12px;font-size:11.5px}.btn-lg{padding:11px 24px;font-size:14px}
.stl{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--g4);font-family:var(--fm);margin-bottom:12px}
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--g4);font-family:var(--fm);padding:9px 12px;text-align:left;border-bottom:1px solid var(--bd);white-space:nowrap}
.tbl td{font-size:12.5px;padding:10px 12px;border-bottom:1px solid var(--bd);color:var(--g1);vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:rgba(255,255,255,.02)}
.tabs{display:flex;gap:0;border-bottom:1px solid var(--bd);margin-bottom:20px;overflow-x:auto}
.tab{padding:9px 18px;background:none;border:none;cursor:pointer;font-size:13px;font-family:var(--f);font-weight:550;color:var(--g3);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;white-space:nowrap}
.tab.on{color:var(--blue);border-bottom-color:var(--blue);font-weight:800}.tab:hover{color:var(--g1)}
.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{padding:6px 14px;border-radius:20px;border:1px solid var(--bd);background:transparent;color:var(--g3);font-size:12px;font-weight:550;cursor:pointer;transition:all .15s;font-family:var(--f)}
.pill.on{border-color:var(--blue);background:var(--blue-l);color:var(--blue);font-weight:750}.pill:hover{border-color:var(--blue);color:var(--blue)}
.field{margin-bottom:14px}
.field label{display:block;font-size:10px;font-weight:800;color:var(--g3);margin-bottom:6px;letter-spacing:.8px;text-transform:uppercase;font-family:var(--fm)}
.field input,.field select,.field textarea{width:100%;background:var(--navy2);border:1px solid var(--bd2);border-radius:8px;padding:9px 12px;color:var(--g1);font-size:13px;outline:none;transition:border-color .14s}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--blue)}
.field textarea{min-height:120px;resize:vertical}
.badge{font-size:10px;font-weight:800;font-family:var(--fm);padding:3px 9px;border-radius:4px;border:1px solid;display:inline-flex;align-items:center;white-space:nowrap;text-transform:uppercase}
.metric-card{border-radius:12px;padding:18px 20px;border:1px solid;transition:transform .15s;min-height:126px}
.metric-card:hover{transform:translateY(-2px)}
.metric-dot{font-size:12px;font-weight:800;margin-bottom:6px;font-family:var(--fm);letter-spacing:1px}
.metric-value{font-size:27px;font-weight:850;letter-spacing:-.5px;line-height:1.1}
.metric-label{font-size:11.5px;color:var(--g2);margin-top:5px}
.metric-delta{margin-top:9px;font-size:10px;font-weight:800;font-family:var(--fm);padding:2px 7px;border-radius:4px;display:inline-flex;align-items:center;gap:3px}
.swatch{height:88px;border-radius:10px;border:1px solid var(--bd);display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background:var(--navy2)}
.swatch-color{flex:1}.swatch-meta{padding:9px 10px;background:rgba(6,12,24,.7);border-top:1px solid var(--bd)}
.mono{font-family:var(--fm)}.muted{color:var(--g3)}.pre{white-space:pre-wrap;line-height:1.65;font-size:13px;color:var(--g2)}
.bar-row{height:7px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}
.bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--blue),var(--teal))}
.hero{border:1px solid rgba(59,127,212,.18);background:linear-gradient(135deg,rgba(59,127,212,.08),rgba(167,139,250,.05) 55%,rgba(0,199,163,.04)),var(--navy3)}
.chat-shell{display:grid;grid-template-columns:minmax(280px,370px) minmax(0,1fr);gap:16px}
.answer-card{border:1px solid rgba(59,127,212,.20);background:linear-gradient(135deg,rgba(59,127,212,.07),rgba(0,199,163,.04)),var(--navy3);border-radius:12px;padding:18px}
.source-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd2);background:rgba(255,255,255,.035);color:var(--g2);border-radius:999px;padding:5px 10px;font-size:11px;font-family:var(--fm);margin:0 6px 6px 0}
.no-data{border-color:rgba(245,166,35,.25);background:linear-gradient(135deg,rgba(245,166,35,.08),rgba(248,113,113,.04)),var(--navy3)}
@media(max-width:980px){.chat-shell{grid-template-columns:1fr}}
`;

// ── Nav ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "home",      label: "Home",                icon: "⌂" },
  { id: "dashboard", label: "vCenter Command Center", icon: "D" },
  { id: "aisearch",  label: "AI Search",           icon: "S" },
  { id: "palette",   label: "Palette",             icon: "P" },
];

const DASHBOARD_TABS = [
  { id: "estate",  label: "VM Estate" },
  { id: "compute", label: "Compute / Hosts" },
  { id: "storage", label: "Storage" },
  { id: "network", label: "Network" },
  { id: "alarms",  label: "Alarms" },
  { id: "mcp",     label: "MCP Dashboard" },
];

// ── Data arrays ─────────────────────────────────────────────────────────────

const VM_METRICS = [
  { label: "Total VMs",         value: "142",  delta: "+6 7d",  up: true,  color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
  { label: "Powered On",        value: "118",  delta: "+4",     up: true,  color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
  { label: "Powered Off",       value: "19",   delta: "+2",     up: false, color: "#f5a623", bg: "rgba(245,166,35,.10)" },
  { label: "Suspended",         value: "5",    delta: "0",      up: true,  color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
  { label: "VMware Tools OK",   value: "91%",  delta: "+3%",    up: true,  color: "#34d399", bg: "rgba(52,211,153,.10)" },
  { label: "Snapshots Active",  value: "23",   delta: "+5",     up: false, color: "#f87171", bg: "rgba(248,113,113,.10)" },
];

const VM_LIST = [
  { name: "vcenter-mgmt-01",   host: "esxi-host-01", power: "poweredOn",  cpu: "12%", mem: "8.4 GB",  tools: "toolsOk",      status: "active" },
  { name: "web-prod-01",       host: "esxi-host-02", power: "poweredOn",  cpu: "34%", mem: "14.2 GB", tools: "toolsOk",      status: "active" },
  { name: "db-prod-01",        host: "esxi-host-01", power: "poweredOn",  cpu: "68%", mem: "28.6 GB", tools: "toolsOk",      status: "watch" },
  { name: "app-staging-03",    host: "esxi-host-03", power: "poweredOn",  cpu: "22%", mem: "6.1 GB",  tools: "toolsOk",      status: "active" },
  { name: "backup-relay-02",   host: "esxi-host-02", power: "poweredOff", cpu: "0%",  mem: "—",       tools: "toolsNotRunning", status: "pending" },
  { name: "legacy-app-07",     host: "esxi-host-04", power: "poweredOn",  cpu: "5%",  mem: "3.2 GB",  tools: "toolsOld",     status: "watch" },
  { name: "k8s-node-01",       host: "esxi-host-03", power: "poweredOn",  cpu: "51%", mem: "16.0 GB", tools: "toolsOk",      status: "active" },
  { name: "k8s-node-02",       host: "esxi-host-03", power: "poweredOn",  cpu: "47%", mem: "15.8 GB", tools: "toolsOk",      status: "active" },
  { name: "dev-sandbox-11",    host: "esxi-host-04", power: "suspended",  cpu: "0%",  mem: "—",       tools: "toolsNotRunning", status: "pending" },
  { name: "mcp-server-vm",     host: "esxi-host-01", power: "poweredOn",  cpu: "9%",  mem: "4.8 GB",  tools: "toolsOk",      status: "active" },
];

const HOST_METRICS = [
  { label: "Total Hosts",    value: "4",    delta: "stable",  up: true,  color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
  { label: "Connected",      value: "4",    delta: "all OK",  up: true,  color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
  { label: "Avg CPU Usage",  value: "41%",  delta: "+3%",     up: false, color: "#f5a623", bg: "rgba(245,166,35,.10)" },
  { label: "Avg Mem Usage",  value: "63%",  delta: "+5%",     up: false, color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
];

const HOST_LIST = [
  { name: "esxi-host-01", cpu: "38%", mem: "71%", vms: 32, version: "8.0.2", status: "active" },
  { name: "esxi-host-02", cpu: "44%", mem: "58%", vms: 29, version: "8.0.2", status: "active" },
  { name: "esxi-host-03", cpu: "52%", mem: "66%", vms: 41, version: "8.0.1", status: "watch" },
  { name: "esxi-host-04", cpu: "29%", mem: "57%", vms: 40, version: "8.0.2", status: "active" },
];

const DATASTORE_METRICS = [
  { label: "Total Datastores", value: "6",      delta: "stable", up: true,  color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
  { label: "Total Capacity",   value: "48 TB",  delta: "stable", up: true,  color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
  { label: "Used",             value: "31.4 TB",delta: "+1.2 TB",up: false, color: "#f5a623", bg: "rgba(245,166,35,.10)" },
  { label: "Free",             value: "16.6 TB",delta: "-1.2 TB",up: false, color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
];

const DATASTORE_LIST = [
  { name: "vsan-prod-01",    type: "vSAN",  capacity: "20 TB", free: "7.2 TB",  pct: 64, status: "active" },
  { name: "nfs-shared-01",   type: "NFS",   capacity: "10 TB", free: "4.1 TB",  pct: 59, status: "active" },
  { name: "local-ssd-h01",   type: "VMFS",  capacity: "4 TB",  free: "1.8 TB",  pct: 55, status: "active" },
  { name: "local-ssd-h02",   type: "VMFS",  capacity: "4 TB",  free: "0.9 TB",  pct: 78, status: "watch" },
  { name: "nfs-backup-01",   type: "NFS",   capacity: "8 TB",  free: "2.1 TB",  pct: 74, status: "watch" },
  { name: "local-ssd-h03",   type: "VMFS",  capacity: "2 TB",  free: "0.5 TB",  pct: 75, status: "active" },
];

const NETWORK_LIST = [
  { name: "VM Network",         type: "Standard vSwitch", vlan: "0",    hosts: 4, status: "active" },
  { name: "Management Network", type: "Standard vSwitch", vlan: "10",   hosts: 4, status: "active" },
  { name: "vMotion",            type: "DVS",              vlan: "20",   hosts: 4, status: "active" },
  { name: "Storage Traffic",    type: "DVS",              vlan: "30",   hosts: 4, status: "active" },
  { name: "App-Prod-PG",        type: "DVS",              vlan: "100",  hosts: 3, status: "active" },
  { name: "App-Dev-PG",         type: "DVS",              vlan: "200",  hosts: 2, status: "active" },
  { name: "Isolated-Quarantine", type: "Standard vSwitch", vlan: "999", hosts: 1, status: "watch" },
];

const ALARM_LIST = [
  { entity: "esxi-host-03",     alarm: "Host CPU usage",          severity: "warning",  triggered: "14m ago", status: "watch" },
  { entity: "db-prod-01",       alarm: "VM CPU ready",            severity: "warning",  triggered: "1h ago",  status: "watch" },
  { entity: "nfs-backup-01",    alarm: "Datastore usage > 70%",   severity: "warning",  triggered: "3h ago",  status: "watch" },
  { entity: "local-ssd-h02",    alarm: "Datastore usage > 70%",   severity: "warning",  triggered: "5h ago",  status: "watch" },
  { entity: "legacy-app-07",    alarm: "VMware Tools out of date", severity: "info",    triggered: "2d ago",  status: "pending" },
  { entity: "vcenter-mgmt-01",  alarm: "Snapshot age > 7 days",   severity: "info",    triggered: "4d ago",  status: "pending" },
];

const MCP_METRICS = [
  { label: "Connected Servers", value: "1/1",   delta: "healthy",  up: true,  color: "#00d4ff", bg: "rgba(0,212,255,.08)" },
  { label: "Tool Calls (24h)",  value: "2.4K",  delta: "+11%",     up: true,  color: "#10b981", bg: "rgba(16,185,129,.10)" },
  { label: "Median Latency",    value: "34ms",  delta: "-6ms",     up: true,  color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
  { label: "Error Rate",        value: "0.6%",  delta: "-0.2%",    up: true,  color: "#f5a623", bg: "rgba(245,166,35,.10)" },
];

const MCP_SERVERS = [
  { server: "vcenter-mcp",  tools: 13, resources: 5, latency: "34ms", status: "connected" },
];

const FUNCTIONALITY_TELEMETRY = [
  { area: "list_vms",             category: "VM",       calls: "842",  p95: "210ms", errors: "0.2%", status: "healthy" },
  { area: "get_vm_details",       category: "VM",       calls: "614",  p95: "280ms", errors: "0.3%", status: "healthy" },
  { area: "power_on_vm",          category: "VM",       calls: "38",   p95: "3.2s",  errors: "0.0%", status: "healthy" },
  { area: "power_off_vm",         category: "VM",       calls: "21",   p95: "4.1s",  errors: "0.0%", status: "healthy" },
  { area: "restart_vm",           category: "VM",       calls: "14",   p95: "5.8s",  errors: "0.0%", status: "healthy" },
  { area: "list_hosts",           category: "Host",     calls: "406",  p95: "190ms", errors: "0.1%", status: "healthy" },
  { area: "get_host_performance", category: "Host",     calls: "318",  p95: "320ms", errors: "0.4%", status: "healthy" },
  { area: "list_datastores",      category: "Storage",  calls: "298",  p95: "170ms", errors: "0.1%", status: "healthy" },
  { area: "list_networks",        category: "Network",  calls: "192",  p95: "160ms", errors: "0.1%", status: "healthy" },
  { area: "list_vm_snapshots",    category: "Snapshot", calls: "144",  p95: "240ms", errors: "0.2%", status: "healthy" },
  { area: "create_vm_snapshot",   category: "Snapshot", calls: "29",   p95: "6.4s",  errors: "1.4%", status: "watch" },
  { area: "get_inventory_summary",category: "Overview", calls: "512",  p95: "420ms", errors: "0.3%", status: "healthy" },
  { area: "get_alarms",           category: "Overview", calls: "388",  p95: "200ms", errors: "0.2%", status: "healthy" },
];

// ── Shared helpers ───────────────────────────────────────────────────────────

function clampText(value, max = 12000) {
  return String(value ?? "").replace(/[<>]/g, c => (c === "<" ? "‹" : "›")).slice(0, max);
}

function statusStyle(status) {
  const s = String(status || "").toLowerCase();
  if (["active", "healthy", "success", "connected", "poweredon"].includes(s))
    return { color: "#00c7a3", border: "rgba(0,199,163,.35)", bg: "rgba(0,199,163,.08)" };
  if (["watch", "pending", "degraded", "draft", "warning"].includes(s))
    return { color: "#f5a623", border: "rgba(245,166,35,.35)", bg: "rgba(245,166,35,.08)" };
  if (["failed", "offline", "blocked", "poweredoff", "error"].includes(s))
    return { color: "#f87171", border: "rgba(248,113,113,.35)", bg: "rgba(248,113,113,.08)" };
  return { color: "#a0aec0", border: "rgba(255,255,255,.12)", bg: "rgba(255,255,255,.04)" };
}

function Badge({ status }) {
  const s = statusStyle(status);
  return (
    <span className="badge" style={{ color: s.color, borderColor: s.border, background: s.bg }}>
      {status}
    </span>
  );
}

function MetricCard({ item }) {
  return (
    <div className="metric-card" style={{ background: item.bg, borderColor: `${item.color}33` }}>
      <div className="metric-dot" style={{ color: item.color }}>●</div>
      <div className="metric-value" style={{ color: item.color }}>{item.value}</div>
      <div className="metric-label">{item.label}</div>
      <div className="metric-delta" style={{
        background: item.up ? "rgba(52,211,153,.12)" : "rgba(248,113,113,.12)",
        color: item.up ? "#34d399" : "#f87171",
      }}>
        {item.up ? "▲" : "▼"} {item.delta}
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, keyField }) {
  return (
    <div style={{ overflow: "auto" }}>
      <table className="tbl">
        <thead>
          <tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row[keyField] ?? idx}>
              {columns.map(col => (
                <td key={col.key} style={col.mono ? { fontFamily: "var(--fm)", fontSize: 11, color: col.color || "var(--g2)" } : undefined}>
                  {col.badge ? <Badge status={row[col.key]} /> : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarFunnel({ rows }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {rows.map(row => (
        <div key={row.name}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--g2)", fontSize: 12, marginBottom: 5 }}>
            <span>{row.name}</span>
            <span className="mono">{row.free} free / {row.pct}% used</span>
          </div>
          <div className="bar-row"><div className="bar-fill" style={{ width: `${row.pct}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard tab views ──────────────────────────────────────────────────────

function VMEstate({ vmList = VM_LIST }) {
  const on  = vmList.filter(r => (r.power || r.powerState) === "poweredOn").length;
  const off = vmList.filter(r => (r.power || r.powerState) === "poweredOff").length;
  const liveMetrics = [
    { label: "Total VMs",       value: String(vmList.length), delta: "live", up: true, color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
    { label: "Powered On",      value: String(on),            delta: "live", up: true, color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
    { label: "Powered Off",     value: String(off),           delta: "live", up: off > 0 ? false : true, color: "#f5a623", bg: "rgba(245,166,35,.10)" },
    { label: "Suspended",       value: String(vmList.filter(r => (r.power || r.powerState) === "suspended").length), delta: "live", up: true, color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
  ];
  return (
    <>
      <div className="g4" style={{ marginBottom: 18 }}>
        {liveMetrics.map(item => <MetricCard key={item.label} item={item} />)}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
          <div className="stl" style={{ margin: 0 }}>VM Inventory</div>
        </div>
        <SimpleTable
          keyField="name"
          rows={vmList}
          columns={[
            { key: "name",  label: "VM Name" },
            { key: "host",  label: "Host", mono: true, color: "var(--g3)" },
            { key: "power", label: "Power", mono: true, color: "var(--blue2)" },
            { key: "cpu",   label: "CPU",   mono: true, color: "#f5a623" },
            { key: "mem",   label: "Memory",mono: true },
            { key: "tools", label: "Tools", mono: true, color: "var(--g3)" },
            { key: "status",label: "Status", badge: true },
          ]}
        />
      </div>
    </>
  );
}

function ComputeHosts({ hostList = HOST_LIST }) {
  return (
    <>
      <div className="g4" style={{ marginBottom: 18 }}>
        {HOST_METRICS.map(item => <MetricCard key={item.label} item={item} />)}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
          <div className="stl" style={{ margin: 0 }}>ESXi Host Summary</div>
        </div>
        <SimpleTable
          keyField="name"
          rows={hostList}
          columns={[
            { key: "name",    label: "Host" },
            { key: "cpu",     label: "CPU%",    mono: true, color: "#f5a623" },
            { key: "mem",     label: "Mem%",    mono: true, color: "#a78bfa" },
            { key: "vms",     label: "VMs",     mono: true, color: "var(--blue2)" },
            { key: "version", label: "ESXi Ver",mono: true, color: "var(--g3)" },
            { key: "status",  label: "Status",  badge: true },
          ]}
        />
      </div>
    </>
  );
}

function StorageView({ datastoreList = DATASTORE_LIST }) {
  return (
    <>
      <div className="g4" style={{ marginBottom: 18 }}>
        {DATASTORE_METRICS.map(item => <MetricCard key={item.label} item={item} />)}
      </div>
      <div className="g2">
        <div className="card">
          <div className="stl">Datastore Capacity</div>
          <BarFunnel rows={datastoreList} />
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
            <div className="stl" style={{ margin: 0 }}>Datastore Details</div>
          </div>
          <SimpleTable
            keyField="name"
            rows={datastoreList}
            columns={[
              { key: "name",     label: "Datastore" },
              { key: "type",     label: "Type",     mono: true, color: "var(--g3)" },
              { key: "capacity", label: "Capacity", mono: true, color: "var(--blue2)" },
              { key: "free",     label: "Free",     mono: true, color: "#00c7a3" },
              { key: "status",   label: "Status",   badge: true },
            ]}
          />
        </div>
      </div>
    </>
  );
}

function NetworkView({ networkList = NETWORK_LIST }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
        <div className="stl" style={{ margin: 0 }}>Port Groups &amp; Networks</div>
      </div>
      <SimpleTable
        keyField="name"
        rows={networkList}
        columns={[
          { key: "name",   label: "Port Group" },
          { key: "type",   label: "Type",   mono: true, color: "var(--g3)" },
          { key: "vlan",   label: "VLAN",   mono: true, color: "var(--blue2)" },
          { key: "hosts",  label: "Hosts",  mono: true },
          { key: "status", label: "Status", badge: true },
        ]}
      />
    </div>
  );
}

function AlarmsView({ alarmList = ALARM_LIST }) {
  const warnings = alarmList.filter(r => r.severity === "warning").length;
  return (
    <>
      <div className="g4" style={{ marginBottom: 18 }}>
        {[
          { label: "Total Alarms",  value: String(alarmList.length), delta: "active", up: false, color: "#f87171", bg: "rgba(248,113,113,.10)" },
          { label: "Warnings",      value: String(warnings),         delta: "watch",  up: false, color: "#f5a623", bg: "rgba(245,166,35,.10)" },
          { label: "Info",          value: String(alarmList.length - warnings), delta: "low", up: true, color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
          { label: "Auto-resolved", value: "0",                      delta: "manual", up: true, color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
        ].map(item => <MetricCard key={item.label} item={item} />)}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
          <div className="stl" style={{ margin: 0 }}>Active Alarms</div>
        </div>
        <SimpleTable
          keyField="entity"
          rows={alarmList}
          columns={[
            { key: "entity",    label: "Entity" },
            { key: "alarm",     label: "Alarm" },
            { key: "severity",  label: "Severity", mono: true, color: "#f5a623" },
            { key: "triggered", label: "Triggered", mono: true, color: "var(--g3)" },
            { key: "status",    label: "Status",   badge: true },
          ]}
        />
      </div>
    </>
  );
}

function MCPDashboard() {
  const healthy = FUNCTIONALITY_TELEMETRY.filter(r => r.status === "healthy").length;
  const watch   = FUNCTIONALITY_TELEMETRY.length - healthy;
  return (
    <>
      <div className="g4" style={{ marginBottom: 18 }}>
        {MCP_METRICS.map(item => <MetricCard key={item.label} item={item} />)}
      </div>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
            <div className="stl" style={{ margin: 0 }}>MCP Server Health</div>
          </div>
          <SimpleTable
            keyField="server"
            rows={MCP_SERVERS}
            columns={[
              { key: "server",    label: "Server" },
              { key: "tools",     label: "Tools",     mono: true, color: "#00d4ff" },
              { key: "resources", label: "Resources", mono: true, color: "#a78bfa" },
              { key: "latency",   label: "Latency",   mono: true },
              { key: "status",    label: "Status",    badge: true },
            ]}
          />
        </div>
        <div className="card">
          <div className="stl">Tool Coverage</div>
          <div className="g2" style={{ marginTop: 4 }}>
            {[
              ["Total Tools", FUNCTIONALITY_TELEMETRY.length, "#3b7fd4"],
              ["Healthy",     healthy,                        "#00c7a3"],
              ["Watch",       watch,                          "#f5a623"],
              ["Categories",  [...new Set(FUNCTIONALITY_TELEMETRY.map(r => r.category))].length, "#a78bfa"],
            ].map(([label, value, color]) => (
              <div className="card-sm" key={label} style={{ background: "rgba(6,12,24,.35)" }}>
                <div className="stl" style={{ marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 850, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--bd)" }}>
          <div className="stl" style={{ marginBottom: 4 }}>Tool Call Telemetry</div>
          <div className="muted" style={{ fontSize: 12 }}>Per-tool call volume, P95 latency, and error rate.</div>
        </div>
        <SimpleTable
          keyField="area"
          rows={FUNCTIONALITY_TELEMETRY}
          columns={[
            { key: "area",     label: "Tool" },
            { key: "category", label: "Category",  mono: true, color: "var(--g3)" },
            { key: "calls",    label: "Calls (24h)",mono: true, color: "var(--blue2)" },
            { key: "p95",      label: "P95",        mono: true, color: "#a78bfa" },
            { key: "errors",   label: "Error Rate", mono: true },
            { key: "status",   label: "Status",     badge: true },
          ]}
        />
      </div>
    </>
  );
}

// ── Dashboard page ───────────────────────────────────────────────────────────

function DashboardPage({ setView }) {
  const [tab, setTab] = useState("estate");

  const { data: liveVms,        loading: lvmL, refresh: refreshVms }        = useLiveData("/api/vms",        VM_LIST);
  const { data: liveHosts,      loading: lhL,  refresh: refreshHosts }      = useLiveData("/api/hosts",      HOST_LIST);
  const { data: livedatastores, loading: ldL,  refresh: refreshDs }          = useLiveData("/api/datastores", DATASTORE_LIST);
  const { data: liveNetworks,   loading: lnL,  refresh: refreshNets }       = useLiveData("/api/networks",   NETWORK_LIST);
  const { data: liveAlarms,     loading: laL,  refresh: refreshAlarms }     = useLiveData("/api/alarms",     ALARM_LIST);
  const { data: liveSummary,    loading: lsL,  refresh: refreshSummary }    = useLiveData("/api/summary",    null);

  const isLoading = lvmL || lhL || ldL || lnL || laL || lsL;

  const refreshAll = () => {
    refreshVms(); refreshHosts(); refreshDs();
    refreshNets(); refreshAlarms(); refreshSummary();
  };

  const vms        = Array.isArray(liveVms)        ? liveVms        : VM_LIST;
  const hosts      = Array.isArray(liveHosts)      ? liveHosts      : HOST_LIST;
  const datastores = Array.isArray(livedatastores)  ? livedatastores : DATASTORE_LIST;
  const networks   = Array.isArray(liveNetworks)   ? liveNetworks   : NETWORK_LIST;
  const alarms     = Array.isArray(liveAlarms)     ? liveAlarms     : ALARM_LIST;

  const alarmCount = alarms.filter(r => r.severity === "warning").length;
  return (
    <div className="content-page">
      <div className="pg-head">
        <div>
          <div className="pg-title">vCenter Command Center</div>
          <div className="pg-sub">
            Live vSphere estate — VM inventory, host performance, storage, networks, alarms, and MCP tool telemetry.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isLoading && <span className="muted" style={{ fontSize: 12 }}>Loading…</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setView("aisearch")}>Ask AI Search</button>
          <button className="btn btn-blue btn-sm" onClick={refreshAll} disabled={isLoading}>Refresh</button>
        </div>
      </div>
      {alarmCount > 0 && (
        <div style={{ background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.25)", borderRadius: 10, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: "#f87171", display: "flex", alignItems: "center", gap: 10 }}>
          ⚠ {alarmCount} active warning alarms — check the Alarms tab.
        </div>
      )}
      <div className="tabs">
        {DASHBOARD_TABS.map(item => (
          <button key={item.id} className={`tab${tab === item.id ? " on" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "estate"  && <VMEstate   vmList={vms} />}
      {tab === "compute" && <ComputeHosts hostList={hosts} />}
      {tab === "storage" && <StorageView  datastoreList={datastores} />}
      {tab === "network" && <NetworkView  networkList={networks} />}
      {tab === "alarms"  && <AlarmsView   alarmList={alarms} />}
      {tab === "mcp"     && <MCPDashboard />}
    </div>
  );
}

// ── Home page ────────────────────────────────────────────────────────────────

function HomePage({ setView }) {
  const totalVMs   = VM_METRICS.find(m => m.label === "Total VMs")?.value;
  const totalHosts = HOST_METRICS.find(m => m.label === "Total Hosts")?.value;
  const alarms     = ALARM_LIST.length;
  return (
    <div className="content-page">
      <div className="card hero" style={{ marginBottom: 18 }}>
        <div className="stl">Enterprise vCenter MCP</div>
        <div style={{ fontSize: 34, fontWeight: 850, lineHeight: 1.18, maxWidth: 850, marginBottom: 12 }}>
          VMware vSphere command centre — AI-powered vCenter management via MCP.
        </div>
        <div className="pg-sub" style={{ marginBottom: 22 }}>
          Monitor VMs, ESXi hosts, datastores, networks, and alarms. Interact with vCenter through the MCP tool layer. Search your infrastructure with grounded AI.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-blue" onClick={() => setView("dashboard")}>Open Command Center</button>
          <button className="btn btn-ghost" onClick={() => setView("aisearch")}>Ask AI Search</button>
        </div>
      </div>
      <div className="g4">
        {[
          { label: "Total VMs",      value: totalVMs,          color: "#3b7fd4", bg: "rgba(59,127,212,.10)" },
          { label: "ESXi Hosts",     value: totalHosts,        color: "#00c7a3", bg: "rgba(0,199,163,.10)" },
          { label: "Active Alarms",  value: String(alarms),    color: "#f87171", bg: "rgba(248,113,113,.10)" },
          { label: "MCP Tools",      value: String(FUNCTIONALITY_TELEMETRY.length), color: "#a78bfa", bg: "rgba(167,139,250,.10)" },
        ].map(item => (
          <div className="card-sm" key={item.label} style={{ background: item.bg, border: `1px solid ${item.color}33`, borderRadius: 12 }}>
            <div className="stl" style={{ marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 850, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="g3" style={{ marginTop: 16 }}>
        <div className="card"><div className="stl">MCP Layer</div><div className="pre">13 vCenter tools exposed via FastMCP HTTP/SSE. Power ops require confirm=True.</div></div>
        <div className="card"><div className="stl">AI Search</div><div className="pre">Grounded local routing over VM, host, storage, alarm, and MCP datasets. No hallucination.</div></div>
        <div className="card"><div className="stl">Observability</div><div className="pre">Per-tool call volume, P95 latency, and error rate tracked in MCP Dashboard tab.</div></div>
      </div>
    </div>
  );
}

// ── Palette page ─────────────────────────────────────────────────────────────

function PalettePage() {
  return (
    <div className="content-page">
      <div className="pg-head">
        <div>
          <div className="pg-title">Colour Palette</div>
          <div className="pg-sub">AllyOCI v20 design tokens used across this dashboard.</div>
        </div>
      </div>
      <div className="gauto">
        {PALETTE.map(item => (
          <div className="swatch" key={item.token}>
            <div className="swatch-color" style={{ background: item.value }} />
            <div className="swatch-meta">
              <div className="mono" style={{ fontSize: 12, color: "var(--g1)", fontWeight: 800 }}>{item.token}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--g3)", margin: "3px 0" }}>{item.value}</div>
              <div style={{ fontSize: 11, color: "var(--g2)" }}>{item.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Search ────────────────────────────────────────────────────────────────

const DOMAIN_DETECTORS = [
  {
    id: "estate",
    label: "VM Estate",
    source: "VM_METRICS, VM_LIST",
    test: q => /\bvm\b|virtual machine|power|snapshot|tools|guest|inventory|estate/.test(q),
  },
  {
    id: "compute",
    label: "Compute / Hosts",
    source: "HOST_METRICS, HOST_LIST",
    test: q => /host|esxi|cpu|memory|mem|compute|hypervisor/.test(q),
  },
  {
    id: "storage",
    label: "Storage",
    source: "DATASTORE_METRICS, DATASTORE_LIST",
    test: q => /storage|datastore|disk|capacity|free|vsan|nfs|vmfs/.test(q),
  },
  {
    id: "network",
    label: "Network",
    source: "NETWORK_LIST",
    test: q => /network|port.?group|vlan|dvs|vswitch|switch/.test(q),
  },
  {
    id: "alarms",
    label: "Alarms",
    source: "ALARM_LIST",
    test: q => /alarm|alert|warning|error|triggered/.test(q),
  },
  {
    id: "mcp",
    label: "MCP Dashboard",
    source: "MCP_METRICS, MCP_SERVERS, FUNCTIONALITY_TELEMETRY",
    test: q => /mcp|tool|latency|telemetry|call|server|protocol/.test(q),
  },
];

function listMetricRows(rows) {
  return rows.map(r => `- ${r.label}: ${r.value} (${r.delta})`).join("\n");
}

function buildDomainAnswer(domain) {
  if (domain === "estate") {
    const on  = VM_LIST.filter(r => r.power === "poweredOn").length;
    const off = VM_LIST.filter(r => r.power === "poweredOff").length;
    return `VM Estate\n${listMetricRows(VM_METRICS)}\nVMs shown: ${VM_LIST.length}. Powered on: ${on}. Powered off: ${off}.`;
  }
  if (domain === "compute") {
    const watch = HOST_LIST.filter(r => r.status !== "active");
    return `Compute / Hosts\n${listMetricRows(HOST_METRICS)}\nHosts tracked: ${HOST_LIST.length}. Hosts needing attention: ${watch.map(r => r.name).join(", ") || "none"}.`;
  }
  if (domain === "storage") {
    const over70 = DATASTORE_LIST.filter(r => r.pct >= 70);
    return `Storage\n${listMetricRows(DATASTORE_METRICS)}\nDatastores tracked: ${DATASTORE_LIST.length}. Datastores ≥70% full: ${over70.map(r => r.name).join(", ") || "none"}.`;
  }
  if (domain === "network") {
    const watch = NETWORK_LIST.filter(r => r.status !== "active");
    return `Network\nPort groups tracked: ${NETWORK_LIST.length}. Requiring attention: ${watch.map(r => r.name).join(", ") || "none"}.`;
  }
  if (domain === "alarms") {
    const warnings = ALARM_LIST.filter(r => r.severity === "warning");
    return `Alarms\nTotal active alarms: ${ALARM_LIST.length}. Warnings: ${warnings.length}.\n${ALARM_LIST.map(r => `- ${r.entity}: ${r.alarm} (${r.triggered})`).join("\n")}`;
  }
  if (domain === "mcp") {
    const healthy = FUNCTIONALITY_TELEMETRY.filter(r => r.status === "healthy").length;
    const watch   = FUNCTIONALITY_TELEMETRY.filter(r => r.status !== "healthy").map(r => r.area).join(", ");
    return `MCP Dashboard\n${listMetricRows(MCP_METRICS)}\nTools tracked: ${FUNCTIONALITY_TELEMETRY.length}. Healthy: ${healthy}. Watch: ${watch || "none"}.`;
  }
  return "No grounded domain found.";
}

function routeGroundedSearch(query) {
  const q = query.toLowerCase();
  if (!query.trim()) {
    return {
      noData: true,
      title: "Ask about your vSphere infrastructure",
      answer: "Ask about VMs, ESXi hosts, storage, networks, alarms, or MCP tool telemetry. Answers use only local dashboard data.",
      sources: [],
    };
  }
  const domains = DOMAIN_DETECTORS.filter(item => item.test(q));
  if (!domains.length) {
    return {
      noData: true,
      title: "No grounded local data found",
      answer: `No matching local data for: "${clampText(query, 240)}". Try asking about VMs, hosts, storage, networks, alarms, or MCP tools.`,
      sources: [],
    };
  }
  const sections = domains.map(item => buildDomainAnswer(item.id)).join("\n\n");
  return {
    noData: false,
    title: `Grounded answer from ${domains.map(item => item.label).join(", ")}`,
    answer: `${sections}\n\nNote: values taken only from embedded data arrays. Live vCenter data requires MCP tool calls.`,
    sources: domains.map(item => item.source),
  };
}

function AISearchPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const suggestions = [
    "Show active alarms and warning count",
    "Summarize VM estate — powered on vs off",
    "Which datastores are above 70% capacity?",
    "ESXi host CPU and memory usage",
    "List all powered off VMs",
    "Which network port groups need attention?",
  ];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q) return;
    setInput("");
    const history = messages.map(m => ({ role: m.role, content: m.text }));
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res  = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: data.answer || data.detail || "No response." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content-page" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="pg-head">
        <div>
          <div className="pg-title">AI Search</div>
          <div className="pg-sub">Live vCenter intelligence — OCI GenAI (Cohere) + 13 MCP tools.</div>
        </div>
      </div>

      {messages.length === 0 && (
        <div style={{ padding: "0 0 18px" }}>
          <div className="stl" style={{ marginBottom: 10 }}>Suggestions</div>
          <div className="pills">
            {suggestions.map(s => (
              <button key={s} className="pill" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%",
            background: m.role === "user" ? "var(--accent, #4f8ef7)" : "var(--card-bg, #1a2235)",
            color: "#e8eaf0",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 14,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}>{m.text}</div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "#7a8aaa", fontSize: 13, padding: "6px 12px" }}>
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!loading) send(); } }}
          placeholder="Ask about your vCenter environment… (Enter to send)"
          rows={2}
          style={{ flex: 1, resize: "none", borderRadius: 8, padding: "10px 14px", fontSize: 14, background: "var(--card-bg, #1a2235)", color: "#e8eaf0", border: "1px solid #2e3a52" }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: "0 24px", borderRadius: 8, background: "var(--accent, #4f8ef7)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── App shell ────────────────────────────────────────────────────────────────

export default function VCenterDashboard() {
  const [view, setView] = useState("home");
  const alarmCount = ALARM_LIST.filter(r => r.severity === "warning").length;
  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <nav className="sidenav" aria-label="vCenter MCP navigation">
          <div className="sn-logo">VC</div>
          <div className="sn-items">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                className={`sn-item${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)}
                aria-label={item.label}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 900 }}>{item.icon}</span>
                <span className="tooltip">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <main className="main">
          <header className="topbar">
            <div className="tb-title">Enterprise vCenter MCP</div>
            <div className="tb-user">
              <div className="tb-avatar">{CURRENT_USER.initials}</div>
              <span className="tb-name">{CURRENT_USER.name}</span>
              {alarmCount > 0 && <div className="tb-badge">{alarmCount}</div>}
            </div>
          </header>
          <section className="page-area">
            {view === "home"      && <HomePage setView={setView} />}
            {view === "dashboard" && <DashboardPage setView={setView} />}
            {view === "aisearch"  && <AISearchPage />}
            {view === "palette"   && <PalettePage />}
          </section>
        </main>
      </div>
    </>
  );
}
