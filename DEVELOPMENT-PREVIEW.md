# TKDL local development preview

The TKDL preview deliberately uses its own PostgreSQL container and database. It never reuses the Replit-managed `DATABASE_URL`, the workspace-root API package, or Render credentials.

## Start

Start the existing **TKDL – Tesco Kitchen Darts League** web workflow (or run `pnpm --filter @workspace/tkdl run dev` from the TKDL repository root). Its package command starts the isolated TKDL database, the nested TKDL API, then Vite. The local database is created with a generated password in `.env.local` (mode `0600`, ignored by Git) and persists in a Docker named volume.

Before the API starts, the launcher applies the repository's canonical Drizzle schema only when the isolated database has no public tables. The force option is refused unless that emptiness check passes. The API then runs its existing startup migrations/seeds. Both steps target only the generated local URL.

The API refuses any non-production startup unless all of these are true:

- `TKDL_ENVIRONMENT=local-development`
- `DATABASE_URL` points to `127.0.0.1:55432/tkdl_dev`
- the database is reachable and healthy

The configured API startup runs the existing schema/data initialization against that isolated database. Production (`NODE_ENV=production`) retains its existing deployment-provided database behavior.

## Routing and readiness

Vite forwards `/api` and WebSocket paths to the nested TKDL API on port `18081`. Before starting the web server, the launcher checks the local-only `/api/local-preview/identity`, requires the startup readiness response, then validates that `/api/leaderboard` is an array of TKDL player rows. A generic HTTP 200 or JSON response from the unrelated workspace-root API is not sufficient. If either port is occupied, startup stops with an actionable message and does not kill any process.

Local preview sets `TKDL_DISABLE_BACKGROUND_JOBS=1`: broadcast publishing, scheduled notifications, season/card jobs and other runtime schedulers remain off. This flag is local-preview-only; deployed startup does not set it.

## Database commands

The preview starts PostgreSQL automatically. To inspect or stop it, run from the TKDL API package:

```sh
docker compose -p tkdl-development --env-file ../../.env.local -f docker-compose.dev.yml ps
docker compose -p tkdl-development --env-file ../../.env.local -f docker-compose.dev.yml down
```

Do not use `down -v` unless you intentionally want to delete the local Career test data and all initialized schema.

## Test accounts and Career saves

Use the application's normal registration/login and Career creation flows against the local preview. This keeps auth and save ownership real; no production identities or frontend-only sponsorship data are imported. Add fixtures only through existing authorized server-side development/test paths.

## Failure handling

- Docker unavailable: start Docker, then restart the TKDL web workflow.
- API or preview port occupied: identify the process using the port and stop it yourself; the launcher never kills unrelated processes.
- Database configuration rejected: remove `.env.local` only if it is corrupt, then restart; the local credential is generated again.
- API readiness timeout: inspect the TKDL web workflow logs for database initialization errors. Never substitute a remote database URL.

The independent root `artifacts/api-server` package and its artifact workflow remain unchanged.

## Git workspace guard

Run this from an actual clone of `graemelindsay0601-sketch/TKDL`, before beginning work and again before staging or pushing:

```sh
pnpm run guard:tkdl
```

The guard requires this project to be the Git root, verifies the configured GitHub remote, fetches the current `main` SHA, checks that `HEAD` descends from it, and rejects nested `.git` repositories. If a known starting SHA was agreed for the milestone, add `TKDL_EXPECTED_MAIN=<sha>` to detect a moved base. It reports dirty files for scope review; set `TKDL_GUARD_REQUIRE_CLEAN=1` when a clean tree is required.

Do not run the guard from a Replit workspace wrapper or source export: it intentionally fails rather than treating outer workspace history as TKDL history. For release, review the exact `git diff --name-only <verified-main>...HEAD`, then push only a verified fast-forward.

## Preview URL and visual verification

The Vite preview uses the configured `PORT` (default `3000`); the workflow log prints the corresponding localhost URL. For browser inspection use the Replit web preview for the TKDL artifact, not the API artifact or the component mockup server. A direct HTTP check is only a routing/readiness check, not visual acceptance. If the embedded capture tool returns its generic 404 while Vite is ready on the configured port, record that as a capture limitation and use an authorized browser against the actual TKDL preview URL; do not add unrelated route workarounds.
