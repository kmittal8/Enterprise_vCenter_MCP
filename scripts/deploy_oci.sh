#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enterprise vCenter MCP — OCI Infrastructure Deploy
#
# REUSES existing OCVS VCN in ap-melbourne-1:
#   - Existing public subnet for the compute VM
#   - Existing route table (already has IGW route)
#
# CREATES new resources:
#   - Security list (ports 22 + 8501) attached to existing public subnet
#   - Compute VM (VM.Standard.E4.Flex, 2 OCPU / 8 GB) in public subnet
#   - Dynamic Group + IAM Policy (Instance Principal → GenAI access)
#
# PostgreSQL runs as a Docker container (pgvector/pgvector:pg16) on the VM.
# No managed OCI PostgreSQL needed.
#
# vCenter is reachable because the VM lands in the same VCN as the OCVS SDDC
# (private subnet 10.0.8.0/25 is the underlay; VCN-internal routing handles it)
#
# Prerequisites:
#   - OCI CLI installed and configured (~/.oci/config for ap-melbourne-1)
#   - jq installed (brew install jq)
#   - SSH key at ~/.ssh/id_rsa.pub
#
# Usage:
#   chmod +x scripts/deploy_oci.sh && ./scripts/deploy_oci.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── EXISTING RESOURCES — fill in before running ───────────────────────────────
COMPARTMENT_ID="YOUR_COMPARTMENT_OCID"
REGION="ap-melbourne-1"                  # region where your OCVS/vCenter lives
GENAI_REGION="ap-hyderabad-1"            # OCI GenAI region

# Existing VCN (OCVS VCN — must be in same region as vCenter)
# oci network vcn list --compartment-id $COMPARTMENT_ID --region $REGION
VCN_ID="YOUR_VCN_OCID"

# Existing public subnet in the VCN — VM will be placed here
# oci network subnet list --compartment-id $COMPARTMENT_ID --vcn-id $VCN_ID
EXISTING_PUBLIC_SUBNET_ID="YOUR_PUBLIC_SUBNET_OCID"

# Existing route table with internet gateway route
EXISTING_RT_ID="YOUR_ROUTE_TABLE_OCID"

# ── NEW RESOURCES CONFIG ──────────────────────────────────────────────────────
AD="WGog:AP-MELBOURNE-1-AD-1"
SHAPE="VM.Standard.E4.Flex"
OCPUS=2
MEMORY_GB=8

# Oracle Linux 9.7 (latest as of 2026-01-29) for ap-melbourne-1
OS_IMAGE_ID="ocid1.image.oc1.ap-melbourne-1.aaaaaaaa4fhwapny4ya23g2z6gp6aq5ffbsimo6mzekvoepjpgcp3yfallna"

SSH_PUBLIC_KEY_PATH="$HOME/.ssh/id_rsa.pub"
PREFIX="vcenter-mcp"
# ─────────────────────────────────────────────────────────────────────────────

echo "=== Enterprise vCenter MCP — OCI Deploy ==="
echo "Region: $REGION | GenAI Region: $GENAI_REGION"
echo "Reusing existing OCVS VCN: $VCN_ID"
echo ""

# ── [1/4] Security list (ports 22 + 8501) → attach to existing public subnet ──
echo "[1/4] Creating security list for VM (ports 22 + 8501)..."
VM_SL_ID=$(oci network security-list create \
  --compartment-id "$COMPARTMENT_ID" \
  --vcn-id "$VCN_ID" \
  --display-name "${PREFIX}-vm-sl" \
  --region "$REGION" \
  --ingress-security-rules '[
    {"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":22,"max":22}},"isStateless":false,"description":"SSH"},
    {"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":8501,"max":8501}},"isStateless":false,"description":"Streamlit"}
  ]' \
  --egress-security-rules '[{"destination":"0.0.0.0/0","protocol":"all","isStateless":false}]' \
  --query 'data.id' --raw-output)
echo "  Security list: $VM_SL_ID"

# Get the existing SL already on the public subnet and append our new one
# Existing security list already attached to the public subnet
# oci network security-list list --compartment-id $COMPARTMENT_ID --vcn-id $VCN_ID
EXISTING_SL_ID="YOUR_EXISTING_SECURITY_LIST_OCID"
oci network subnet update \
  --subnet-id "$EXISTING_PUBLIC_SUBNET_ID" \
  --security-list-ids "[\"$EXISTING_SL_ID\",\"$VM_SL_ID\"]" \
  --region "$REGION" \
  --force > /dev/null
echo "  Security list attached to public subnet"

# ── [2/4] Compute instance ────────────────────────────────────────────────────
echo "[2/4] Launching compute VM in existing public subnet..."
INSTANCE_ID=$(oci compute instance launch \
  --compartment-id "$COMPARTMENT_ID" \
  --availability-domain "$AD" \
  --shape "$SHAPE" \
  --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEMORY_GB}" \
  --image-id "$OS_IMAGE_ID" \
  --subnet-id "$EXISTING_PUBLIC_SUBNET_ID" \
  --display-name "${PREFIX}-vm" \
  --assign-public-ip true \
  --ssh-authorized-keys-file "$SSH_PUBLIC_KEY_PATH" \
  --region "$REGION" \
  --wait-for-state RUNNING \
  --max-wait-seconds 300 \
  --query 'data.id' --raw-output)
echo "  Instance: $INSTANCE_ID"

PUBLIC_IP=$(oci compute instance list-vnics \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'data[0]."public-ip"' --raw-output)
echo "  Public IP: $PUBLIC_IP"

# ── [3/4] IAM Dynamic Group + Policy (Instance Principal → GenAI) ─────────────
echo "[3/4] Creating IAM Dynamic Group and Policy..."
TENANCY_ID=$(oci iam tenancy get --query 'data.id' --raw-output)

DG_NAME="${PREFIX}-dg"
oci iam dynamic-group create \
  --name "$DG_NAME" \
  --description "vCenter MCP Compute VM — Instance Principal auth for GenAI" \
  --matching-rule "ANY {instance.id = '$INSTANCE_ID'}" \
  --wait-for-state ACTIVE 2>/dev/null || echo "  (dynamic group may already exist)"

oci iam policy create \
  --compartment-id "$TENANCY_ID" \
  --name "${PREFIX}-genai-policy" \
  --description "Allow vCenter MCP VM to call OCI GenAI in hyderabad" \
  --statements "[
    \"allow dynamic-group ${DG_NAME} to use generative-ai-family in compartment id ${COMPARTMENT_ID}\"
  ]" 2>/dev/null || echo "  (policy may already exist)"

# ── [4/4] Print next steps ───────────────────────────────────────────────────
echo ""
echo "[4/4] Deploy complete!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VM Public IP: $PUBLIC_IP"
echo "  SSH:          ssh opc@$PUBLIC_IP"
echo "  App URL:      http://$PUBLIC_IP:8501  (after docker-compose up)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps on the VM (ssh opc@$PUBLIC_IP):"
echo ""
echo "  1. Install Docker + Compose:"
echo "     sudo dnf install -y docker"
echo "     sudo systemctl enable --now docker"
echo "     sudo usermod -aG docker opc && newgrp docker"
echo "     sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose"
echo "     sudo chmod +x /usr/local/bin/docker-compose"
echo ""
echo "  2. Open OS firewall for Streamlit:"
echo "     sudo firewall-cmd --permanent --add-port=8501/tcp && sudo firewall-cmd --reload"
echo ""
echo "  3. Copy repo to VM (run from your Mac):"
echo "     scp -r \$(pwd) opc@$PUBLIC_IP:~/Enterprise_vCenter_MCP"
echo ""
echo "  4. Start the app (on the VM):"
echo "     cd ~/Enterprise_vCenter_MCP"
echo "     docker-compose up -d"
echo "     docker-compose ps"
echo ""
echo "  5. Access: http://$PUBLIC_IP:8501"
