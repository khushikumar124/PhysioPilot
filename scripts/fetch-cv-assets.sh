#!/usr/bin/env bash
# Fetch the pose model and wasm runtime (~39 MB, deliberately not committed).
#
# The real work lives in frontend/scripts/fetch-cv-assets.mjs so that the same
# code runs here and as the frontend's prebuild step on Vercel. This wrapper
# just keeps the familiar path working.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "frontend/node_modules is missing. Run 'npm install' in frontend/ first." >&2
  exit 1
fi
node scripts/fetch-cv-assets.mjs
