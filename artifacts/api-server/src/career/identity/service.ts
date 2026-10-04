import { sql } from "drizzle-orm";
import { z } from "zod";
import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError, PROFILE_VERSION } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import { AGE_POLICY, ageOn, careerStartDateFor, careerWeekDate, eligibleFrom, validateDateOfBirth } from "./age.ts";

/**
 * A6.5 Career identity: read the save's profile, and let a legacy save (created
 * before A6.5, so PROFILE_INCOMPLETE) set its date of birth ONCE. The DOB is then
 * immutable (DB trigger). Sporting progression is gated until it is set.
 */
const setProfileSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  homeLocality: z.string().min(1).max(80).optional(),
}).strict();

type ProfileRow = { dob: string | null; start: string; home_locality: string | null; display_name: string | null };

async function profileOf(tx: CareerExecutor, saveId: string): Promise<ProfileRow | null> {
  return ((await tx.execute(sql`SELECT to_char(date_of_birth, 'YYYY-MM-DD') AS dob, to_char(career_start_date, 'YYYY-MM-DD') AS start, home_locality, display_name
    FROM career_profiles WHERE career_save_id = ${saveId}`)).rows[0] as ProfileRow | undefined) ?? null;
}

function present(root: { current_season: number; current_week: number; career_name?: string | null; settings_snapshot?: Record<string, unknown> }, p: ProfileRow | null) {
  if (!p?.dob) {
    return { status: "PROFILE_INCOMPLETE" as const, dateOfBirth: null, careerStartDate: p?.start ?? null, homeLocality: p?.home_locality ?? (root.settings_snapshot?.homeLocality as string | undefined) ?? null,
      displayName: p?.display_name ?? root.career_name ?? null, minimumStartAge: AGE_POLICY.minimumCareerStartAge };
  }
  const today = careerWeekDate(p.start, Number(root.current_season), Number(root.current_week));
  const identity = { dateOfBirth: p.dob, careerStartDate: p.start };
  const qSchoolMin = AGE_POLICY.circuitMinimumAge.Q_SCHOOL;
  const age = ageOn(p.dob, today);
  return {
    status: "COMPLETE" as const, dateOfBirth: p.dob, careerStartDate: p.start, homeLocality: p.home_locality, displayName: p.display_name ?? root.career_name ?? null,
    careerDate: today, age, ageAtCareerStart: ageOn(p.dob, p.start), minimumStartAge: AGE_POLICY.minimumCareerStartAge,
    junior: age < AGE_POLICY.juniorMaxAgeExclusive, juniorMaxAgeExclusive: AGE_POLICY.juniorMaxAgeExclusive,
    qSchool: { minimumAge: qSchoolMin, eligibleNow: age >= qSchoolMin,
      eligibleFrom: age >= qSchoolMin ? null : eligibleFrom(identity, qSchoolMin, Number(root.current_season), Number(root.current_week)) },
  };
}

export function createCareerIdentityService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as never as { id: string; current_season: number; current_week: number; career_name: string | null; settings_snapshot: Record<string, unknown> };
        return present(root, await profileOf(tx, root.id));
      });
    },
    /** Legacy saves only: set the DOB once. Validated against a deterministic start date. */
    async set(actor: CareerActor, saveId: string, body: unknown) {
      const input = setProfileSchema.parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as never as { id: string; current_season: number; current_week: number; career_name: string | null; created_at: Date | string; settings_snapshot: Record<string, unknown> };
        const existing = await profileOf(tx, root.id);
        if (existing?.dob) throw new CareerError(409, "Career date of birth is already set and cannot be changed");
        const start = existing?.start ?? careerStartDateFor(new Date(root.created_at));
        try { validateDateOfBirth(input.dateOfBirth, start); } catch (error) { throw new CareerError(409, (error as Error).message); }
        const home = input.homeLocality ?? existing?.home_locality ?? (root.settings_snapshot?.homeLocality as string | undefined) ?? null;
        if (home && !LOCALITIES.some(l => l.key === home)) throw new CareerError(409, "Unknown home locality");
        if (existing) await tx.execute(sql`UPDATE career_profiles SET date_of_birth = ${input.dateOfBirth}::date, home_locality = ${home}, updated_at = NOW() WHERE career_save_id = ${root.id}`);
        else await tx.execute(sql`INSERT INTO career_profiles (career_save_id, profile_version, display_name, date_of_birth, career_start_date, home_locality)
          VALUES (${root.id}, ${PROFILE_VERSION}, ${root.career_name}, ${input.dateOfBirth}::date, ${start}::date, ${home})`);
        return present(root, await profileOf(tx, root.id));
      });
    },
    /** True when the save may make sporting progress (has a DOB). Retired saves are read-only anyway. */
    async complete(actor: CareerActor, saveId: string) {
      const row = (await database.execute(sql`SELECT p.date_of_birth FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id = s.id
        WHERE s.id = ${saveId} AND s.player_id = ${actor.playerId}`)).rows[0];
      return !row || row.date_of_birth !== null; // unknown save: let the real handler answer 404
    },
  };
}
export type CareerIdentityService = ReturnType<typeof createCareerIdentityService>;

type PlayerSession = { playerId?: number; isAdmin?: boolean };

/** Profile endpoints + the PROFILE_INCOMPLETE gate on sporting-progress routes. Mount first. */
export function createCareerIdentityRouter(service: CareerIdentityService, isAvailable: (isAdmin: boolean) => Promise<boolean>) {
  const router = Router();
  const auth = async (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!await isAvailable(session?.isAdmin === true)) { res.status(404).json({ error: "Career not available" }); return; }
    res.locals.careerActor = { playerId: session!.playerId!, isAdmin: session?.isAdmin === true };
    next();
  };
  // Gate: entering events, advancing the calendar and starting live matches need a Career DOB.
  const gate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!(await service.complete(res.locals.careerActor, String(req.params.id)))) {
        res.status(409).json({ error: "PROFILE_INCOMPLETE: set your Career date of birth before continuing", code: "PROFILE_INCOMPLETE" });
        return;
      }
      next();
    } catch (error) { next(error); }
  };
  router.post("/saves/:id/events/:eventId/entry", auth, gate);
  router.post("/saves/:id/calendar/advance", auth, gate);
  router.post("/saves/:id/matches/:matchId/session", auth, gate);
  router.get("/saves/:id/profile", auth, async (req, res, next) => { try { res.json(await service.read(res.locals.careerActor, String(req.params.id))); } catch (e) { next(e); } });
  router.put("/saves/:id/profile", auth, authedWriteRateLimit, async (req, res, next) => { try { res.json(await service.set(res.locals.careerActor, String(req.params.id), req.body)); } catch (e) { next(e); } });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else { req.log.error({ err: error }, "Career identity request failed"); res.status(500).json({ error: "Career request failed" }); }
  });
  return router;
}
