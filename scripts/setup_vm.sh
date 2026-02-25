#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise vCenter MCP — VM bootstrap
#
# Run once on the OCI compute VM (Oracle Linux 9) after SSH-ing in:
#   bash ~/Enterprise_vCenter_MCP/scripts/setup_vm.sh
#
# What it does:
#   1. Installs Docker + enables service
#   2. Installs Docker Compose v2 plugin
#   3. Opens OS firewall for Streamlit (port 8501)
#   4. Adds opc to the docker group
#   5. Starts the application via docker-compose
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Enterprise vCenter MCP — VM Bootstrap ==="
echo "Repo: $REPO_DIR"
echo ""

# ── [1/5] Docker ──────────────────────────────────────────────────────────────
echo "[1/5] Installing Docker..."
sudo dnf install -y docker
sudo systemctl enable --now docker
echo "  Docker $(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"

# ── [2/5] Docker Compose ──────────────────────────────────────────────────────
echo "[2/5] Installing Docker Compose..."
COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"
sudo curl -fsSL "$COMPOSE_URL" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
echo "  $(docker-compose --version)"

# ── [3/5] Firewall ────────────────────────────────────────────────────────────
echo "[3/5] Opening firewall port 8501 (Streamlit)..."
sudo firewall-cmd --permanent --add-port=8501/tcp
sudo firewall-cmd --reload
echo "  Done"

# ── [4/5] Docker group ────────────────────────────────────────────────────────
echo "[4/5] Adding opc to docker group..."
sudo usermod -aG docker opc
echo "  Done (effective after re-login, but we use sudo below for first run)"

# ── [5/5] Start application ───────────────────────────────────────────────────
echo "[5/5] Starting application..."
cd "$REPO_DIR"

if [ ! -f .env ]; then
  echo "  ERROR: .env not found in $REPO_DIR"
  echo "  Copy .env.example to .env and fill in your values, then re-run:"
  echo "    cd $REPO_DIR && docker-compose up -d"
  exit 1
fi

sudo docker-compose up -d
echo ""
sudo docker-compose ps
echo ""

PUBLIC_IP=$(curl -s http://169.254.169.254/opc/v1/instance/ 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
    [print(v) for v in d.get('metadata',{}).values() if False]" 2>/dev/null || true)

# Simpler: just use the hostname or let user check
echo "═══════════════════════════════════════════════════════════════"
echo "  Bootstrap complete!"
echo "  App: http://$(curl -s ifconfig.me 2>/dev/null || echo '<VM_PUBLIC_IP>'):8501"
echo ""
echo "  Useful commands:"
echo "    docker-compose logs -f app          # stream app logs"
echo "    docker-compose logs -f mcp_server   # stream MCP server logs"
echo "    docker-compose restart app          # restart after config change"
echo "    docker-compose down && docker-compose up -d   # full restart"
echo "═══════════════════════════════════════════════════════════════"
