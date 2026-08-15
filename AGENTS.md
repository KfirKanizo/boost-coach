# BoostCoach.fit — Agent Workflow Guide

## Mandatory regression gate

**Every feature change or modification MUST end by running the full test
suites.** This is a hard workflow rule, not a suggestion.

Run from the repo root:

```sh
npm run test
```

Which executes, in order:

1. `npm run test:backend` — `docker compose run --rm -T api pytest`
   (backend pytest suite, transactional test DB)
2. `npm run test:frontend` — `npm --prefix frontend run test`
   (frontend Vitest + React Testing Library suite)

### Rules

- Tests are **manually triggered only**. There are NO git hooks, Husky,
  lint-staged, or pre-commit hooks in this repo — do not add them.
- A change is only "done" when both suites are green.
- If you add a feature, add or update a test for it in the same pass.
- Backend tests run inside the `api` Docker container against the isolated
  `boostcoach_test` database; the development database is never touched.
  Docker Desktop must be running.
- After changing `backend/requirements*.txt` or `backend/Dockerfile`, rebuild
  the image first: `docker compose build api`.

## Project layout

- `backend/` — FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL (see
  `backend/tests/` for the pytest suite).
- `frontend/` — React 19 + Vite + Tailwind + Capacitor (see
  `frontend/src/components/**/*.test.tsx` for the Vitest suite).
- `frontend/public/mediapipe/` — offline MediaPipe assets (WASM runtime +
  `pose_landmarker_lite.task`). Regenerate with
  `npm --prefix frontend run setup:mediapipe` (also wired as `postinstall`).
- `docker-compose.yml` — Postgres (`db`) + API (`api`) services.
