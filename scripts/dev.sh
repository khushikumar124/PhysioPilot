#!/usr/bin/env bash
# Start the API and the web app together for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "Backend virtualenv missing. Run scripts/setup.sh first." >&2
  exit 1
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

(
  cd "$ROOT/backend"
  .venv/bin/uvicorn app.main:app --reload --port 8000
) &

(
  cd "$ROOT/frontend"
  npm run dev
) &

wait
