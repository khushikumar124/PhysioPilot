#!/usr/bin/env bash
# One-time setup: Python virtualenv, node modules, seeded demo database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Backend"
cd "$ROOT/backend"
python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt
[ -f .env ] || cp .env.example .env
.venv/bin/python -m app.seed --reset

echo "→ Frontend"
cd "$ROOT/frontend"
npm install

echo "→ Computer-vision assets"
"$ROOT/scripts/fetch-cv-assets.sh"

echo
echo "Setup complete. Start everything with: scripts/dev.sh"
