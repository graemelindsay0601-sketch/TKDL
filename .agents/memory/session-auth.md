---
name: Session auth pattern
description: express-session stores userId/playerId/isAdmin; repair middleware backfills old sessions; known credentials
---

# Session auth pattern

## The rule
The express-session (connect-pg-simple) must store three fields on login: `userId`, `playerId`, `isAdmin`. Auth middleware (`requireAuth`) checks `req.session.playerId`; admin middleware checks `req.session.isAdmin`.

**Why:** Old sessions created before `playerId`/`isAdmin` were added to the login handler only had `userId`. Those sessions caused 401 on any protected community/messages/notifications endpoint and 403 on admin deletes — even though the user appeared "logged in" (auth/me worked because it only checks `userId`).

**How to apply:** A repair middleware in `artifacts/api-server/src/app.ts` (~line 63) auto-backfills `playerId` and `isAdmin` from the users table on every request where they're missing. If you ever see 401s on protected endpoints despite a user being "logged in", check the sessions table: `SELECT sess FROM sessions` — if it only shows `"userId":N` without the other fields, the session is stale and the repair middleware should handle it on the next request (or clear all sessions with `DELETE FROM sessions`).

## Known accounts
- Graeme: username=`graeme`, userId=1, playerId=1, isAdmin=true. If locked out, reset password via DB using bcryptjs from artifacts/api-server/node_modules/bcryptjs.
