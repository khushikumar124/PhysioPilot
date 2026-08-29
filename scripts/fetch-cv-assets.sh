#!/usr/bin/env bash
# Fetch the pose-estimation assets the patient app needs.
#
# These are ~39 MB of binaries, so they are not committed. The wasm runtime is
# copied out of node_modules (so it always matches the installed @mediapipe
# version) and the model is downloaded once. After this runs, the app performs
# pose estimation with no further network access.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC="$ROOT/frontend/public/mediapipe"
VENDOR="$ROOT/frontend/node_modules/@mediapipe/tasks-vision/wasm"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

if [ ! -d "$VENDOR" ]; then
  echo "frontend/node_modules is missing. Run 'npm install' in frontend/ first." >&2
  exit 1
fi

mkdir -p "$PUBLIC/wasm" "$PUBLIC/models"

echo "→ Copying MediaPipe wasm runtime"
cp "$VENDOR"/* "$PUBLIC/wasm/"

if [ -f "$PUBLIC/models/pose_landmarker_lite.task" ]; then
  echo "→ Pose model already present"
else
  echo "→ Downloading pose model (~5.5 MB)"
  curl -fL --progress-bar -o "$PUBLIC/models/pose_landmarker_lite.task" "$MODEL_URL"
fi

echo "Computer-vision assets ready in frontend/public/mediapipe/"
