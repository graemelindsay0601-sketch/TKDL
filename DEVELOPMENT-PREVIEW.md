# TKDL local development preview

The TKDL preview deliberately uses its own PostgreSQL container and database. It never reuses the Replit-managed `DATABASE_URL`, the workspace-root API package, or Render credentials.

## Start

Start the existing **TKDL – Tesco Kitchen Darts League** web workflow. Its package command now starts the isolated TKDL database, the nested TKDL API, then Vite. The local database is created with a generated password in `TKDL-E2-implementation/.env.local` (mode `0600`, ignored by Git) and persists in a Docker named volume.

Before the API starts, the launcher applies the repository's canonical Drizzle schema only when the isolated database has no public tables. The force option is refused unless that emptiness check passes. The API then runs its existing startup migrations/seeds. Both steps target only the generated local URL.

The API refuses any non-production startup unless all of these are true:

- `TKDL_ENVIRONMENT=local-development`
- `DATABASE_URL` points to `127.0.0.1:55432/tkdl_dev`
- the database is reachable and healthy

The configured API startup runs the existing schema/data initialization against that isolated database. Production (`NODE_ENV=production`) retains its existing deployment-provided database behavior.

## Routing and readiness

Vite forwards `/api` and WebSocket paths to the nested TKDL API on port `18081`. The preview launcher waits until `GET /api/leaderboard` returns JSON before starting the web server. It does not route through the separate workspace-root API artifact.

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
- Database configuration rejected: remove `.env.local` only if it is corrupt, then restart; the local credential is generated again.
- API readiness timeout: inspect the TKDL web workflow logs for database initialization errors. Never substitute a remote database URL.

The independent root `artifacts/api-server` package and its artifact workflow remain unchanged.
