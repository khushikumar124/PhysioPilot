# Deployment

Everything runs as **one Vercel project**, using
[Vercel Services](https://vercel.com/docs/services) to build the React app and
the FastAPI API separately while serving them from one domain.

```
vercel.json
  services.web  -> frontend/   (Vite build, served as static files)
  services.api  -> backend/    (FastAPI, entrypoint app.main:app)

  /api/*  -> api service
  /*      -> web service
```

Because both are on the same origin there is **no CORS to configure** — the
single most common way this kind of deployment goes wrong simply does not
apply. The frontend calls `/api/...` relatively, exactly as it does locally.

The database is Postgres, added from the Vercel Marketplace (Neon has a free
tier).

## 1. Create the database

1. Vercel dashboard → **Storage** → **Create Database** → **Neon** (Postgres).
2. Connect it to your project. Vercel injects `DATABASE_URL` and friends.
3. Copy the **pooled** connection string. Use the pooled one — serverless opens
   many short-lived connections, and the direct string will exhaust the
   connection limit under any real use.

## 2. Prepare the schema

Serverless functions must not do schema work on every cold start, so this is
run once, deliberately, from your machine against the remote database:

```bash
cd backend
PHYSIOPILOT_DATABASE_URL="<pooled connection string>" \
  .venv/bin/python -m app.deploy --seed-demo
```

This creates the tables, applies column migrations, syncs the exercise
catalogue, and seeds the demo clinic. Re-run it (without `--seed-demo`) after
any change that adds a column.

## 3. Deploy

1. Vercel → **Add New** → **Project** → import this repository.
2. Leave the build settings alone — `vercel.json` defines both services.
3. Set environment variables (Project → Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `PHYSIOPILOT_DATABASE_URL` | the pooled Postgres connection string |
   | `PHYSIOPILOT_SECRET_KEY` | a long random string — see below |

   Generate a key with:

   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Keep it. Changing it invalidates every existing session.

4. Deploy.

`VITE_API_BASE_URL` is **not** needed: same origin, so relative requests work.
`PHYSIOPILOT_CORS_ORIGINS` is not needed either, for the same reason.

Optionally set `PHYSIOPILOT_ANTHROPIC_API_KEY` to enable the LLM-backed
assistant. Without it the assistant falls back to its deterministic responder
and still answers every question the product promises.

## Checks after deploying

1. `https://<your-app>.vercel.app/api/health` returns `{"status":"ok"}`.
2. Sign in as `ananya.rao@physiopilot.demo` / `physio123` — this proves the
   database, the routing, and the seeding all work together.
3. Open the patient app **on a phone** and start a camera session. This is the
   thing local development cannot test: it needs the HTTPS Vercel provides.
4. Complete a session as the patient, reload the clinician dashboard, and check
   the session count moved.

## Things worth knowing

**Cold starts.** An idle function takes roughly a second or two to wake, and it
lands on whichever request comes first. Before presenting, load the site once so
the function is warm. This is far shorter than a sleeping container elsewhere,
but it is not zero.

**The Hobby plan is for non-commercial use.** A student prototype and a demo sit
comfortably inside that. If PhysioPilot starts earning money, the plan needs to
change — worth knowing now rather than later.

**The CV assets are not in git.** `frontend/scripts/fetch-cv-assets.mjs` runs as
the frontend's `prebuild`, so Vercel fetches them automatically. Without that
step the app would deploy looking fine and the camera would silently never
start.

**Function bundle size.** The API bundle is small (FastAPI, SQLAlchemy, psycopg,
bcrypt), well inside the limit. The 39 MB of pose assets belong to the web
service and are served as static files, not bundled into the function.

## Environment variables

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `PHYSIOPILOT_DATABASE_URL` | Vercel | yes | Pooled Postgres string. `postgres://` is normalised automatically |
| `PHYSIOPILOT_SECRET_KEY` | Vercel | yes | Long random string. Changing it signs everyone out |
| `PHYSIOPILOT_ANTHROPIC_API_KEY` | Vercel | no | Enables the LLM assistant |
| `PHYSIOPILOT_ACCESS_TOKEN_EXPIRE_MINUTES` | Vercel | no | Defaults to 720 |
| `PHYSIOPILOT_RUN_STARTUP_TASKS` | Vercel | no | Auto-detected off on Vercel; only set it to override |

## Local development is unchanged

```bash
./scripts/dev.sh
```

SQLite, both servers, Vite proxying `/api` to the backend. None of the above
affects it.
