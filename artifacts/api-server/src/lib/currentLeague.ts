import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { DEFAULT_LEAGUE_SLUG, DEFAULT_LEAGUE_NAME } from "@workspace/db/schema";
import { logger } from "./logger";

// ── Foundation piece of multi-tenant support ─────────────────────────────────
// The app was built for exactly one club (Tesco Kilbirnie Darts League) with
// no tenant concept anywhere. This is the single place a request resolves
// "which league" — every future league-scoped route should go through
// currentLeagueId(req) rather than re-deriving it.
//
// Today nothing sets `session.leagueId` (there's no login-time league picker
// or subdomain/path routing yet — see the scoping notes in
// schema/leagues.ts), so this always falls back to the one seeded default
// league. That's not a placeholder to "come back and fix" — it's the correct
// behavior for a single-league deployment. The seam exists so that when a
// second league is added and something (login, a subdomain, a path prefix)
// starts setting `session.leagueId`, every already-migrated call site picks
// it up automatically with no further changes.

let defaultLeagueIdPromise: Promise<number> | null = null;

// Cached — this is read on effectively every request once call sites adopt
// it, and the answer can't change without a server restart (there is no
// route today that alters which league is "default").
export async function getDefaultLeagueId(): Promise<number> {
  if (!defaultLeagueIdPromise) {
    defaultLeagueIdPromise = (async () => {
      const rows = await db.execute(sql`SELECT id FROM leagues WHERE slug = ${DEFAULT_LEAGUE_SLUG}`);
      const row = rows.rows[0] as { id: number } | undefined;
      if (row) return row.id;
      // Should be unreachable outside a fresh DB where addLeaguesTable
      // hasn't run yet — self-heal rather than throw, since a handful of
      // routes call this eagerly at startup-adjacent times.
      logger.warn({ slug: DEFAULT_LEAGUE_SLUG }, "Default league missing — creating it now");
      const inserted = await db.execute(sql`
        INSERT INTO leagues (slug, name) VALUES (${DEFAULT_LEAGUE_SLUG}, ${DEFAULT_LEAGUE_NAME})
        ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
        RETURNING id
      `);
      return (inserted.rows[0] as { id: number }).id;
    })();
  }
  return defaultLeagueIdPromise;
}

// The per-request resolver. `req` is untyped (`any`) to match this
// codebase's existing convention for session helpers (see e.g.
// routes/community.ts's sessionPlayerId) rather than introducing a new
// Express.Request augmentation for one field.
export async function currentLeagueId(req: any): Promise<number> {
  const fromSession = (req?.session as any)?.leagueId;
  if (typeof fromSession === "number") return fromSession;
  return getDefaultLeagueId();
}
