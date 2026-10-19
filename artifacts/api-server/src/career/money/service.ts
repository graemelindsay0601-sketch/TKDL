import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { loadNpcs } from "../world/repository.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { CAREER_DIFFICULTY_CONFIG, SIMULATION_VERSION } from "../world/config.ts";
import type { Npc } from "../world/types.ts";
import { attributeForAverage, loadHumanForm } from "../form/human.ts";
import { post } from "../finance/ledger.ts";
import { reservedPence } from "../finance/engine.ts";
import type { RootRow } from "../calendar/engine.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { MONEY, appetiteFor, averageForLevel, lineFor, oddsFor, replyTo, weeklyChallenge, willingFor, type Odds } from "./model.ts";

type Row = Record<string, unknown>;
export type Member = { key: string; name: string; professional: boolean; average: number | null };
type Root = RootRow & { player_id?: number };

export type MoneyMatchResult = { id: string; season: number; week: number; opponentKey: string; opponentName: string; stakePence: number;
  origin: "YOU_CHALLENGED" | "THEY_CHALLENGED"; status: "PLAYED" | "DECLINED"; won: boolean | null; legs: [number, number] | null;
  averages: [number, number] | null; highestCheckout: number | null; maximums: number | null };
type MoneyBotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
export type MoneyMatchSession = { id: string; status: "LIVE" | "PLAYED"; stakePence: number; origin: "YOU_CHALLENGED" | "THEY_CHALLENGED"; you: string;
  opponent: { name: string; bot: { config: MoneyBotConfig; seed: string } };
  format: X01Format; firstThrower: 0; darts: unknown[]; won: boolean | null };
const MONEY_FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: MONEY.bestOf };
const MONEY_CONTEXT = { category: "local" as const, roundImportance: 0.5, elimination: true };
export type MoneyMatchesView = {
  season: number; week: number; club: string | null; availablePence: number; perWeek: number; playedThisWeek: number; bestOf: number;
  liveMatches: { id: string; season: number; week: number; opponentKey: string; opponentName: string; stakePence: number }[];
  /** Your Career average (null until enough live darts are thrown). */
  yourAverage: number | null;
  members: { key: string; name: string; professional: boolean; average: number | null; odds: Odds; thisWeek: MoneyMatchResult | null; talk: MoneyTalk | null }[];
  challenge: { opponentKey: string; name: string; stakePence: number; odds: Odds; average: number | null } | null;
  record: { played: number; won: number; netPence: number };
  recent: MoneyMatchResult[];
};

/** This week's haggling with one member: what was said, their figure on the table, and the agreed stake once you shake on it. */
export type MoneyTalk = { status: "OPEN" | "AGREED" | "WALKED"; asksLeft: number; theirOfferPence: number | null; agreedPence: number | null;
  log: { who: "YOU" | "THEM"; text: string; pence: number | null }[] };
const talkFrom = (r: Row): MoneyTalk => ({ status: r.status as MoneyTalk["status"], asksLeft: Math.max(0, MONEY.asks - Number(r.asks)),
  theirOfferPence: r.their_offer_pence === null ? null : Number(r.their_offer_pence), agreedPence: r.agreed_pence === null ? null : Number(r.agreed_pence),
  log: r.log as MoneyTalk["log"] });
const fmt = (p: number) => `£${(p / 100).toLocaleString("en-GB")}`;

const nameOf = (p: Row | undefined) => p ? `${p.first_name} ${p.surname}` : "A club member";
const resultFrom = (r: Row, names: Map<string, string>): MoneyMatchResult => {
  const d = r.detail as { averages?: [number, number]; highestCheckout?: number; maximums?: number };
  return { id: String(r.id), season: Number(r.season), week: Number(r.week), opponentKey: String(r.opponent_key), opponentName: names.get(String(r.opponent_key)) ?? "A club member",
    stakePence: Number(r.stake_pence), origin: r.origin as MoneyMatchResult["origin"], status: r.status as MoneyMatchResult["status"],
    won: r.won === null ? null : r.won === true, legs: r.legs_you === null ? null : [Number(r.legs_you), Number(r.legs_them)],
    averages: d.averages ?? null, highestCheckout: d.highestCheckout ?? null, maximums: d.maximums ?? null };
};

/** Your home area's key (from your profile, else the save's settings). */
export async function homeLocalityOf(tx: CareerExecutor, root: Pick<Root, "id" | "settings_snapshot">) {
  return String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0]?.home_locality
    ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
}

/** The members of your home club you can play (active players from your home area), with their typical average. */
async function clubMembers(tx: CareerExecutor, root: Root): Promise<{ locality: typeof LOCALITIES[number] | null; members: Member[] }> {
  const home = await homeLocalityOf(tx, root), locality = LOCALITIES.find(l => l.key === home);
  if (!locality) return { locality: null, members: [] as Member[] };
  return { locality, members: await playersOf(tx, root, locality) };
}

/** A town's active players (from that area), strongest first by their recent recorded average. */
export async function playersOf(tx: CareerExecutor, root: Pick<Root, "id">, locality: typeof LOCALITIES[number]): Promise<Member[]> {
  return (await playersOfMany(tx, root, [locality])).get(locality.key) ?? [];
}

/** playersOf for several towns at once (two queries in all, however many towns): locality key to its players, best form first. */
export async function playersOfMany(tx: CareerExecutor, root: Pick<Root, "id">, localities: readonly typeof LOCALITIES[number][]): Promise<Map<string, Member[]>> {
  const out = new Map<string, Member[]>(localities.map(l => [l.key, []]));
  const countries = [...new Set(localities.map(l => l.country))];
  if (!countries.length) return out;
  const players = (await tx.execute(sql`SELECT id,first_name,surname,home_region,professional_status FROM career_world_players
    WHERE career_save_id=${root.id} AND nationality IN (${sql.join(countries.map(c => sql`${c}`), sql`,`)}) AND status='ACTIVE'`)).rows
    .map(p => ({ p, town: localityByRegion(String(p.home_region))?.key })).filter(x => x.town && out.has(x.town));
  // Their form is public: the average over their last ten recorded matches (abilities stay hidden, as everywhere else).
  const keys = players.map(x => String(x.p.id));
  const latest = (side: "a" | "b", k: ReturnType<typeof sql>) => sql`SELECT (summary->'averages'->>${sql.raw(side === "a" ? "0" : "1")})::float AS avg, completed_at
    FROM career_tournament_matches WHERE career_save_id=${root.id} AND ${sql.raw(`${side}_npc_id`)}=${k} AND status='COMPLETED' AND summary ? 'averages'
      AND (summary->'averages'->>${sql.raw(side === "a" ? "0" : "1")})::float > 0 ORDER BY completed_at DESC LIMIT ${MONEY.formMatches}`;
  const averages = new Map(keys.length ? (await tx.execute(sql`SELECT k.id::text AS k, (SELECT AVG(avg) FROM (SELECT avg FROM ((${latest("a", sql`k.id`)}) UNION ALL (${latest("b", sql`k.id`)})) u
      ORDER BY completed_at DESC LIMIT ${MONEY.formMatches}) v)::float AS avg FROM unnest(ARRAY[${sql.join(keys.map(k => sql`${k}`), sql`,`)}]::uuid[]) AS k(id)`)).rows
    .filter(r => r.avg !== null).map(r => [String(r.k), Math.round(Number(r.avg) * 10) / 10] as const) : []);
  for (const { p, town } of players) out.get(town!)!.push({ key: String(p.id), name: nameOf(p), professional: p.professional_status === "PROFESSIONAL", average: averages.get(String(p.id)) ?? null });
  for (const list of out.values()) list.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || a.name.localeCompare(b.name));
  return out;
}

export async function availableOf(tx: CareerExecutor, saveId: string) {
  const balance = Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id=${saveId}`)).rows[0]?.balance_pence ?? 0);
  return Math.max(0, balance - await reservedPence(tx, saveId));
}

export function createCareerMoneyService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<MoneyMatchesView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const { locality, members } = await clubMembers(tx, root);
    const form = await loadHumanForm(tx, root);
    const available = await availableOf(tx, root.id);
    const rows = (await tx.execute(sql`SELECT * FROM career_money_matches WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    const names = new Map(members.map(m => [m.key, m.name]));
    const missing = [...new Set(rows.map(r => String(r.opponent_key)).filter(k => !names.has(k)))];
    if (missing.length) for (const p of (await tx.execute(sql`SELECT id,first_name,surname FROM career_world_players WHERE career_save_id=${root.id}
      AND id IN (${sql.join(missing.map(k => sql`${k}::uuid`), sql`,`)})`)).rows) names.set(String(p.id), nameOf(p));
    const all = rows.map(r => resultFrom(r, names));
    const thisWeek = all.filter(r => r.season === season && r.week === week);
    const liveMatches = (await tx.execute(sql`SELECT id,season,week,opponent_key,opponent_name,stake_pence FROM career_money_match_sessions
      WHERE career_save_id=${root.id} AND status='LIVE' ORDER BY season DESC,week DESC,created_at`)).rows
      .map(r => ({ id: String(r.id), season: Number(r.season), week: Number(r.week), opponentKey: String(r.opponent_key), opponentName: String(r.opponent_name), stakePence: Number(r.stake_pence) }));
    const played = all.filter(r => r.status === "PLAYED");
    const yourAverage = form.average;
    // The odds use the level you actually play money matches at (your difficulty's handicap included).
    const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
    const yourPlaying = averageForLevel(attributeForAverage(form.skillAverage) - offset);
    // What each member will put up this week: their appetite, cut to how they rate their chances against you.
    const priced = members.map(m => { const odds = oddsFor(yourPlaying, m.average); return { ...m, odds, willing: willingFor(appetiteFor(root.world_seed, season, m), odds) }; });
    const talks = new Map((await tx.execute(sql`SELECT * FROM career_money_talks WHERE career_save_id=${root.id} AND season=${season} AND week=${week}`)).rows
      .map(r => [String(r.opponent_key), talkFrom(r)]));
    // A newcomer is left to settle in: no challenges until their first event or the end of their first month.
    const settled = season > 1 || week > MONEY.settleInWeeks
      || (await tx.execute(sql`SELECT 1 FROM career_event_results WHERE career_save_id=${root.id} AND participant_key='HUMAN' LIMIT 1`)).rows.length > 0;
    const offer = settled ? weeklyChallenge(root.world_seed, season, week, priced, available) : null;
    const challenger = offer && !thisWeek.some(r => r.opponentKey === offer.opponentKey) && !talks.has(offer.opponentKey) && thisWeek.filter(r => r.status === "PLAYED").length < MONEY.perWeek
      ? members.find(m => m.key === offer.opponentKey) : undefined;
    return {
      season, week, club: locality ? `${locality.city} Darts Club` : null, availablePence: available, perWeek: MONEY.perWeek, bestOf: MONEY.bestOf,
      playedThisWeek: thisWeek.filter(r => r.status === "PLAYED").length + liveMatches.filter(m => m.season === season && m.week === week).length, liveMatches, yourAverage,
      members: priced.map(({ willing: _hidden, ...m }) => ({ ...m, thisWeek: thisWeek.find(r => r.opponentKey === m.key) ?? null, talk: talks.get(m.key) ?? null })),
      challenge: challenger && offer ? { opponentKey: challenger.key, name: challenger.name, stakePence: offer.stakePence, odds: oddsFor(yourPlaying, challenger.average), average: challenger.average } : null,
      record: { played: played.length, won: played.filter(r => r.won).length, netPence: played.reduce((n, r) => n + (r.won ? r.stakePence : -r.stakePence), 0) },
      recent: all.filter(r => r.status === "PLAYED").slice(0, 10),
    };
  }

  const botConfig = (root: Root, npc: Npc, key: string): MoneyBotConfig => {
    const c = toCareerBotConfig(createPerformance(npc, MONEY_CONTEXT, root.difficulty as never,
      scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, key, npc.id)));
    return { avg: c.avg, sd: c.sd, checkoutPct: c.checkoutPct, hitAcc: c.hitAcc };
  };
  async function sessionFrom(tx: CareerExecutor, root: Root, row: Row): Promise<MoneyMatchSession> {
    const you = (await tx.execute(sql`SELECT COALESCE(p.display_name,s.career_name,'You') AS name FROM career_saves s
      LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0];
    return { id: String(row.id), status: row.status as "LIVE" | "PLAYED", stakePence: Number(row.stake_pence), origin: row.origin as MoneyMatchSession["origin"], you: String(you?.name ?? "You"),
      opponent: { name: String(row.opponent_name), bot: { config: row.bot as MoneyBotConfig, seed: String(row.bot_seed) } },
      format: MONEY_FORMAT, firstThrower: 0, darts: row.darts as unknown[] ?? [], won: row.won === null ? null : row.won === true };
  }
  async function settleLive(tx: CareerExecutor, root: Root, row: Row, darts: unknown[], winner: number) {
    const won = winner === 0, state = replay(MONEY_FORMAT, 0, darts);
    const season = Number(row.season), week = Number(row.week), opponentKey = String(row.opponent_key);
    await tx.execute(sql`UPDATE career_money_match_sessions SET status='PLAYED',won=${won},darts=${JSON.stringify(darts)}::jsonb
      WHERE career_save_id=${root.id} AND id=${String(row.id)} AND status='LIVE'`);
    const saved = (await tx.execute(sql`INSERT INTO career_money_matches
      (career_save_id,season,week,opponent_key,stake_pence,origin,status,won,legs_you,legs_them,detail)
      VALUES (${root.id},${season},${week},${opponentKey},${Number(row.stake_pence)},${String(row.origin)},'PLAYED',${won},
        ${state.totalLegs[0]},${state.totalLegs[1]},${JSON.stringify({version:MONEY.version,source:"LIVE",darts})}::jsonb)
      ON CONFLICT (career_save_id,season,week,opponent_key) DO NOTHING RETURNING id`)).rows[0];
    if (!saved) return;
    const name = String(row.opponent_name);
    await post(tx, root, { operationKey: `money-match:${String(saved.id)}`, category: won ? "MONEY_MATCH_WIN" : "MONEY_MATCH_STAKE",
      amountPence: won ? Number(row.stake_pence) : -Number(row.stake_pence),
      reason: `Money match ${won ? "won" : "lost"} against ${name} (${state.totalLegs[0]}-${state.totalLegs[1]})`,
      season, week, detail: { moneyMatchId: String(saved.id), opponentKey } });
    await tx.execute(sql`UPDATE career_money_talks SET status='AGREED',agreed_pence=${Number(row.stake_pence)},updated_at=NOW()
      WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND opponent_key=${opponentKey}`);
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },

    /**
     * Play a money match this week: against a member you challenge (a stake they will play for) or the member who
     * challenged you (their stake). Once per member a week, at most three a week, never for money you have not got free.
     * Playing again with the same member this week returns the match already played.
     */
    async play(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ opponentKey: z.string().uuid(), stakePence: z.number().int().positive() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const done = (await tx.execute(sql`SELECT * FROM career_money_matches WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND opponent_key=${input.opponentKey}`)).rows[0];
        if (done) {
          if (Number(done.stake_pence) !== input.stakePence) throw new CareerError(409, "You have already settled things with this player this week");
          return { session: null, match: resultFrom(done, new Map([[input.opponentKey, String(done.opponent_name ?? "A club member")]])), created: false };
        }
        const prior = (await tx.execute(sql`SELECT * FROM career_money_match_sessions WHERE career_save_id=${root.id}
          AND season=${season} AND week=${week} AND opponent_key=${input.opponentKey}`)).rows[0];
        if (prior) {
          if (Number(prior.stake_pence) !== input.stakePence) throw new CareerError(409, "You already agreed a different stake with this player");
          return { session: await sessionFrom(tx, root, prior as Row), match: null, created: false };
        }
        const before = await view(tx, root);
        const member = before.members.find(m => m.key === input.opponentKey);
        if (!member) throw new CareerError(404, "That player is not a member of your club");
        if (before.playedThisWeek >= MONEY.perWeek) throw new CareerError(409, `You have played ${MONEY.perWeek} money matches this week`);
        // Only for a stake you have both agreed: their challenge, their figure on the table, or the stake you shook on.
        const theirs = before.challenge?.opponentKey === member.key && before.challenge.stakePence === input.stakePence;
        const talk = member.talk;
        const agreed = talk?.status === "AGREED" && talk.agreedPence === input.stakePence;
        const takingTheirs = talk?.status === "OPEN" && talk.theirOfferPence === input.stakePence;
        if (!theirs && !agreed && !takingTheirs) throw new CareerError(409, talk?.status === "WALKED" ? `${member.name} has walked away for this week` : "You have not agreed that stake with them");
        if (input.stakePence > before.availablePence) throw new CareerError(409, "You do not have that much money free");
        const opponent = (await loadNpcs(tx, root.id, { ids: [member.key] }))[0];
        if (!opponent) throw new CareerError(404, "That opponent is no longer available");
        const key = `money-match:${season}:${week}:${member.key}`;
        const id = stableUuid(root.world_seed, MONEY.version, "money-match-live", root.id, key);
        const config = botConfig(root, opponent, key);
        const row = (await tx.execute(sql`INSERT INTO career_money_match_sessions
          (career_save_id,id,season,week,opponent_key,opponent_name,stake_pence,origin,bot,bot_seed,status,darts)
          VALUES (${root.id},${id},${season},${week},${member.key},${member.name},${input.stakePence},
            ${theirs ? "THEY_CHALLENGED" : "YOU_CHALLENGED"},${JSON.stringify(config)}::jsonb,
            ${stableUuid(root.world_seed,MONEY.version,"money-match-bot",key)},'LIVE','[]'::jsonb)
          ON CONFLICT (career_save_id,season,week,opponent_key) DO NOTHING RETURNING *`)).rows[0]
          ?? (await tx.execute(sql`SELECT * FROM career_money_match_sessions WHERE career_save_id=${root.id}
            AND season=${season} AND week=${week} AND opponent_key=${member.key}`)).rows[0];
        if (!row) throw new CareerError(409, "Could not start this money match");
        return { session: await sessionFrom(tx, root, row as Row), match: null, created: true };
      });
    },

    async session(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const row = (await tx.execute(sql`SELECT * FROM career_money_match_sessions WHERE career_save_id=${root.id} AND id=${matchId}`)).rows[0];
        if (!row) throw new CareerError(404, "Money match not found");
        return sessionFrom(tx, root, row as Row);
      });
    },

    async darts(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(400) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = (await tx.execute(sql`SELECT * FROM career_money_match_sessions WHERE career_save_id=${root.id} AND id=${matchId} FOR UPDATE`)).rows[0] as Row | undefined;
        if (!row) throw new CareerError(404, "Money match not found");
        if (row.status === "LIVE") {
          let state;
          try { state = replay(MONEY_FORMAT, 0, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          if (state.complete && state.winner !== null) await settleLive(tx, root, row, darts, state.winner);
          else await tx.execute(sql`UPDATE career_money_match_sessions SET darts=${JSON.stringify(darts)}::jsonb
            WHERE career_save_id=${root.id} AND id=${matchId} AND status='LIVE'`);
        }
        const updated = (await tx.execute(sql`SELECT * FROM career_money_match_sessions WHERE career_save_id=${root.id} AND id=${matchId}`)).rows[0] as Row;
        return sessionFrom(tx, root, updated);
      });
    },

    /**
     * Put a stake to a member. They take it if it's within what they'll risk this week, come back with their own figure if
     * it's too rich (or, if they fancy it and you offer peanuts, ask for more), and walk away for the week once you've
     * asked three times. Whole pounds, at least £5, never more than you have free.
     */
    async offer(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ opponentKey: z.string().uuid(), stakePence: z.number().int().positive() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const before = await view(tx, root);
        const member = before.members.find(m => m.key === input.opponentKey);
        if (!member) throw new CareerError(404, "That player is not a member of your club");
        if (member.thisWeek) throw new CareerError(409, "You have already settled things with this player this week");
        if (before.playedThisWeek >= MONEY.perWeek) throw new CareerError(409, `You have played ${MONEY.perWeek} money matches this week`);
        if (member.talk && member.talk.status !== "OPEN") throw new CareerError(409, member.talk.status === "WALKED" ? `${member.name} has walked away for this week` : "You have already shaken on a stake");
        if (input.stakePence < MONEY.minimumPence || input.stakePence % MONEY.stepPence) throw new CareerError(400, "Offer a whole number of pounds, at least £5");
        if (input.stakePence > before.availablePence) throw new CareerError(409, "You do not have that much money free");
        const { members } = await clubMembers(tx, root);
        const form = await loadHumanForm(tx, root);
        const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
        const yourPlaying = averageForLevel(attributeForAverage(form.skillAverage) - offset);
        const m = members.find(x => x.key === member.key)!;
        const willing = willingFor(appetiteFor(root.world_seed, season, m), oddsFor(yourPlaying, m.average));
        const ask = (member.talk ? MONEY.asks - member.talk.asksLeft : 0) + 1;
        const reply = replyTo(input.stakePence, Math.min(willing, Math.max(MONEY.minimumPence, before.availablePence)), member.odds, ask,
          (kind, pence) => lineFor(root.world_seed, season, week, member.key, ask, kind, pence, input.stakePence));
        const log = [...(member.talk?.log ?? []), { who: "YOU" as const, text: `${fmt(input.stakePence)}, first to four?`, pence: input.stakePence },
          { who: "THEM" as const, text: reply.line, pence: reply.pence }];
        const status = reply.kind === "ACCEPT" ? "AGREED" : reply.kind === "WALK" ? "WALKED" : "OPEN";
        await tx.execute(sql`INSERT INTO career_money_talks (career_save_id,season,week,opponent_key,status,asks,their_offer_pence,agreed_pence,log)
          VALUES (${root.id},${season},${week},${member.key},${status},${ask},${reply.kind === "COUNTER" || reply.kind === "RAISE" ? reply.pence : null},
            ${reply.kind === "ACCEPT" ? reply.pence : null},${JSON.stringify(log)}::jsonb)
          ON CONFLICT (career_save_id,season,week,opponent_key) DO UPDATE SET status=EXCLUDED.status, asks=EXCLUDED.asks, their_offer_pence=EXCLUDED.their_offer_pence,
            agreed_pence=EXCLUDED.agreed_pence, log=EXCLUDED.log, updated_at=NOW()`);
        return view(tx, root);
      });
    },

    /** Turn down this week's challenge (it stays turned down; nothing is lost). */
    async decline(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const current = await view(tx, root);
        if (!current.challenge) throw new CareerError(409, "Nobody has challenged you this week");
        await tx.execute(sql`INSERT INTO career_money_matches (career_save_id,season,week,opponent_key,stake_pence,origin,status)
          VALUES (${root.id},${current.season},${current.week},${current.challenge.opponentKey},${current.challenge.stakePence},'THEY_CHALLENGED','DECLINED')
          ON CONFLICT DO NOTHING`);
        return view(tx, root);
      });
    },
  };
}
