# PhysioPilot — architecture

This document explains why the system is shaped the way it is. The product
decisions drive the technical ones, so they come first.

---

## 1. The three principles that constrain everything

### The physiotherapist owns the prescription

The data hierarchy runs one way:

```
PHYSIOTHERAPIST PRESCRIPTION
        ↓
   PATIENT ROUTINE
        ↓
   CV MEASUREMENT
        ↓
   AI ASSISTANCE
```

This is enforced structurally, not by convention:

- Writing a `RehabilitationPlan` or a `PrescribedExercise` requires the
  `require_therapist` dependency **and** ownership of the patient
  (`therapist_patient`). There is no patient-accessible route that writes
  either table.
- The assistant is a read-only function over an assembled context object. It
  has no tools, no database session with write intent, and no code path to a
  plan mutation. Even a compromised model output cannot change a prescription;
  the worst it can do is say something, and the output guardrail catches that
  case too.
- A patient can only create `ExerciseSession` and `SessionRep` rows, and only
  for prescribed exercises that belong to their own plan.

### The patient app is simple; the complexity lives behind it

The patient sees a list of what to do and one large button per item. No scores,
no charts, no settings. Everything that is genuinely complicated — rep
classification, adherence arithmetic, trend detection, attention flags — runs on
the server and surfaces to the clinician.

The two interfaces share a design system but not a density: `patient-scale` runs
the type one step larger, and `Button size="xl"` exists solely for the patient
app.

### Nothing is invented

If the camera was not used, `quality_score`, `rom_max` and `reps_valid` stay
`null`, and both interfaces say "self-reported". If a repetition was not clearly
visible, it is excluded from the score rather than scored as zero. If there are
fewer than four sessions, the trend is `insufficient_data`, not "steady". Three
of the six catalogue exercises are labelled as not camera-tracked, because they
are not.

---

## 2. Stack

| Layer          | Choice                              | Why |
| -------------- | ----------------------------------- | --- |
| Frontend       | React + TypeScript + Tailwind       | Types across the API boundary; utility CSS keeps two densities consistent. |
| Backend        | FastAPI + SQLAlchemy 2.0            | Pydantic gives request validation and the OpenAPI contract for free. |
| Database       | SQLite locally, PostgreSQL-ready    | The schema uses no SQLite-specific features; only the URL changes. |
| Pose estimation| MediaPipe BlazePose (`tasks-vision`)| Pretrained, runs in the browser, good enough for sagittal knee/hip work. |
| Charts         | Recharts                            | Small, declarative, adequate for one line per chart. |
| Auth           | JWT (HS256) + bcrypt                | Stateless, simple to reason about at prototype scale. |

---

## 3. Where computer vision runs, and why

Pose estimation runs **on the patient's device**.

```
Camera frame
     ↓  (never leaves the device)
MediaPipe BlazePose  →  33 landmarks
     ↓
trackers.ts          →  joint angle + visibility
     ↓
repDetector.ts       →  completed repetitions with features
     ↓  (HTTPS: a few numbers per repetition)
services/quality.py  →  classification + Movement Quality Score
     ↓
Database             →  session, per-rep record, progress metric
```

Three consequences follow:

1. **Privacy.** No video is uploaded, stored, or processed server-side. The
   payload for a ten-repetition set is a few hundred bytes.
2. **Cost and latency.** Feedback appears within a frame; there is no inference
   server to run.
3. **The server stays authoritative on judgement.** The client reports what it
   measured; the server decides what that means. A client cannot declare its own
   quality score, and the scoring rules can change without shipping a new
   client.

The model and wasm runtime are served from `frontend/public/mediapipe/`, so the
demo runs with no internet connection and no CDN dependency at run time. They
are fetched once by `scripts/fetch-cv-assets.sh` rather than committed — 39 MB
of binaries do not belong in git history.

### Adding an exercise

One entry in `backend/app/catalogue.py` and, if it should be tracked, one
`TrackerDefinition` in `frontend/src/cv/trackers.ts`. Every tracker exposes the
same contract — a flexion angle where 0° is neutral — so the repetition
detector, the framing check, the overlay, the session screen and the scoring
layer all work unchanged. `sagittalTracker()` builds one from three landmark
indices.

---

## 4. Repetition detection

`frontend/src/cv/repDetector.ts` is a hysteresis state machine over a
median-filtered angle signal:

```
calibrating ──(baseline settled)──▶ rest ──(angle > rise)──▶ moving
                                     ▲                          │
                                     └────(angle < fall)────────┘
                                                │
                          (tracking lost > 1.5s) ▼
                                              lost
```

Design notes:

- **Two thresholds.** A patient hovering at a single threshold would otherwise
  produce a burst of phantom repetitions. Rise is 35% of the prescribed range,
  fall is 15%.
- **Thresholds are relative to the prescribed target.** The same detector serves
  a 35° leg raise and a 100° knee bend.
- **A calibrated baseline.** A post-operative knee at rest may sit at 15°.
  Assuming zero would make every repetition read short.
- **Median filter, not a moving average.** It rejects single-frame landmark
  spikes without smearing the peak, and the peak is the measurement that matters.
- **Under-range repetitions are still counted.** A patient who cannot reach the
  target still did work; whether it counts as *valid* is the server's call.
- **Dropouts are handled explicitly.** Frames with no usable pose never produce
  a repetition; a repetition interrupted for more than 1.5 seconds is discarded
  rather than guessed at, and `poseCoverage` records how much of the session was
  actually observable.

The module has no DOM or MediaPipe imports, which is what makes it testable
against synthetic movement traces.

---

## 5. The movement-quality layer

`backend/app/services/quality.py` is deliberately separate from pose
estimation, and is the designated place for machine learning.

Per repetition, from engineered features (peak angle, excursion, duration, peak
angular velocity, mean landmark visibility):

| Classification     | Condition                                    |
| ------------------ | -------------------------------------------- |
| `low_visibility`   | mean visibility < 0.5 — excluded from scoring |
| `too_fast`         | shorter than 1.0 s                            |
| `incomplete_range` | peak below 90% of the prescribed range        |
| `valid`            | everything else                               |

The **Movement Quality Score** is `0.7 × range + 0.3 × tempo`, where the range
term follows a square curve below the tolerance band so that a half-range
repetition scores clearly worse than a near miss. It is named for what it
measures — how closely execution matched the prescribed movement parameters —
and never described as clinical correctness.

The baseline implements a `RepClassifier` protocol and is injected as
`default_classifier`. Replacing it with a trained model (Random Forest on the
same features, or a temporal model over raw angle series) means implementing
one method; routers, schema and client are untouched. Storing every repetition
in `session_reps` is what makes that training set possible later.

---

## 6. Adherence and quality are different numbers

This distinction is load-bearing, so the schema keeps them apart:

- **Session adherence** — `reps_attempted`, and sessions completed versus
  sessions due. Answers *did the patient do the work?*
- **Movement quality** — `reps_valid`, `quality_score`, `rom_max`. Answers *how
  closely did the execution match the prescription?*

A patient can be at 100% adherence and 60% quality, or 50% adherence and 95%
quality. Those are different clinical conversations, and a single blended number
would hide both.

`compute_adherence` only counts days on which a plan was actually in force:
sessions due before the start date or after the end date are not counted, so a
patient is never penalised for days they had no prescription. Abandoned sessions
never count.

---

## 7. The assistant

`backend/app/services/assistant.py`.

```
patient question
      ↓
input guardrail   → emergency / medical / prescription-change / unprescribed
      ↓              activity: answered without ever calling the model
plan context      → assembled server-side from this patient's own records
      ↓
LLM (optional) or deterministic responder
      ↓
output guardrail  → a reply that would change the prescription is replaced
      ↓
reply + audit row in assistant_conversations
```

- **Grounding.** The context object is built from the database. The model is
  told to use only that. It cannot see other patients, and it has nothing to
  invent numbers from.
- **The guardrail runs even when the model is not called.** Requests to add
  exercises, change doses, skip sessions, or discuss medication are redirected
  to the physiotherapist before generation.
- **The output is checked too.** If the model produced a prescription change
  anyway, it is replaced rather than shown.
- **Urgent symptoms** get one response: stop, and contact a doctor or emergency
  services. The assistant does not triage.
- **No key required.** Without `PHYSIOPILOT_ANTHROPIC_API_KEY`, an intent-matched
  deterministic responder answers the same questions with the same guardrails.
  Every turn is stored with its `source` and whether it was redirected, which is
  what makes the assistant's behaviour auditable.

---

## 8. Authentication and authorisation

- Passwords: bcrypt, with explicit 72-byte truncation so behaviour is
  deterministic rather than an exception from inside the library.
- Tokens: JWT, HS256, subject = user id, expiry configurable. The role is
  carried in the token but **never trusted for authorisation** — every protected
  route re-reads the user and their profile from the database.
- `require_therapist` / `require_patient` narrow by role.
  `therapist_patient` additionally verifies assignment, and returns **404, not
  403**, for another clinic's patient so the API does not confirm that those
  records exist.
- Patient-scoped reads live under `/api/me/*` and take the patient id from the
  token, never from the URL. There is no route where a patient supplies their
  own id.
- Login returns the same message for an unknown email and a wrong password.

`PatientProfile.assigned_therapist_id` is the tenancy boundary. Moving to
clinic-level or multi-therapist access later means changing that one predicate,
not the routes.

---

## 9. Data model

```
User ─┬─ PhysiotherapistProfile ──< PatientProfile
      └─ PatientProfile
                │
                ├──< RehabilitationPlan ──< PrescribedExercise >── Exercise
                │                                   │
                ├──< ExerciseSession ───────────────┘
                │         └──< SessionRep
                ├──< ProgressMetric
                └──< AssistantConversation
```

Decisions worth noting:

- **`SessionRep` exists.** Storing per-repetition measurements rather than only
  session aggregates is what allows a therapist to see *which* repetitions fell
  short, and what provides training data for a future model.
- **`Exercise.cv_supported` and `tracker_key`.** The catalogue states plainly
  which exercises are measurable and which tracker measures them. Nothing infers
  it.
- **Editing a plan deactivates rather than deletes.** `_apply_items` reuses the
  existing `PrescribedExercise` row when the exercise stays in the plan, so
  historical sessions keep a live foreign key; exercises dropped from a plan are
  marked `active = False`. History is never orphaned or rewritten.
- **`ProgressMetric` is denormalised on purpose.** Longitudinal queries stay
  cheap, and a metric type can be added without touching the session tables.

---

## 10. Voice

`frontend/src/voice/speech.ts` exposes a `Speaker` interface, implemented by
browser speech synthesis. It prefers an `en-IN` voice, speaks slightly slower
than default, and suppresses a repeated cue within four seconds so guidance does
not become nagging. Failures are swallowed: voice is an enhancement and must
never break a session. Patients can turn it off mid-session.

The interface is the seam. A hosted Indian-language TTS becomes a second
implementation of `Speaker`; `PatientProfile.language` is already stored and
already threaded through.

---

## 11. Deployment shape

Local development is intentionally two processes and a file-based database.
The path to a deployment does not require restructuring:

```
Static frontend (S3 + CloudFront)
        │
        ▼
FastAPI (ECS or App Runner)  ──▶  PostgreSQL (RDS)
```

Pose estimation stays on the device, so there is no GPU tier and no video
storage — the largest cost and compliance burdens of this product category
simply do not arise. The frontend is a static bundle; the API is stateless
apart from the database, so it scales horizontally as-is.

Not built, deliberately: FHIR or hospital integration, payments, caregiver
accounts, notifications, offline support, and any microservice decomposition.

---

## 12. What we would do next

1. **Validate the measurement.** Compare app-reported knee flexion against
   goniometer readings on real patients. Every clinical claim beyond "observed
   movement" depends on this, and nothing in the interface makes one yet.
2. **Train the classifier** on collected `session_reps`, replacing the rule set
   behind the existing interface.
3. **Per-patient thresholds.** A target range is currently per prescription;
   compensation patterns and pain-limited ranges are individual.
4. **More trackers**, prioritised by which exercises therapists actually
   prescribe most.
5. **Hindi and Tamil**, voice first — for the target patient population this
   matters more than any additional feature.
