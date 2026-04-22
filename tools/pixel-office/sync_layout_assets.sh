#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="web/frontend/public/assets"
DST_DIR="web/static/assets"

FILES=(
  "default-layout-1.json"
  "furniture-catalog.json"
  "asset-index.json"
)

echo "Syncing core asset manifests from ${SRC_DIR} -> ${DST_DIR}"
for f in "${FILES[@]}"; do
  cp "${SRC_DIR}/${f}" "${DST_DIR}/${f}"
  echo "  copied ${f}"
done

echo "Done."
