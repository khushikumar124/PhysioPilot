# PhysioPilot — web app

React + TypeScript + Tailwind. Two interfaces from one design system: an
information-dense clinician dashboard and a deliberately simple patient app.

```bash
npm install
../scripts/fetch-cv-assets.sh   # pose model + wasm runtime (once)
npm run dev     # expects the API on http://127.0.0.1:8000 (proxied via /api)
npm run test    # computer-vision pipeline tests
npm run build
```

Pose estimation runs in the browser. The MediaPipe model and wasm runtime live
in `public/mediapipe/` — fetched by `scripts/fetch-cv-assets.sh` rather than
committed, since they are ~39 MB of binaries. Once fetched, tracking needs no
network.

See the [project README](../README.md) and
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
