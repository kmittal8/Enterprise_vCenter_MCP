#!/usr/bin/env python3
"""
vCenter MCP Server
Exposes VMware vSphere infrastructure as tools for Claude AI
via the Model Context Protocol (MCP).
"""

import ssl
import json
import os
from typing import Any

from mcp.server.fastmcp import FastMCP
from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim

# ── Config from environment ────────────────────────────────────────────────────
VCENTER_HOST     = os.environ["VCENTER_HOST"]
VCENTER_USERNAME = os.environ["VCENTER_USERNAME"]
VCENTER_PASSWORD = os.environ["VCENTER_PASSWORD"]
VCENTER_PORT     = int(os.environ.get("VCENTER_PORT", 443))
SSL_VERIFY       = os.environ.get("VCENTER_SSL_VERIFY", "false").lower() == "true"

mcp = FastMCP(
    "vCenter MCP Server",
    host="0.0.0.0",
    port=8080,
    transport_security=None,
)


# ── vCenter connection ─────────────────────────────────────────────────────────

def get_content():
    ctx = ssl._create_unverified_context() if not SSL_VERIFY else None
    si = SmartConnect(
        host=VCENTER_HOST,
        user=VCENTER_USERNAME,
        pwd=VCENTER_PASSWORD,
        port=VCENTER_PORT,
        sslContext=ctx,
    )
    return si, si.RetrieveContent()


def container_view(content, obj_type):
    return content.viewManager.CreateContainerView(
        content.rootFolder, [obj_type], True
    )


# ── VM tools ───────────────────────────────────────────────────────────────────

@mcp.tool()
def list_vms() -> str:
    """List all virtual machines with their power state, CPU, memory, and IP."""
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        vms = []
        for obj in view.view:
            try:
                cfg = obj.config
                vms.append({
                    "name":        obj.name,
                    "power_state": str(obj.runtime.powerState),
                    "num_cpu":     cfg.hardware.numCPU if cfg else 0,
                    "memory_mb":   cfg.hardware.memoryMB if cfg else 0,
                    "guest_os":    cfg.guestFullName if cfg else "",
                    "ip_address":  obj.guest.ipAddress if obj.guest else "",
                    "host":        obj.runtime.host.name if obj.runtime.host else "",
                })
            except Exception:
                pass
        view.Destroy()
        return json.dumps(vms, indent=2)
    finally:
        Disconnect(si)


@mcp.tool()
def get_vm_details(vm_name: str) -> str:
    """Get detailed information about a specific VM by name."""
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                cfg = obj.config
                runtime = obj.runtime
                guest = obj.guest
                details = {
                    "name":          obj.name,
                    "power_state":   str(runtime.powerState),
                    "num_cpu":       cfg.hardware.numCPU if cfg else 0,
                    "memory_mb":     cfg.hardware.memoryMB if cfg else 0,
                    "guest_os":      cfg.guestFullName if cfg else "",
                    "ip_address":    guest.ipAddress if guest else "",
                    "hostname":      guest.hostName if guest else "",
                    "host":          runtime.host.name if runtime.host else "",
                    "tools_status":  str(guest.toolsStatus) if guest else "",
                    "annotation":    cfg.annotation if cfg else "",
                    "num_disks":     len(cfg.hardware.device) if cfg else 0,
                }
                view.Destroy()
                return json.dumps(details, indent=2)
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


@mcp.tool()
def power_on_vm(vm_name: str) -> str:
    """Power on a virtual machine by name."""
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                if str(obj.runtime.powerState) == "poweredOn":
                    view.Destroy()
                    return json.dumps({"status": "already powered on", "vm": vm_name})
                task = obj.PowerOn()
                view.Destroy()
                return json.dumps({"status": "power on task started", "vm": vm_name})
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


@mcp.tool()
def power_off_vm(vm_name: str, confirm: bool = False) -> str:
    """
    Power off a virtual machine by name.
    Requires confirm=True to prevent accidental shutdown.
    """
    if not confirm:
        return json.dumps({"error": "Set confirm=True to power off the VM."})
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                if str(obj.runtime.powerState) == "poweredOff":
                    view.Destroy()
                    return json.dumps({"status": "already powered off", "vm": vm_name})
                task = obj.PowerOff()
                view.Destroy()
                return json.dumps({"status": "power off task started", "vm": vm_name})
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


@mcp.tool()
def restart_vm(vm_name: str, confirm: bool = False) -> str:
    """
    Restart a virtual machine by name.
    Requires confirm=True to prevent accidental restart.
    """
    if not confirm:
        return json.dumps({"error": "Set confirm=True to restart the VM."})
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                task = obj.Reset()
                view.Destroy()
                return json.dumps({"status": "restart task started", "vm": vm_name})
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


# ── Host tools ─────────────────────────────────────────────────────────────────

@mcp.tool()
def list_hosts() -> str:
    """List all ESXi hosts with connection state, CPU cores, and memory."""
    si, content = get_content()
    try:
        view = container_view(content, vim.HostSystem)
        hosts = []
        for obj in view.view:
            try:
                hosts.append({
                    "name":             obj.name,
                    "connection_state": str(obj.runtime.connectionState),
                    "power_state":      str(obj.runtime.powerState),
                    "cpu_cores":        obj.hardware.cpuInfo.numCpuCores,
                    "memory_gb":        round(obj.hardware.memorySize / (1024**3), 2),
                    "model":            obj.hardware.systemInfo.model,
                    "vendor":           obj.hardware.systemInfo.vendor,
                    "version":          obj.config.product.version if obj.config else "",
                })
            except Exception:
                pass
        view.Destroy()
        return json.dumps(hosts, indent=2)
    finally:
        Disconnect(si)


@mcp.tool()
def get_host_performance(host_name: str) -> str:
    """Get CPU and memory utilisation for a specific ESXi host."""
    si, content = get_content()
    try:
        view = container_view(content, vim.HostSystem)
        for obj in view.view:
            if obj.name.lower() == host_name.lower():
                summary = obj.summary
                hardware = obj.hardware
                perf = {
                    "name":             obj.name,
                    "cpu_usage_mhz":    summary.quickStats.overallCpuUsage,
                    "cpu_total_mhz":    hardware.cpuInfo.numCpuCores * hardware.cpuInfo.hz // 1_000_000 if hardware else 0,
                    "memory_usage_mb":  summary.quickStats.overallMemoryUsage,
                    "memory_total_mb":  hardware.memorySize // (1024**2) if hardware else 0,
                }
                view.Destroy()
                return json.dumps(perf, indent=2)
        view.Destroy()
        return json.dumps({"error": f"Host '{host_name}' not found"})
    finally:
        Disconnect(si)


# ── Datastore tools ────────────────────────────────────────────────────────────

@mcp.tool()
def list_datastores() -> str:
    """List all datastores with capacity, free space, and accessibility."""
    si, content = get_content()
    try:
        view = container_view(content, vim.Datastore)
        datastores = []
        for obj in view.view:
            try:
                s = obj.summary
                datastores.append({
                    "name":         obj.name,
                    "type":         s.type,
                    "capacity_gb":  round(s.capacity / (1024**3), 2),
                    "free_gb":      round(s.freeSpace / (1024**3), 2),
                    "used_gb":      round((s.capacity - s.freeSpace) / (1024**3), 2),
                    "accessible":   s.accessible,
                })
            except Exception:
                pass
        view.Destroy()
        return json.dumps(datastores, indent=2)
    finally:
        Disconnect(si)


# ── Network tools ──────────────────────────────────────────────────────────────

@mcp.tool()
def list_networks() -> str:
    """List all networks and port groups in the vCenter inventory."""
    si, content = get_content()
    try:
        view = container_view(content, vim.Network)
        networks = []
        for obj in view.view:
            try:
                networks.append({
                    "name":       obj.name,
                    "accessible": obj.summary.accessible,
                })
            except Exception:
                pass
        view.Destroy()
        return json.dumps(networks, indent=2)
    finally:
        Disconnect(si)


# ── Snapshot tools ─────────────────────────────────────────────────────────────

@mcp.tool()
def list_vm_snapshots(vm_name: str) -> str:
    """List all snapshots for a specific VM."""
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                snaps = []
                if obj.snapshot:
                    def collect(snap_list):
                        for snap in snap_list:
                            snaps.append({
                                "name":        snap.name,
                                "description": snap.description,
                                "created":     str(snap.createTime),
                            })
                            collect(snap.childSnapshotList)
                    collect(obj.snapshot.rootSnapshotList)
                view.Destroy()
                return json.dumps(snaps, indent=2)
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


@mcp.tool()
def create_vm_snapshot(vm_name: str, snapshot_name: str, description: str = "") -> str:
    """Create a snapshot of a VM."""
    si, content = get_content()
    try:
        view = container_view(content, vim.VirtualMachine)
        for obj in view.view:
            if obj.name.lower() == vm_name.lower():
                obj.CreateSnapshot(
                    name=snapshot_name,
                    description=description,
                    memory=False,
                    quiesce=False,
                )
                view.Destroy()
                return json.dumps({"status": "snapshot task started", "vm": vm_name, "snapshot": snapshot_name})
        view.Destroy()
        return json.dumps({"error": f"VM '{vm_name}' not found"})
    finally:
        Disconnect(si)


# ── Summary / overview tools ───────────────────────────────────────────────────

@mcp.tool()
def get_inventory_summary() -> str:
    """Return a high-level count of VMs, hosts, and datastores in the environment."""
    si, content = get_content()
    try:
        vm_view = container_view(content, vim.VirtualMachine)
        host_view = container_view(content, vim.HostSystem)
        ds_view = container_view(content, vim.Datastore)

        powered_on = sum(1 for v in vm_view.view if str(v.runtime.powerState) == "poweredOn")

        summary = {
            "total_vms":       len(vm_view.view),
            "powered_on_vms":  powered_on,
            "powered_off_vms": len(vm_view.view) - powered_on,
            "total_hosts":     len(host_view.view),
            "total_datastores":len(ds_view.view),
        }
        vm_view.Destroy()
        host_view.Destroy()
        ds_view.Destroy()
        return json.dumps(summary, indent=2)
    finally:
        Disconnect(si)


@mcp.tool()
def get_alarms() -> str:
    """Return any triggered alarms in the vCenter environment."""
    si, content = get_content()
    try:
        alarms = []
        for alarm in content.rootFolder.triggeredAlarmState:
            try:
                alarms.append({
                    "entity":       alarm.entity.name,
                    "alarm":        alarm.alarm.info.name,
                    "status":       str(alarm.overallStatus),
                    "acknowledged": alarm.acknowledged,
                })
            except Exception:
                pass
        return json.dumps(alarms, indent=2)
    finally:
        Disconnect(si)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    transport = "sse" if "--sse" in sys.argv else "stdio"
    mcp.run(transport=transport)
