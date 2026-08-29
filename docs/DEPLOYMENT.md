# Deployment

The frontend and the API are deployed separately:

| Part | Host | Why |
| --- | --- | --- |
| React app | Vercel | Static build on a CDN, and HTTPS by default — which the camera requires |
| FastAPI + Postgres | Render | A process that stays warm, and a database that persists |

## Why not the API on Vercel too

Vercel functions have an ephemeral filesystem, so a SQLite file cannot survive
there — the database would reset on cold starts, and a patient's completed
session would vanish before the clinician saw it. Postgres solves that, but the
1–3 second cold start remains, and it lands on whichever click comes first.

For a live demo, a warm process is worth the second platform.

---

## 1. API on Render

Render reads `render.yaml` at the repo root, which declares the web service and
a Postgres database together.

1. Render dashboard → **New** → **Blueprint** → select this repository.
2. Approve the plan. It creates `physiopilot-api` and `physiopilot-db`, and
   wires `PHYSIOPILOT_DATABASE_URL` from the database automatically.
3. Leave `PHYSIOPILOT_CORS_ORIGINS` blank for now — you do not have the Vercel
   URL yet. Deploy, and note the API URL, e.g.
   `https://physiopilot-api.onrender.com`.
4. Check `https://<api-url>/api/health` returns `{"status":"ok"}`.

`PHYSIOPILOT_SECRET_KEY` is generated once by Render. **Do not regenerate it**
— every existing session is signed with it and would be invalidated.

`PHYSIOPILOT_SEED_DEMO_ON_STARTUP` is `true` in the blueprint, so the demo
clinic is created on first boot. It only runs when the database has no users,
so redeploys leave your data alone. Set it to `false` once real data exists.

## 2. Frontend on Vercel

1. Vercel → **Add New** → **Project** → import this repository.
2. Leave the framework preset as-is; `vercel.json` supplies the build settings.
3. Add an environment variable:

   | Name | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | your Render API URL, no trailing slash |

4. Deploy, and note the Vercel URL.

The install command runs `scripts/fetch-cv-assets.sh`, which downloads the pose
model and copies the wasm runtime. These are not in git — without that step the
app deploys but the camera never starts.

## 3. Connect the two

Back in Render, set `PHYSIOPILOT_CORS_ORIGINS` to your Vercel URL and redeploy:

```
https://physiopilot.vercel.app
```

No trailing slash. Comma-separate several (a preview URL, a custom domain).
Until this is set the browser blocks every API call, and the app will look
broken while the API is perfectly healthy.

## Checks after deploying

1. `GET /api/health` returns ok.
2. Sign in as `ananya.rao@physiopilot.demo` / `physio123` — proves CORS, the
   database, and seeding all work.
3. Open the patient app on a **phone** and start a camera session. This is the
   thing local development cannot test: it needs the HTTPS that Vercel gives
   you.
4. Complete a session as the patient, then reload the clinician dashboard and
   confirm the session count moved.

## Known limits of the free tiers

**Render free web services sleep after inactivity**, and the next request takes
around 50 seconds to wake the service. Before presenting, open the API URL a
minute beforehand so it is awake. If the demo matters, the paid instance
removes this entirely and is the single best money you can spend here.

**Render free Postgres expires after 90 days.** Note the date you created it.

The pose model is 5.5 MB and the wasm runtime is larger; both are cached with
long-lived immutable headers, so only the first camera session on a device
pays that cost.

## Environment variables

### API (Render)

| Variable | Required | Notes |
| --- | --- | --- |
| `PHYSIOPILOT_DATABASE_URL` | yes | Wired from the database by the blueprint. `postgres://` is normalised automatically |
| `PHYSIOPILOT_SECRET_KEY` | yes | Generated once. Changing it signs everyone out |
| `PHYSIOPILOT_CORS_ORIGINS` | yes | The Vercel URL. Nothing works without it |
| `PHYSIOPILOT_SEED_DEMO_ON_STARTUP` | no | `true` creates the demo clinic on an empty database |
| `PHYSIOPILOT_ANTHROPIC_API_KEY` | no | Enables the LLM assistant; without it the deterministic responder is used |

### Frontend (Vercel)

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | Render API origin, no trailing slash. Empty locally so Vite proxies instead |
