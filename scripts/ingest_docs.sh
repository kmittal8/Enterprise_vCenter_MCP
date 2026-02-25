#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Trigger RAG document ingestion inside the running app container.
#
# Usage:
#   ./scripts/ingest_docs.sh
#
# Run this:
#   - On first deploy after dropping runbooks into the runbooks/ directory
#   - Any time you add, update, or remove runbook files
#
# The script re-embeds all documents (content-hash IDs prevent duplicates).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CONTAINER="vcenter_app"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Error: container '${CONTAINER}' is not running."
  echo "Run: docker-compose up -d"
  exit 1
fi

echo "Starting RAG document ingestion..."
docker exec -it "$CONTAINER" python -m rag.ingest

echo ""
echo "Ingest complete. New documents are now searchable in the chat."
