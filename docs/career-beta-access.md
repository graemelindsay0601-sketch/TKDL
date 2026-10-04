# Isolated online Career beta access

Starting checkpoint: `d2baf3764208fdd44c57be858a9d923684c3db2e`, branch `feature/tour-career-2-foundation`.

## Render configuration (after review)

On **tkdl-career-beta only**, add this non-secret environment variable:

```text
CAREER_BETA_FIXTURE=true
```

Keep that service's own test `DATABASE_URL`, its own `SESSION_SECRET`, and `NODE_ENV=production`. No additional variable is needed. Do not change the live TKDL service. This change does not configure or deploy Render.

After deploying the reviewed commit, open `/login` and click **Enter Career Beta as Test Account**, or open `/api/auth/career-beta` directly. The server presents a clearly labelled confirmation page. Press **Enter Career Beta as Test Account** there. It establishes the normal secure TKDL session and redirects to `/career`.

Create a save, choose Career identity, generate the world, enter an affordable event, advance to the human match and play/resume it normally. There are no fixture wins, funds, altered opponents or sporting shortcuts. The existing local `career-ui-fixture-server.ts` remains a separate local scenario harness; this online entry uses the same real Career services through the application's normal routers.

## Boundaries

- Only the exact server-side string `true` enables access. Missing, `false`, `TRUE`, `1`, and whitespace-padded values do not.
- The normal password login, logout, `/auth/me`, session store, cookie settings, Career owner checks and admin gate are unchanged.
- The beta account is **non-admin** and is named **Career Beta / Test Account**. Login, Career saves and Career pages show a beta notice.
- This is deliberately a **shared test account**. Anyone who can reach the enabled beta can deliberately enter it and use its test saves. It is not a private owner-authentication mechanism. Do not put personal data in it.
- Entry requires a session-bound random form token. The server regenerates the session before assigning server-selected IDs and saves it before redirecting. Client IDs, admin flags and extra fields are rejected.
- The first successful entry creates a real `players` row, `users` row and a small singleton marker table in the configured beta database. A transaction and PostgreSQL advisory lock serialize bootstrap. A unique reserved player code/username prevents collisions; an existing unrelated account is never adopted. A generated random password hash has no disclosed/password-login credential.
- Re-entry reuses those records and leaves Career saves intact. It enables the existing `tour_career_2` feature flag in that database. No separate Career implementation is introduced.
- Removing the flag disables entry and clears previously marked beta sessions on their next API request. It does not delete test saves or disable the existing Career feature flag. Ordinary accounts are unaffected.
- No production connection, account import, password, session secret, or database URL is included or read by the bootstrap. Database isolation remains the deployment's explicit `DATABASE_URL` configuration.

## Verification

`node --test src/lib/__tests__/career-beta-auth.test.ts src/lib/__tests__/career-a65-live.test.ts` from `artifacts/api-server`: **13 passed**.

The five beta tests use real Express sessions with Secure/HttpOnly/SameSite=Strict cookies, isolated PGlite, the unchanged production authentication router, and actual Career services. They cover disabled flags, password login/me/logout, deliberate entry and session regeneration, ID injection rejection, idempotent bootstrap, real save initialization and live-session creation, denial of another owner's existing save/session, admin denial, retained saves on re-entry, and revocation when the flag is removed. PGlite uses a test-only no-op advisory-lock function; these tests prove sequential bootstrap idempotency, not PostgreSQL lock scheduling.

The eight existing A6.5 live tests cover the playable result path, set play, Double Crown and result concurrency. Frontend TypeScript passes. API TypeScript still reports the 12 existing broadcast errors; none concerns the beta change.

The local frontend build could not run because the installed dependencies lack `@rollup/rollup-win32-x64-msvc`. No build success or deployed-browser acceptance is claimed. The pre-existing `pnpm-lock.yaml` change is excluded from this task.

A7 has not been started. No Render settings or deployment were changed.
