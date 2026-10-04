import { randomBytes } from "node:crypto";
import { Router } from "express";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { CareerDatabase } from "../career/database.ts";

export const careerBetaEnabled = (env: NodeJS.ProcessEnv = process.env) => env.CAREER_BETA_FIXTURE === "true";
const NAME = "Career Beta / Test Account";
const USERNAME = "career_beta_test";

/** Uses only the application's configured database. No Career results, money or
 * saves are seeded: the tester uses the real Career creation and live routes.
 * The private marker prevents adopting an existing user with a similar name.
 */
export async function bootstrapCareerBeta(database: CareerDatabase, env: NodeJS.ProcessEnv = process.env) {
  if (!careerBetaEnabled(env)) throw new Error("Career beta fixture is disabled");
  return database.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1864516501)`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_beta_fixture_account (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      user_id integer NOT NULL REFERENCES users(id),
      player_id integer NOT NULL REFERENCES players(id)
    )`);
    let record = (await tx.execute(sql`SELECT u.id, u.player_id, u.username, u.is_admin, p.name, p.player_id AS player_code
      FROM career_beta_fixture_account f JOIN users u ON u.id=f.user_id
      JOIN players p ON p.id=f.player_id WHERE u.player_id=f.player_id`)).rows[0];
    if (!record) {
      // A reserved-name collision fails the transaction; never adopt another account.
      const player = (await tx.execute(sql`INSERT INTO players(player_id,name,status,is_active)
        VALUES('CAREER_BETA_TEST',${NAME},'ACTIVE',true) RETURNING id`)).rows[0];
      const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
      const user = (await tx.execute(sql`INSERT INTO users(username,password_hash,player_id,is_admin)
        VALUES(${USERNAME},${passwordHash},${player.id},false) RETURNING id`)).rows[0];
      await tx.execute(sql`INSERT INTO career_beta_fixture_account(singleton,user_id,player_id) VALUES(true,${user.id},${player.id})`);
      record = { id: user.id, player_id: player.id, username: USERNAME, is_admin: false, name: NAME, player_code: "CAREER_BETA_TEST" };
    }
    if (record.is_admin !== false || record.username !== USERNAME || record.name !== NAME || record.player_code !== "CAREER_BETA_TEST")
      throw new Error("Beta fixture identity has changed; refusing login");
    await tx.execute(sql`INSERT INTO feature_flags(feature_name,enabled,admin_test_mode,description)
      VALUES('tour_career_2',true,false,'Career Beta test access')
      ON CONFLICT(feature_name) DO UPDATE SET enabled=true`);
    return { userId: Number(record.id), playerId: Number(record.player_id) };
  });
}

/** Mount after normal session/body middleware and before ordinary API routes. */
export function createCareerBetaRouter(database: CareerDatabase, env: NodeJS.ProcessEnv = process.env) {
  const router = Router();
  router.use((req, _res, next) => {
    // Turning the flag off revokes existing beta sessions as well as the entry route.
    if (!careerBetaEnabled(env) && (req.session as any)?.careerBeta === true) {
      req.session.regenerate(next);
    } else next();
  });
  router.use("/auth/career-beta", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!careerBetaEnabled(env)) { res.status(404).json({ error: "Not found" }); return; }
    next();
  });
  router.get("/auth/career-beta/status", (req, res) => {
    res.json({ enabled: true, testAccount: (req.session as any).careerBeta === true });
  });
  router.get("/auth/career-beta", (req, res) => {
    const token = randomBytes(32).toString("hex");
    (req.session as any).careerBetaToken = token;
    res.set("Content-Security-Policy", "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${NAME}</title><h1>${NAME}</h1><p>This is a shared test account in the separate Career beta. Anyone entering it can use its test saves. Do not enter personal information.</p><p>Your real TKDL account is not used. Career rules and ownership checks still apply.</p><form method="post" action="/api/auth/career-beta"><input type="hidden" name="token" value="${token}"><button type="submit">Enter Career Beta as Test Account</button></form></html>`);
  });
  router.post("/auth/career-beta", async (req, res, next) => {
    const session = req.session as any;
    if (Object.keys(req.query).length || !req.body || Object.keys(req.body).some(k => k !== "token")
      || typeof req.body.token !== "string" || !session.careerBetaToken || req.body.token !== session.careerBetaToken) {
      res.status(403).json({ error: "Open the beta sign-in page and use its entry button" }); return;
    }
    try {
      const identity = await bootstrapCareerBeta(database, env);
      await new Promise<void>((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
      Object.assign(req.session, identity, { isAdmin: false, careerBeta: true });
      await new Promise<void>((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
      res.redirect(303, "/career");
    } catch (error) { next(error); }
  });
  return router;
}
