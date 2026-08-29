# PhysioPilot

**From prescription to recovery.**

PhysioPilot is a rehabilitation support tool that keeps a physiotherapist
connected to what their patient actually does at home. The physiotherapist
prescribes a routine; the patient follows it in a deliberately simple app; the
camera measures how the movement was performed; the physiotherapist sees
adherence and observed movement, and adjusts the prescription.

```
PRESCRIBE → FOLLOW → MEASURE → ASSIST → REPORT → ADAPT
```

PhysioPilot is **not** a diagnostic system and does not replace a
physiotherapist. It records exercise adherence and observed movement.

---

## Quick start

```bash
scripts/setup.sh
```

Then:

```bash
scripts/dev.sh
```

Open <http://localhost:5173>.

| Role             | Email                            | Password    |
| ---------------- | -------------------------------- | ----------- |
| Physiotherapist  | `ananya.rao@physiopilot.demo`    | `physio123` |
| Patient          | `rahul.kumar@physiopilot.demo`   | `physio123` |
| Patient          | `priya.sharma@physiopilot.demo`  | `physio123` |
| Patient          | `suresh.menon@physiopilot.demo`  | `physio123` |

The login screen has buttons that fill these in.

### Manual setup

<details>
<summary>If you would rather run the steps yourself</summary>

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m app.seed --reset      # creates physiopilot.db with demo data
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
../scripts/fetch-cv-assets.sh   # pose model + wasm runtime, ~39 MB, once
npm run dev
```

</details>

API docs are served at <http://127.0.0.1:8000/docs>.

---

## The demo walkthrough

1. **Sign in as Dr. Ananya Rao.** The dashboard shows three patients. Priya
   Sharma is flagged: her adherence is 54% and her observed range is trending
   down.
2. **Open Rahul Kumar.** Adherence 88%, movement quality 92%, and a range-of-
   movement curve per exercise with the prescribed target drawn as a dashed
   line.
3. **Modify prescription.** Change knee flexion to 3 × 12 and raise the target
   range. Save.
4. **Sign out, sign in as Rahul.** Today's routine already shows the change.
5. **Press START on Knee Flexion.** The app explains where to put the phone,
   opens the camera, guides positioning ("Please move the phone a little
   farther away"), then counts repetitions out loud while measuring the knee
   angle.
6. **Finish.** The patient sees "You completed 9 of 10 repetitions. 8 of 9
   matched the movement your physiotherapist asked for."
7. **Back on the clinician dashboard**, the session, adherence and the new
   range-of-movement point are all there.

The camera needs `localhost` or HTTPS. To try it on a phone, expose the dev
server over HTTPS (for example with a tunnel) — the browser blocks camera
access on plain HTTP.

---

## What is real, and what is not

This prototype tries hard not to fake anything.

**Real**

- Pose estimation with MediaPipe BlazePose, running entirely in the browser.
  The model and wasm runtime are fetched once by `scripts/setup.sh`; after that
  the app needs no network for tracking.
  Video never leaves the device; only per-repetition angle measurements are sent
  to the server.
- Joint-angle measurement, repetition counting and range of movement for knee
  flexion (also used for heel slides) and hip flexion (straight leg raise).
- A movement-quality layer on the server that classifies every repetition and
  explains why it did.
- Real authentication, role-based access control, and per-tenant isolation.
- An assistant that answers only from the patient's own prescription and cannot
  change it.

**Deliberately limited**

- Three of the six catalogue exercises (knee extension, sit-to-stand, shoulder
  flexion) are **not** camera-tracked. They are prescribable and self-reported,
  and both interfaces label them that way. Adding a tracker for them means
  adding one entry to `frontend/src/cv/trackers.ts`.
- Camera positioning is checked by landmark visibility and how much of the frame
  the body fills. It does **not** verify the camera angle or the plane of
  movement. The app asks the patient to sit side-on rather than pretending to
  detect it.
- Angles are measured in 2D image space. That is adequate for sagittal-plane
  knee and hip movement viewed from the side; it is not a goniometer, and a
  patient rotated towards the camera will read low.
- Self-reported sessions record adherence and store `null` for quality, range
  and valid repetitions. No number is invented to fill a dashboard.
- The movement-quality baseline is an explainable rule set over engineered
  features, not a trained model. The interface it implements is the seam where
  a trained model goes later.
- Voice is browser speech synthesis, English only. The architecture threads a
  `language` field through for Hindi/Tamil TTS later.

---

## Testing

```bash
scripts/test.sh
```

- **Backend** (`backend/tests`): registration and login, role-based access,
  cross-tenant isolation, prescription authoring and modification, the session
  lifecycle, adherence arithmetic, progress metrics, the movement-quality
  classifier, and the assistant's guardrails.
- **Frontend** (`frontend/src/cv/__tests__`): the computer-vision pipeline
  against synthetic movement traces — clean sets, under-range movement, fast and
  slow tempo, a non-zero resting position, threshold hovering, dropped frames,
  the patient leaving the frame mid-repetition, and joint-angle measurement from
  constructed landmark sets.

---

## Project layout

```
backend/
  app/
    main.py            FastAPI app, CORS, error handling
    config.py          settings from environment / .env
    models.py          SQLAlchemy schema
    schemas.py         request and response contracts
    security.py        password hashing, JWT
    deps.py            authentication and RBAC dependencies
    catalogue.py       the prescribable exercises
    seed.py            demo clinic and historical sessions
    routers/           auth, exercises, patients, plans, sessions, me
    services/
      quality.py       movement-quality layer (swap-in point for a model)
      analytics.py     adherence, trends, attention flags
      assistant.py     constrained assistant and its guardrails
  tests/
frontend/
  src/
    api/               typed client and shared types
    auth/              session context and route guards
    components/        design system and layouts
    cv/                landmarks, trackers, repetition detection, framing
    voice/             speech output behind a swappable interface
    pages/
      therapist/       dashboard, patient profile, prescription builder
      patient/         today, session, progress, assistant
  public/mediapipe/    pose model and wasm runtime, fetched by setup (not in git)
docs/ARCHITECTURE.md
scripts/               setup, dev, test
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design decisions
behind this structure.

---

## Configuration

All configuration is environment-driven; nothing is hardcoded. Copy
`backend/.env.example` to `backend/.env`.

| Variable                            | Purpose                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| `PHYSIOPILOT_SECRET_KEY`            | JWT signing key. **Must** be set outside local development.    |
| `PHYSIOPILOT_DATABASE_URL`          | SQLite locally; point at PostgreSQL for a deployment.          |
| `PHYSIOPILOT_CORS_ORIGINS`          | Comma-separated allowed origins.                               |
| `PHYSIOPILOT_ANTHROPIC_API_KEY`     | Optional. Enables the LLM-backed assistant.                    |
| `PHYSIOPILOT_ASSISTANT_MODEL`       | Model id for the assistant.                                    |

Without an API key the assistant falls back to a deterministic responder that
handles the same questions with the same guardrails, so the demo works with no
external dependency.
