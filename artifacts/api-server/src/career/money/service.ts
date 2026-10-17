import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { humanSimulationPlayer } from "../calendar/service.ts";
import { simulateBullUp } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import { attributeForAverage, loadHumanForm } from "../form/human.ts";
import { post } from "../finance/ledger.ts";
import { reservedPence } from "../finance/engine.ts";
import type { RootRow } from "../calendar/engine.ts";
import { MONEY, appetiteFor, averageForLevel, lineFor, oddsFor, replyTo, weeklyChallenge, willingFor, type Odds } from "./model.ts";

type Row = Record<string, unknown>;
type Member = { key: string; name: string; professional: boolean; average: number | null };
type Root = RootRow & { player_id?: number };

export type MoneyMatchResult = { id: string; season: number; week: number; opponentKey: string; opponentName: string; stakePence: number;
  origin: "YOU_CHALLENGED" | "THEY_CHALLENGED"; status: "PLAYED" | "DECLINED"; won: boolean | null; legs: [number, number] | null;
  averages: [number, number] | null; highestCheckout: number | null; maximums: number | null };
export type MoneyMatchesView = {
  season: number; week: number; club: string | null; availablePence: number; perWeek: number; playedThisWeek: number; bestOf: number;
  yourAverage: number;
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

/** The members of your home club you can play (active players from your home area), with their typical average. */
async function clubMembers(tx: CareerExecutor, root: Root): Promise<{ locality: typeof LOCALITIES[number] | null; members: Member[] }> {
  const home = String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0]?.home_locality
    ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
  const locality = LOCALITIES.find(l => l.key === home);
  if (!locality) return { locality: null, members: [] as Member[] };
  const players = (await tx.execute(sql`SELECT id,first_name,surname,home_region,professional_status FROM career_world_players
    WHERE career_save_id=${root.id} AND nationality=${locality.country} AND status='ACTIVE'`)).rows
    .filter(p => localityByRegion(String(p.home_region))?.key === locality.key);
  // Their form is public: the average over their last ten recorded matches (abilities stay hidden, as everywhere else).
  const keys = players.map(p => String(p.id));
  const averages = new Map(keys.length ? (await tx.execute(sql`WITH m AS (
      SELECT a_npc_id::text AS k, (summary->'averages'->>0)::float AS avg, completed_at FROM career_tournament_matches
        WHERE career_save_id=${root.id} AND a_npc_id IN (${sql.join(keys.map(k => sql`${k}::uuid`), sql`,`)}) AND status='COMPLETED' AND summary ? 'averages'
      UNION ALL
      SELECT b_npc_id::text, (summary->'averages'->>1)::float, completed_at FROM career_tournament_matches
        WHERE career_save_id=${root.id} AND b_npc_id IN (${sql.join(keys.map(k => sql`${k}::uuid`), sql`,`)}) AND status='COMPLETED' AND summary ? 'averages')
    SELECT k, AVG(avg)::float AS avg FROM (SELECT k, avg, row_number() OVER (PARTITION BY k ORDER BY completed_at DESC) AS rn FROM m WHERE avg > 0) x
    WHERE rn <= ${MONEY.formMatches} GROUP BY k`)).rows.map(r => [String(r.k), Math.round(Number(r.avg) * 10) / 10] as const) : []);
  return { locality, members: players.map(p => ({ key: String(p.id), name: nameOf(p), professional: p.professional_status === "PROFESSIONAL", average: averages.get(String(p.id)) ?? null }))
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || a.name.localeCompare(b.name)) };
}

async function availableOf(tx: CareerExecutor, saveId: string) {
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
    const played = all.filter(r => r.status === "PLAYED");
    const yourAverage = Math.round(form.skillAverage * 10) / 10;
    // The odds use the level you actually play money matches at (your difficulty's handicap included).
    const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
    const yourPlaying = averageForLevel(attributeForAverage(form.skillAverage) - offset);
    // What each member will put up this week: their appetite, cut to how they rate their chances against you.
    const priced = members.map(m => { const odds = oddsFor(yourPlaying, m.average); return { ...m, odds, willing: willingFor(appetiteFor(root.world_seed, season, m), odds) }; });
    const talks = new Map((await tx.execute(sql`SELECT * FROM career_money_talks WHERE career_save_id=${root.id} AND season=${season} AND week=${week}`)).rows
      .map(r => [String(r.opponent_key), talkFrom(r)]));
    const offer = weeklyChallenge(root.world_seed, season, week, priced, available);
    const challenger = offer && !thisWeek.some(r => r.opponentKey === offer.opponentKey) && !talks.has(offer.opponentKey) && thisWeek.filter(r => r.status === "PLAYED").length < MONEY.perWeek
      ? members.find(m => m.key === offer.opponentKey) : undefined;
    return {
      season, week, club: locality ? `${locality.city} Darts Club` : null, availablePence: available, perWeek: MONEY.perWeek, bestOf: MONEY.bestOf,
      playedThisWeek: thisWeek.filter(r => r.status === "PLAYED").length, yourAverage,
      members: priced.map(({ willing: _hidden, ...m }) => ({ ...m, thisWeek: thisWeek.find(r => r.opponentKey === m.key) ?? null, talk: talks.get(m.key) ?? null })),
      challenge: challenger && offer ? { opponentKey: challenger.key, name: challenger.name, stakePence: offer.stakePence, odds: oddsFor(yourPlaying, challenger.average), average: challenger.average } : null,
      record: { played: played.length, won: played.filter(r => r.won).length, netPence: played.reduce((n, r) => n + (r.won ? r.stakePence : -r.stakePence), 0) },
      recent: all.filter(r => r.status === "PLAYED").slice(0, 10),
    };
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
          if (done.status !== "PLAYED" || Number(done.stake_pence) !== input.stakePence) throw new CareerError(409, "You have already settled things with this player this week");
          return { match: (await view(tx, root)).recent.find(r => r.id === String(done.id))!, created: false };
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
        const form = await loadHumanForm(tx, root);
        const you = humanSimulationPlayer(root, opponent, form);
        const key = `money-match:${season}:${week}:${member.key}`;
        const bull = simulateBullUp(you, opponent, root.world_seed, key);
        const result = simulateNpcMatch({ players: [you, opponent], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
          difficulty: root.difficulty as never, context: { category: "local", roundImportance: 0.5, elimination: true },
          format: { bestOf: MONEY.bestOf, firstThrow: bull.firstThrow } });
        const [mine, other] = result.stats;
        const won = mine.legsWon > other.legsWon;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const detail = { version: MONEY.version, averages: [round2(mine.average), round2(other.average)], highestCheckout: mine.highestCheckout, maximums: mine.maximums,
          youThrewFirst: bull.firstThrow === 0, form: { skillAverage: form.skillAverage, form: form.form, confidence: form.confidence }, simulationVersion: result.simulationVersion };
        const row = (await tx.execute(sql`INSERT INTO career_money_matches (career_save_id,season,week,opponent_key,stake_pence,origin,status,won,legs_you,legs_them,detail)
          VALUES (${root.id},${season},${week},${member.key},${input.stakePence},${theirs ? "THEY_CHALLENGED" : "YOU_CHALLENGED"},'PLAYED',${won},${mine.legsWon},${other.legsWon},${JSON.stringify(detail)}::jsonb)
          RETURNING *`)).rows[0];
        if (talk) await tx.execute(sql`UPDATE career_money_talks SET status='AGREED', agreed_pence=${input.stakePence}, updated_at=NOW()
          WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND opponent_key=${member.key}`);
        await post(tx, root, { operationKey: `money-match:${row.id}`, category: won ? "MONEY_MATCH_WIN" : "MONEY_MATCH_STAKE", amountPence: won ? input.stakePence : -input.stakePence,
          reason: `Money match ${won ? "won" : "lost"} against ${member.name} (${mine.legsWon}-${other.legsWon})`, season, week,
          detail: { moneyMatchId: String(row.id), opponentKey: member.key } });
        return { match: resultFrom(row, new Map([[member.key, member.name]])), created: true };
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
