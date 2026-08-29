#!/usr/bin/env bash
# Run the whole test suite: API and authorisation, movement quality, assistant,
# and the client-side computer vision pipeline.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "→ Backend tests"
(cd "$ROOT/backend" && .venv/bin/python -m pytest tests -q)

echo
echo "→ Frontend tests"
(cd "$ROOT/frontend" && npx vitest run)
