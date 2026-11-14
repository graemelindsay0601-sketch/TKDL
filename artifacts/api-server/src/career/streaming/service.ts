import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { stableUuid } from "../world/random.ts";
import { replay, validateFormat, type X01Format } from "../../shared/darts-rules/x01.ts";
import { replayDrill, type DrillSpec } from "../../shared/darts-rules/drills.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { InsufficientFundsError, post } from "../finance/ledger.ts";
import { fansForEffects } from "../fans/service.ts";
import { subsThisMonth } from "./state.ts";
import { answerRequest, overlayVisit, recapFor } from "./overlay.ts";
import { CUPS, bracket, cupField, cupOpponent, cupPrize, cupSize, cupThisWeek, legsToWinIn, nextCup, roundName, roundsFor, type CupEntrant, type CupState } from "./cups.ts";
import { activeRegulars, arrivals, attendStream, communityChallenger, communityNightBonus, communityView, modViewerBonus, setRole, type CommunityView } from "./community.ts";
import { freeNightsInWeek } from "../nights.ts";
import { loadNpcs } from "../world/repository.ts";
import { STREAM, STREAM_MONEY, BRANDS, FORMATS, CREATOR_SERIES, creatorSeriesCollabFit, creatorSeriesFor, creatorSeriesEpisodeBonus, KING_ROUNDS, SUB_GOAL, CLIPS, COLLAB, clipFor, collabAnswer, collabBot, collabFollowers, STREAMERS, activeStreamers, CELEBRATION_MILESTONES, EXTRA_FORMATS, perWeekFor, EMOTES, COMMUNITY, emotePrefix, raidIn, STUDIO_UPGRADES, adRevenuePence, studioAudienceMultiplier, studioUpgradeForLevel, streamerFollowers, challengerFor, chatForDrillVisit, chatForMoment, chatForVisit, checkoutTargets, crowdFor, followersFromFans,
  formatByKey, INVITATIONAL, CHARITY, invitationalField, invitationalOpponent, invitationalPrize, nextTier, openingViewers, pollFor, scoringTarget, streamIncome, tierFor, type ChatEvent, type ClipKind, type StreamFormat, type Tally, type TierKey } from "./model.ts";

type Root = { id: string; world_seed: string; current_season: number | string; current_week: number | string; status: string; career_name?: string | null; settings_snapshot?: Record<string, unknown> };
const HUMAN = "HUMAN";
const MATCH: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: STREAM.legsToWin * 2 - 1 };
/** King of the Oche: one leg against each viewer. */
const KING_LEG: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 1 };
/** The x01 format a stream's match is played in: one leg for King of the Oche, a real match's own format, otherwise first to 2. */
const x01For = (format: string, matchFormat?: unknown) => (format === "MATCH" || format === "CUP") && matchFormat ? matchFormat as X01Format : format === "KING" ? KING_LEG : MATCH;
/** A Creator Cup round: first to 3 legs, the final first to 4. */
const cupFormat = (size: number, round: number): X01Format => ({ ...MATCH, bestOfLegs: legsToWinIn(size, round) * 2 - 1 });
const isExtra = (format: unknown) => (EXTRA_FORMATS as readonly string[]).includes(String(format));
/** Formats that play round after round (a new opponent each time): how many rounds. */
const roundsIn = (format: string, cup?: unknown) => format === "KING" ? KING_ROUNDS : format === "INVITATIONAL" ? INVITATIONAL.rounds.length
  : format === "CUP" && cup ? roundsFor((cup as CupState).size) : 1;
const isDrill = (format: string) => format === "CHECKOUTS" || format === "BOBS_27" || format === "SCORING";

type Challenger = { name: string; avg: number; bot: { config: { avg: number; sd: number; checkoutPct: number; hitAcc: number }; seed: string } | null;
  /** A collab: the streamer and their audience when you went live. */
  streamer?: { key: string; followers: number } };
export type StreamCampaign = { id:string; sponsorKey:string; sponsorName:string; requiredFormat:StreamFormat; requiredFormatName:string; brief:string; rewardPence:number; expiresWeek:number; seriesKey:string|null; seriesName:string|null };
export type StreamSession = { id: string; status: "LIVE" | "ENDED"; season: number; week: number; dayOfWeek: number; handle: string; tier: TierKey;
  streamFormat: StreamFormat; formatName: string;
  campaign:Omit<StreamCampaign,"expiresWeek">|null;
  /** The viewer you're playing (null on a drill). */
  challenger: Challenger;
  format: X01Format; drill: DrillSpec | null; firstThrower: 0 | 1;
  /** King of the Oche: the round now (0-based), out of `kingRounds`, and the viewers you've seen off. */
  round: number; kingRounds: number; rounds: { challenger: string; result: "WON" | "LOST" }[];
  tally: Tally; processedVisits: number; result: "WON" | "LOST" | null; incomePence: number | null; followersGained: number | null;
  chat: ChatEvent[]; darts: unknown[]; poll: ReturnType<typeof pollFor> | null;
  /** The overlay's goal bar (followers toward your next tier), when known. */
  goal: { label: string; current: number; target: number } | null };
/** Streaming a real match from the venue: allowed?, and the stream so far. */
export type MatchStream = { eligible: boolean; why: string | null; session: StreamSession | null; events: ChatEvent[] };
/** Events with their own TV coverage: no streaming from the venue. */
const TELEVISED = new Set(["TELEVISED", "MAJOR", "WORLD"]);
export type Deal = { id: string; brand: string; what: string; perStreamPence: number; streamsTotal: number; streamsDone: number; expiresWeek: number };
export type SubGoal = { season: number; month: number; endsWeek: number; target: number; promise: string; progress: number; status: "ON" | "HIT" | "MISSED" };
export type CreatorSeries = { key: "HEADLINER" | "SKILL_LAB" | "CLUBHOUSE"; name: string; tagline: string; description: string };
export type CreatorSeriesState = { selected: CreatorSeries | null; options: CreatorSeries[]; startedWeek: number | null;
  chapters: { quarter: number; title: string; story: string; status: "DONE" | "CURRENT" | "UPCOMING" | "MISSED" | "NOT_STARTED"; format: StreamFormat | null; bonusFollowers: number }[];
  completed: number; availableChapters: number; finale: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "INCOMPLETE" };
export type SceneCreator = { key: string; handle: string; region: string; style: string; blurb: string; catchphrase: string; followers: number; avg: number;
  rookie: boolean; collabs: number; raidsOut: number; raidsIn: number; cupMeetings: number; relationship: "NEW" | "KNOWN" | "FRIEND" | "BESTIE" | "RIVAL" };
export type CupView = { n: number; name: string; opens: number; closes: number; size: number; rounds: number; legsToWin: number; finalLegsToWin: number;
  field: CupEntrant[]; prizes: { round: string; pence: number }[]; open: boolean; why: string | null; callout: { handle: string; text: string } | null };
export type CupRecord = { season: number; n: number; name: string; size: number; wins: number; won: boolean; prizePence: number; champion: string; knockedOutBy: string | null; fans: number };
export type EmoteSlot = { threshold: number; unlocked: boolean; name: string | null; code: string | null };
export type StreamingView = {
  community: CommunityView;
  scene: { creators: SceneCreator[]; rookies: string[]; retired: string[] };
  emotes: { prefix: string; slots: EmoteSlot[] };
  cups: { current: CupView | null; next: { name: string; opens: number } | null; history: CupRecord[]; trophies: number };
  celebration: { milestone: number } | null;
  season: number; week: number; currentWeek: number; handle: string; followers: number; tier: { key: TierKey; name: string; perks: string };
  next: { name: string; followers: number; perks: string } | null; tiers: { key: string; name: string; followers: number; perks: string; reached: boolean }[];
  streamsThisWeek: number; perWeek: number; freeNights: number[]; live: string | null;
  pathway: { focus: "OPEN" | "DARTCAST" | "CREATOR"; weeklyFrequency: number; scheduledNights: number[] };
  totals: { streams: number; earnedPence: number; won: number };
  careerFundsPence: number;
  studio: { level: number; name: string; audienceBonusPercent: number; next: { level: number; name: string; costPence: number; audienceBonusPercent: number; description: string } | null;
    upgrades: { level: number; name: string; costPence: number; audienceBonusPercent: number; description: string; owned: boolean }[] };
  platform: { adsEligible: boolean; viewerMinutesThisMonth: number; streamedWeeksThisMonth: number; estimatedAdPence: number; adRatePencePerThousandMinutes: number; fullRateWeeks: number };
  /** Subscribers who renew every four weeks (half of each £2.50 to you), and the week the next renewals are paid. */
  subscribers: number; renewsWeek: number;
  /** A brand's offer to answer, and the deal you're doing now. */
  dealOffer: Deal | null; deal: Deal | null;
  campaignOffer:StreamCampaign|null; campaign:StreamCampaign|null;
  /** Stars get invitations to the televised invitationals. */
  invitations: boolean;
  /** What you can stream, how big a crowd each would draw tonight (1 = a normal night), chat's pick and the last format played. */
  formats: { key: StreamFormat; name: string; blurb: string; crowd: number; why: string | null }[]; pollPick: StreamFormat | null; lastFormat: StreamFormat | null;
  /** This month's sub goal (Partner up), the targets and promises to choose from. */
  subGoal: SubGoal | null; goalOptions: { targets: readonly number[]; promises: readonly string[] } | null;
  creatorSeries: CreatorSeriesState;
  /** Streamers you could collab with (their audience now, and whether they'd say yes). */
  collabs: { key: string; handle: string; followers: number; avg: number; blurb: string; ok: boolean; why: string | null; seriesFit: boolean }[];
  /** The DartCast Invitational: open to you now?, the field, and how you did this season. */
  invitational: { open: boolean; why: string | null; fromWeek: number; field: { handle: string; followers: number; avg: number }[]; prizePence: readonly number[];
    result: { wins: number; prizePence: number } | null };
  /** Charity streams: done this month, and raised so far in all. */
  charity: { doneThisMonth: boolean; raisedPence: number };
  /** Your clips, the viral ones first. */
  clips: { id: string; season: number; week: number; kind: ClipKind; title: string; status: "NEW" | "VIRAL" | "SETTLED"; views: number; followersGained: number; fansGained: number; clipOfWeek: boolean }[];
  videos: { id: string; season: number; week: number; dayOfWeek: number; format: StreamFormat; title: string; challenger: string; result: "WON" | "LOST" | null; peak: number; followersGained: number; incomePence: number }[];
};

/** Your named emotes as chat types them. */
async function emoteCodes(tx: CareerExecutor, root: Root) {
  const row = (await tx.execute(sql`SELECT handle, emotes FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (!row) return [];
  const prefix = emotePrefix(String(row.handle));
  return ((row.emotes as (string | null)[] | null) ?? []).filter((n): n is string => !!n).map(n => `${prefix}${n}`);
}
/** A booked night: the go-live notification brings a few more people in. */
const NOTIFY_BONUS = 1.1;
const monthOf = (week: number) => Math.ceil(week / STREAM_MONEY.monthWeeks);

/** Your channel (made on first visit, its first followers drawn from your fan base). */
async function channel(tx: CareerExecutor, root: Root) {
  const row = (await tx.execute(sql`SELECT * FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (row) return { handle: String(row.handle), followers: Number(row.followers), subscribers: Number(row.subscribers ?? 0), studioLevel: Number(row.studio_level ?? 0),
    pollPick: (row.poll_pick as StreamFormat | null) ?? null, subGoal: (row.sub_goal as Omit<SubGoal, "progress" | "endsWeek"> | null) ?? null,
    emotes: ((row.emotes as (string | null)[] | null) ?? []), celebrated: Number(row.celebrated ?? 0) };
  const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
  const name = String((await tx.execute(sql`SELECT career_name FROM career_saves WHERE id=${root.id}`)).rows[0]?.career_name ?? "Darts").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "Darts";
  const handle = `${name}Darts`, followers = followersFromFans(fans);
  await tx.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${root.id}, ${handle}, ${followers}) ON CONFLICT DO NOTHING`);
  return { handle, followers, subscribers: 0, studioLevel: 0, pollPick: null, subGoal: null, emotes: [] as (string | null)[], celebrated: 0 };
}

const dealFrom = (r: Record<string, unknown>): Deal => ({ id: String(r.id), brand: String(r.brand_name), what: BRANDS.find(b => b.key === r.brand_key)?.what ?? "a brand",
  perStreamPence: Number(r.per_stream_pence), streamsTotal: Number(r.streams_total), streamsDone: Number(r.streams_done), expiresWeek: Number(r.expires_week) });
const campaignFrom=(r:Record<string,unknown>):StreamCampaign=>({id:String(r.id),sponsorKey:String(r.sponsor_key),sponsorName:String(r.sponsor_name),
  requiredFormat:String(r.required_format) as StreamFormat,requiredFormatName:formatByKey(String(r.required_format)).name,
  brief:String(r.brief),rewardPence:Number(r.reward_pence),expiresWeek:Number(r.expires_week),
  seriesKey:r.series_key?String(r.series_key):null,seriesName:r.series_key?creatorSeriesFor(String(r.series_key))?.name??null:null});

/** Nights this week you're free to stream (no event, commitment or other stream booked). */
async function freeNights(tx: CareerExecutor, root: Root, week = Number(root.current_week)) {
  return freeNightsInWeek(tx, root.id, Number(root.current_season), week);
}

function pathwaySettings(root: Root) {
  const saved = root.settings_snapshot?.careerPathway as { focus?: string; weeklyFrequency?: number } | undefined;
  const focus = saved?.focus === "CREATOR" ? "CREATOR" as const : saved?.focus === "DARTCAST" ? "DARTCAST" as const : "OPEN" as const;
  return { focus, weeklyFrequency: Math.max(0, Math.min(focus === "CREATOR" ? STREAM.creatorPerWeek : STREAM.perWeek, Math.trunc(Number(saved?.weeklyFrequency) || 0))) };
}

/** Reserve this week's chosen DartCast nights as ordinary Career commitments, so every activity and event sees them. */
async function schedulePathwayWeek(tx: CareerExecutor, root: Root, replace = false): Promise<number[]> {
  const season = Number(root.current_season), week = Number(root.current_week), cfg = pathwaySettings(root);
  const from = absoluteDay(week, 1), to = absoluteDay(week, 7);
  await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
    AND family='DARTCAST' AND status='ACCEPTED' AND day < ${from}`);
  const existing = (await tx.execute(sql`SELECT day FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
    AND family='DARTCAST' AND status='ACCEPTED' AND day BETWEEN ${from} AND ${to} ORDER BY day`)).rows.map(r => Number(r.day));
  if (replace) {
    await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
      AND family='DARTCAST' AND status='ACCEPTED' AND day BETWEEN ${from} AND ${to}`);
  } else if (existing.length) return existing.map(day => ((day - 1) % 7) + 1);
  if (root.status !== "ACTIVE" || cfg.focus === "OPEN" || cfg.weeklyFrequency === 0) return [];
  const completedOrLive = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams
    WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND format NOT IN ('MATCH','CUP')`)).rows[0]?.n ?? 0);
  const remaining = Math.max(0, cfg.weeklyFrequency - completedOrLive);
  const free = await freeNightsInWeek(tx, root.id, season, week);
  const ordered = [2, 4, 6, 1, 5, 7, 3].filter(day => free.includes(day)).slice(0, remaining);
  for (const dayOfWeek of ordered) {
    const day = absoluteDay(week, dayOfWeek);
    const id = stableUuid(root.world_seed, STREAM.version, "dartcast-week-plan", root.id, season, week, dayOfWeek);
    await tx.execute(sql`INSERT INTO career_life_commitments (career_save_id,id,family,title,season,day,fee_pence,contract_id,status)
      VALUES (${root.id},${id},'DARTCAST','DartCast stream',${season},${day},0,NULL,'ACCEPTED') ON CONFLICT DO NOTHING`);
  }
  return ordered;
}

async function pathwaySchedule(tx: CareerExecutor, root: Root, week = Number(root.current_week)) {
  const cfg = pathwaySettings(root);
  const days = (await tx.execute(sql`SELECT day FROM career_life_commitments WHERE career_save_id=${root.id}
    AND season=${Number(root.current_season)} AND family='DARTCAST' AND status='ACCEPTED'
    AND day BETWEEN ${absoluteDay(week, 1)} AND ${absoluteDay(week, 7)} ORDER BY day`)).rows
    .map(r => ((Number(r.day) - 1) % 7) + 1);
  return { focus: cfg.focus, weeklyFrequency: cfg.weeklyFrequency, scheduledNights: days };
}

const titleOf = (format: string, challenger: string) => format === "CHALLENGER" ? `Stream vs ${challenger}` : format === "COLLAB" ? `Collab with ${challenger}` : formatByKey(format).name;
/** Keep the stream's best clip-worthy moment. */
const bestClip = (tally: Tally, kind: ClipKind | null): Tally => kind && (!tally.clip || CLIPS[kind].weight > CLIPS[tally.clip].weight) ? { ...tally, clip: kind } : tally;

/** The overlay's goal bar: followers to your next tier (or the next big number once you're a Star). */
function goalFor(followers: number, gainedLive: number) {
  const now = followers + gainedLive, next = nextTier(followers);
  if (next) return { label: `Followers to ${next.name}`, current: now, target: next.followers };
  const target = [50000, 100000, 250000, 500000, 1000000].find(m => m > now) ?? now;
  return { label: "Follower goal", current: now, target };
}
const sessionFrom = (r: Record<string, unknown>, handle: string, tier: TierKey, followers?: number): StreamSession => {
  const format = String(r.format ?? "CHALLENGER") as StreamFormat;
  const live = r.status === "LIVE", t = r.tally as Tally;
  return {
    id: String(r.id), status: r.status as StreamSession["status"], season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1, handle, tier,
    streamFormat: format, formatName: titleOf(format, (r.challenger as Challenger).name),
    challenger: r.challenger as Challenger, format: x01For(format, r.match_format), drill: (r.drill as DrillSpec | null) ?? null, firstThrower: Number(r.first_thrower) as 0 | 1,
    round: Number(r.round ?? 0), kingRounds: roundsIn(format, r.cup), rounds: (r.rounds as StreamSession["rounds"]) ?? [],
    tally: r.tally as Tally, processedVisits: Number(r.processed_visits), result: (r.result as StreamSession["result"]) ?? null,
    incomePence: r.income_pence === null ? null : Number(r.income_pence), followersGained: r.followers_gained === null ? null : Number(r.followers_gained),
    campaign:(r.sponsor_campaign as StreamSession["campaign"])??null,
    chat: ((r.chat as ChatEvent[]) ?? []).slice(-60), darts: (r.darts as unknown[]) ?? [], poll: (r.poll as StreamSession["poll"]) ?? null,
    goal: followers === undefined ? null : goalFor(followers, live ? t.followersGained : 0) };
};

/** A viewer for King of the Oche round `round`: each a little better than the last. */
function kingChallenger(seed: string, key: string, followers: number, round: number): Challenger {
  const c = challengerFor(seed, `${key}:king:${round}`, followers);
  const avg = Math.round((c.avg + round * 2.5) * 10) / 10;
  return { name: c.name, avg, bot: { config: { ...c.config, avg, checkoutPct: Math.min(0.45, c.config.checkoutPct + round * 0.02) },
    seed: stableUuid(seed, STREAM.version, "stream-bot", key, round) } };
}

/** The Invitational's opponent for round `round`: a streamer from the season's top seven, at their own level. */
function invitationalChallenger(seed: string, key: string, season: number, week: number, round: number): Challenger {
  const st = invitationalOpponent(invitationalField(season, week), round);
  return { name: st.handle, avg: st.avg, bot: { config: collabBot(st.avg), seed: stableUuid(seed, STREAM.version, "stream-bot", key, "inv", round) }, streamer: { key: st.key, followers: st.now } };
}

/** A Creator Cup opponent: the creator, their average and their audience. */
function cupChallenger(seed: string, key: string, opp: CupEntrant, round: number): Challenger {
  return { name: opp.handle, avg: opp.avg, bot: { config: collabBot(opp.avg), seed: stableUuid(seed, STREAM.version, "stream-bot", key, "cup", round) }, streamer: { key: opp.key, followers: opp.followers } };
}

/** Where a streamed side match is played, for the opening chat line. */
const SIDE_MATCH_WHERE: Record<string, string> = { MONEY: "from the money match", ROAD: "on the road", TEAM: "from club team night", COUNTY: "from the county match",
  COUNTY_TRIAL: "from the county trial", PROAM: "from Pro-Am night", CAM: "from the webcam league", LOCAL: "from your local competition" };
/** Where each kind of side match lives: its own id column, or an "id" inside the fixtures it keeps (exact match only). */
const SIDE_MATCH_SOURCE: Record<string, { table: string; column?: string }> = {
  MONEY: { table: "career_money_match_sessions", column: "id" }, ROAD: { table: "career_road_matches", column: "id" },
  PROAM: { table: "career_proam_nights", column: "id" }, CAM: { table: "career_cam_fixtures", column: "id" },
  COUNTY_TRIAL: { table: "career_county_trials", column: "match_id" },
  TEAM: { table: "career_club_fixtures" }, COUNTY: { table: "career_county_fixtures" }, LOCAL: { table: "career_local_competitions" },
};
async function ownsSideMatch(tx: CareerExecutor, saveId: string, kind: string, refId: string) {
  const source = SIDE_MATCH_SOURCE[kind];
  if (!source || refId === saveId || !(await tx.execute(sql`SELECT to_regclass(${source.table}) IS NOT NULL AS ok`)).rows[0]?.ok) return false;
  const match = source.column ? sql`t.${sql.raw(source.column)}::text = ${refId}` : sql`t::text LIKE ${`%"id": "${refId}"%`}`;
  return (await tx.execute(sql`SELECT 1 FROM ${sql.raw(source.table)} t WHERE t.career_save_id = ${saveId} AND ${match} LIMIT 1`)).rows.length > 0;
}

export function createCareerStreamingService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root, week = Number(root.current_week)): Promise<StreamingView> {
    const season = Number(root.current_season), currentWeek = Number(root.current_week);
    const ch = await channel(tx, root);
    const tier = tierFor(ch.followers), next = nextTier(ch.followers);
    const rows = (await tx.execute(sql`SELECT id, season, week, day, status, format, challenger, result, tally, income_pence, followers_gained, rounds, processed_visits FROM career_streams
      WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    // A match streamed from an event is the event's night, not one of your stream nights.
    const nights = rows.filter(r => !isExtra(r.format));
    const ended = rows.filter(r => r.status === "ENDED");
    const deals = (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE')`)).rows;
    const offer = deals.find(d => d.status === "OFFERED"), deal = deals.find(d => d.status === "ACTIVE");
    const campaigns=(await tx.execute(sql`SELECT * FROM career_stream_campaigns WHERE career_save_id=${root.id}
      AND status IN ('OFFERED','ACTIVE','IN_PROGRESS') ORDER BY created_at DESC`)).rows;
    const campaignOffer=campaigns.find(row=>row.status==="OFFERED"),activeCampaign=campaigns.find(row=>row.status==="ACTIVE"||row.status==="IN_PROGRESS");
    const lastFormat = (ended[0]?.format as StreamFormat | undefined) ?? null;
    const collabbed = new Set((await tx.execute(sql`SELECT DISTINCT challenger->'streamer'->>'key' AS k FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND format='COLLAB'`)).rows.map(r => String(r.k)));
    const clips = (await tx.execute(sql`SELECT * FROM career_stream_clips WHERE career_save_id=${root.id} ORDER BY (status='VIRAL') DESC, views DESC, season DESC, week DESC LIMIT 8`)).rows;
    const partner = tier.key === "PARTNER" || tier.key === "STAR";
    const monthStart=(monthOf(week)-1)*STREAM_MONEY.monthWeeks+1;
    const monthStreams=ended.filter(r=>Number(r.season)===season&&Number(r.week)>=monthStart&&Number(r.week)<=week&&r.format!=="CHARITY");
    const streamedWeeksThisMonth=new Set(monthStreams.map(r=>Number(r.week))).size;
    const viewerMinutesThisMonth=monthStreams.reduce((sum,r)=>{
      const t=r.tally as Tally;
      return sum+Number(t.viewerMinutes??Math.round(((Number(t.viewers)+Number(t.peak))/2)*Number(r.processed_visits)*STREAM_MONEY.adMinutesPerVisit));
    },0);
    const streamEarnings=Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence),0)::bigint AS n FROM career_finance_entries
      WHERE career_save_id=${root.id} AND category='STREAM_INCOME'`)).rows[0]?.n??0);
    const careerBalancePence=Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id=${root.id}`)).rows[0]?.balance_pence??0);
    const careerFundsPence=careerBalancePence-Number((await tx.execute(sql`SELECT COALESCE(SUM(estimated_trip_pence),0)::bigint AS reserved
      FROM career_event_finance WHERE career_save_id=${root.id} AND status='ENTERED'`)).rows[0]?.reserved??0);
    const currentStudio=studioUpgradeForLevel(ch.studioLevel),nextStudio=STUDIO_UPGRADES.find(item=>item.level===ch.studioLevel+1)??null;
    const g = ch.subGoal, goalMonth = g && g.season === season ? g.month : null;
    const subGoal: SubGoal | null = g && goalMonth !== null && goalMonth >= monthOf(week) - 1
      ? { ...g, endsWeek: g.month * STREAM_MONEY.monthWeeks, progress: await subsThisMonth(tx, root.id, g.season, g.month) } : null;
    const arc = (await tx.execute(sql`SELECT series_key, started_week FROM career_stream_creator_series
      WHERE career_save_id=${root.id} AND season=${season}`)).rows[0];
    const arcDefinition = arc ? creatorSeriesFor(String(arc.series_key)) : null;
    const episodes = arc ? (await tx.execute(sql`SELECT episode, week, format, follower_bonus FROM career_stream_creator_episodes
      WHERE career_save_id=${root.id} AND season=${season} ORDER BY episode`)).rows : [];
    const currentQuarter = Math.min(4, Math.ceil(week / 13));
    const startQuarter = arc ? Math.min(4, Math.ceil(Number(arc.started_week) / 13)) : 1;
    const quarterTitles = ["Pilot: find your voice", "Build a regular show", "Bring the audience in", "Season finale"];
    const creatorSeries: CreatorSeriesState = { selected: arcDefinition ? {
      key: arcDefinition.key, name: arcDefinition.name, tagline: arcDefinition.tagline, description: arcDefinition.description,
    } : null,
      options: CREATOR_SERIES.map(({ key, name, tagline, description }) => ({ key, name, tagline, description })),
      startedWeek: arc ? Number(arc.started_week) : null,
      chapters: quarterTitles.map((title, index) => {
        const quarter = index + 1, episode = episodes.find(row => Number(row.episode) === quarter);
        const status = !arc ? "NOT_STARTED" : quarter < startQuarter ? "NOT_STARTED" : episode ? "DONE"
          : quarter < currentQuarter ? "MISSED" : quarter === currentQuarter ? "CURRENT" : "UPCOMING";
        return { quarter, title, story: arcDefinition?.chapters[quarter - 1] ?? "Choose a channel identity to give this season a story.",
          status, format: episode ? String(episode.format) as StreamFormat : null,
          bonusFollowers: episode ? Number(episode.follower_bonus) : 0 };
      }),
      completed: episodes.length, availableChapters: arc ? 5 - startQuarter : 0,
      finale: !arc ? "NOT_STARTED" : episodes.length >= 5 - startQuarter ? "COMPLETE"
        : quarterTitles.slice(0, 4).some((_, index) => {
          const quarter = index + 1;
          return quarter >= startQuarter && quarter < currentQuarter && !episodes.some(row => Number(row.episode) === quarter);
        }) ? "INCOMPLETE" : "IN_PROGRESS" };
    const collabCounts = new Map((await tx.execute(sql`SELECT challenger->'streamer'->>'key' AS k, COUNT(*)::int AS n FROM career_streams
      WHERE career_save_id=${root.id} AND format='COLLAB' AND status='ENDED' GROUP BY 1`)).rows.map(r => [String(r.k), Number(r.n)]));
    const raids = (await tx.execute(sql`SELECT streamer_key, direction, COUNT(*)::int AS n FROM career_stream_raids WHERE career_save_id=${root.id} GROUP BY 1, 2`)).rows;
    const raidCount = (key: string, dir: "OUT" | "IN") => Number(raids.find(r => r.streamer_key === key && r.direction === dir)?.n ?? 0);
    const cupRows = (await tx.execute(sql`SELECT * FROM career_stream_cups WHERE career_save_id=${root.id} ORDER BY season DESC, cup_no DESC`)).rows;
    const met = new Map<string, number>(), beatYou = new Map<string, number>();
    for (const c of cupRows) { for (const k of (c.met as string[]) ?? []) met.set(k, (met.get(k) ?? 0) + 1); if (c.knocked_out_by) beatYou.set(String(c.knocked_out_by), (beatYou.get(String(c.knocked_out_by)) ?? 0) + 1); }
    const sceneNow = activeStreamers(season);
    const scene = {
      creators: sceneNow.map(c => { const n = collabCounts.get(c.key) ?? 0, out = raidCount(c.key, "OUT"), inn = raidCount(c.key, "IN"), cupMeetings = met.get(c.key) ?? 0,
        bond = n * 2 + out + inn + cupMeetings, rival = cupMeetings >= 2 && (beatYou.get(c.key) ?? 0) >= 1 && n * 2 + out + inn < 8;
        return { key: c.key, handle: c.handle, region: c.region, style: c.style, blurb: c.blurb, catchphrase: c.catchphrase,
          followers: streamerFollowers(c.followers, season, week), avg: c.avg, rookie: c.debut === season && season > 1, collabs: n, raidsOut: out, raidsIn: inn, cupMeetings,
          relationship: (rival ? "RIVAL" : bond >= 8 ? "BESTIE" : bond >= 4 ? "FRIEND" : bond >= 1 ? "KNOWN" : "NEW") as SceneCreator["relationship"] }; })
        .sort((a, b) => b.followers - a.followers),
      rookies: sceneNow.filter(c => c.debut === season && season > 1).map(c => c.handle),
      retired: STREAMERS.filter(c => "retire" in c && season >= (c as { retire: number }).retire).map(c => c.handle),
    };
    const community = await communityView(tx, root.id, tier.key, (season - 1) * 52 + week);
    const named = ch.emotes, prefix = emotePrefix(ch.handle);
    const emotes = { prefix, slots: EMOTES.thresholds.map((threshold, i) => ({ threshold, unlocked: ch.subscribers >= threshold || !!named[i],
      name: named[i] ?? null, code: named[i] ? `${prefix}${named[i]}` : null })) };
    // Creator Cups: this week's (if one is open), the next, and your cup history.
    const cupDef = cupThisWeek(week), size = cupSize(tier.key);
    let current: CupView | null = null;
    if (cupDef) {
      const field = cupField(root.world_seed, season, cupDef.n, cupDef.opens, { key: "you", handle: ch.handle, avg: 0, followers: ch.followers }, size);
      const playedCup = cupRows.some(c => Number(c.season) === season && Number(c.cup_no) === cupDef.n) || rows.some(r => r.format === "CUP" && Number(r.season) === season && Number(r.week) >= cupDef.opens && Number(r.week) <= cupDef.closes);
      const why = root.status !== "ACTIVE" ? "Career is retired" : week !== currentWeek ? "Open this week only" : playedCup ? `You've played the ${cupDef.name}` : null;
      const rivalKey = scene.creators.find(c => c.relationship === "RIVAL" && field.some(f => f.key === c.key))?.key;
      const caller = field.find(f => f.key === rivalKey) ?? field.find(f => !f.you);
      const R = roundsFor(size), shares = size === 16 ? CUPS.share16 : CUPS.share8;
      current = { ...cupDef, size, rounds: R, legsToWin: CUPS.legsToWin, finalLegsToWin: CUPS.finalLegsToWin, field, open: why === null, why,
        prizes: shares.map((_, w) => ({ round: w >= R ? "Winner" : `Out in the ${roundName(size, w).toLowerCase()}`, pence: cupPrize(tier.key, size, w) })),
        callout: caller ? { handle: caller.handle, text: rivalKey ? `${caller.catchphrase ?? ""} You beat me once, ${ch.handle}. Not this time.`.trim() : `${caller.catchphrase ?? ""} See you in the final, ${ch.handle}.`.trim() } : null };
    }
    const upcoming = nextCup(cupDef ? cupDef.closes + 1 : week);
    const history: CupRecord[] = cupRows.map(c => ({ season: Number(c.season), n: Number(c.cup_no), name: String(c.name), size: Number(c.size), wins: Number(c.wins), won: c.won === true,
      prizePence: Number(c.prize_pence), champion: String(c.champion), knockedOutBy: c.knocked_out_by ? String(c.knocked_out_by) : null, fans: Number(c.fans) }));
    const cups = { current, next: upcoming ? { name: upcoming.name, opens: upcoming.opens } : null, history, trophies: history.filter(h => h.won).length };
    const milestone = [...CELEBRATION_MILESTONES].reverse().find(m => ch.followers >= m && m > ch.celebrated) ?? null;
    const celebration = milestone !== null && !rows.some(r => r.status === "LIVE" && r.format === "CELEBRATION") ? { milestone } : null;
    return { community, emotes, cups, celebration, scene, season, week, currentWeek, handle: ch.handle, followers: ch.followers, tier: { key: tier.key, name: tier.name, perks: tier.perks },
      next: next ? { name: next.name, followers: next.followers, perks: next.perks } : null,
      tiers: STREAM.tiers.map(t => ({ key: t.key, name: t.name, followers: t.followers, perks: t.perks, reached: ch.followers >= t.followers })),
      streamsThisWeek: nights.filter(r => Number(r.season) === season && Number(r.week) === week).length, perWeek: perWeekFor(root.settings_snapshot),
      freeNights: root.status === "ACTIVE" ? await freeNights(tx, root, week) : [], live: rows.find(r => r.status === "LIVE" && r.format !== "MATCH")?.id as string ?? null,
      pathway: await pathwaySchedule(tx, root, week),
      totals: { streams: ended.length, earnedPence: streamEarnings, won: ended.filter(r => r.result === "WON").length },
       careerFundsPence,
       studio:{level:ch.studioLevel,name:currentStudio?.name??"Basic setup",audienceBonusPercent:Math.round((studioAudienceMultiplier(ch.studioLevel)-1)*100),
         next:nextStudio?{level:nextStudio.level,name:nextStudio.name,costPence:nextStudio.costPence,audienceBonusPercent:Math.round(nextStudio.audienceBonus*100),description:nextStudio.description}:null,
         upgrades:STUDIO_UPGRADES.map(item=>({...item,audienceBonusPercent:Math.round(item.audienceBonus*100),owned:item.level<=ch.studioLevel}))},
      platform:{adsEligible:tier.key!=="NEWCOMER",viewerMinutesThisMonth,streamedWeeksThisMonth,
        estimatedAdPence:adRevenuePence(viewerMinutesThisMonth,streamedWeeksThisMonth,ch.followers),
        adRatePencePerThousandMinutes:STREAM_MONEY.adPencePerThousandViewerMinutes,fullRateWeeks:STREAM_MONEY.adFullRateWeeks},
      videos: ended.slice(0, 24).map(r => {
        const format = String(r.format ?? "CHALLENGER") as StreamFormat, challenger = String((r.challenger as { name: string }).name);
        return { id: String(r.id), season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1, format, title: titleOf(format, challenger), challenger,
          result: (r.result as "WON" | "LOST" | null) ?? null, peak: Number((r.tally as Tally).peak), followersGained: Number(r.followers_gained ?? 0), incomePence: Number(r.income_pence ?? 0) };
      }),
      subscribers: ch.subscribers, renewsWeek: monthOf(week) * STREAM_MONEY.monthWeeks,
      dealOffer: offer ? dealFrom(offer) : null, deal: deal ? dealFrom(deal) : null,
      campaignOffer:campaignOffer?campaignFrom(campaignOffer):null,campaign:activeCampaign?campaignFrom(activeCampaign):null,
      invitations: tier.key === "STAR",
      invitational: (() => {
        const played = rows.find(r => r.format === "INVITATIONAL" && Number(r.season) === season && r.status === "ENDED");
        const wins = played ? ((played.rounds as StreamSession["rounds"]) ?? []).filter(r => r.result === "WON").length : 0;
        const why = played || rows.some(r => r.format === "INVITATIONAL" && Number(r.season) === season) ? "You've played this season's Invitational"
          : !partner ? "For Partners and Stars" : week < INVITATIONAL.fromWeek ? `Opens in week ${INVITATIONAL.fromWeek}` : week > INVITATIONAL.toWeek ? "Closed for this season" : null;
        return { open: why === null, why, fromWeek: INVITATIONAL.fromWeek, field: invitationalField(season, week).map(f => ({ handle: f.handle, followers: f.now, avg: f.avg })),
          prizePence: INVITATIONAL.prizePence, result: played ? { wins, prizePence: invitationalPrize(wins) } : null };
      })(),
      charity: { doneThisMonth: rows.some(r => r.format === "CHARITY" && Number(r.season) === season && monthOf(Number(r.week)) === monthOf(week)),
        raisedPence: ended.reduce((n, r) => n + Number((r.tally as Tally).raisedPence ?? 0), 0) },
       collabs: activeStreamers(season).map(st => { const followers = streamerFollowers(st.followers, season, week), a = collabAnswer(followers, ch.followers, collabbed.has(st.key));
         return { key: st.key, handle: st.handle, followers, avg: st.avg, blurb: st.blurb, ok: a.ok, why: a.ok ? null : a.why,
           seriesFit: creatorSeriesCollabFit(arcDefinition?.key ?? null, st.key) }; }),
      clips: clips.map(c => ({ id: String(c.id), season: Number(c.season), week: Number(c.week), kind: c.kind as ClipKind, title: String(c.title), status: c.status as "NEW" | "VIRAL" | "SETTLED",
        views: Number(c.views), followersGained: Number(c.followers_gained), fansGained: Number(c.fans_gained), clipOfWeek: c.clip_of_week === true })),
      formats: FORMATS.map(f => ({ key: f.key, name: f.name, blurb: f.blurb, crowd: Math.round(crowdFor(f.key, lastFormat, ch.pollPick) * 100) / 100,
        why: f.key === "COMMUNITY" ? (community.size < COMMUNITY.nightMin ? `Needs ${COMMUNITY.nightMin} regulars (you have ${community.size})` : null)
          : f.key !== "CHARITY" ? null : tier.key === "NEWCOMER" ? "From Affiliate (viewers can cheer)"
          : rows.some(r => r.format === "CHARITY" && Number(r.season) === season && monthOf(Number(r.week)) === monthOf(week)) ? "Done this month" : null })),
      pollPick: ch.pollPick, lastFormat,
       subGoal, goalOptions: partner ? { targets: SUB_GOAL.targets, promises: SUB_GOAL.promises } : null, creatorSeries };
  }

  async function recordCreatorEpisode(tx: CareerExecutor, root: Root, row: Record<string, unknown>, processed: number) {
    if (processed <= 0) return 0;
    const season = Number(row.season), week = Number(row.week), quarter = Math.min(4, Math.ceil(week / 13));
    const arc = (await tx.execute(sql`SELECT series_key, started_week FROM career_stream_creator_series
      WHERE career_save_id=${root.id} AND season=${season}`)).rows[0];
    const definition = arc ? creatorSeriesFor(String(arc.series_key)) : null;
    const format = String(row.format ?? "CHALLENGER");
    if (!definition || week < Number(arc.started_week) || !definition.formats.includes(format as never)) return 0;
    const bonus = creatorSeriesEpisodeBonus(quarter);
    const inserted = await tx.execute(sql`INSERT INTO career_stream_creator_episodes (career_save_id,season,episode,stream_id,week,format,follower_bonus)
      VALUES (${root.id},${season},${quarter},${String(row.id)},${week},${format},${bonus})
      ON CONFLICT DO NOTHING RETURNING follower_bonus`);
    return Number(inserted.rows[0]?.follower_bonus ?? 0);
  }

  /** Finish a stream: followers banked (a bonus for wins), the night's money paid, and chat votes on what you play next. */
  /** A Creator Cup over: the bracket settled, your record (with fans and a follower bonus for a deep run), and who you met. */
  async function recordCup(tx: CareerExecutor, root: Root, row: Record<string, unknown>, cup: CupState, tier: TierKey, wins: number, prize: number) {
    const rounds = ((row.rounds as StreamSession["rounds"]) ?? []);
    const results = rounds.map(r => r.result === "WON");
    const b = bracket(root.world_seed, cup, results);
    const won = wins >= roundsFor(cup.size), final = wins >= roundsFor(cup.size) - 1;
    const metKeys = b.rounds.flatMap(r => r.matches.filter(m => m.you && m.a && m.b).map(m => (m.a!.you ? m.b! : m.a!).key)).filter(k => k !== "you");
    const lost = rounds.find(r => r.result === "LOST");
    const knockedOutBy = lost ? cup.field.find(f => f.handle === lost.challenger)?.key ?? null : null;
    const followers = Number((await tx.execute(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0]?.followers ?? 0);
    const bonus = won ? Math.max(10, Math.round(followers * CUPS.winnerFollowers)) : final ? Math.max(4, Math.round(followers * CUPS.winnerFollowers / 3)) : wins * 2;
    const fans = won ? CUPS.winnerFans[cup.size] ?? 0 : final ? CUPS.finalistFans[cup.size] ?? 0 : 0;
    const inserted = (await tx.execute(sql`INSERT INTO career_stream_cups (career_save_id, season, cup_no, name, size, wins, won, prize_pence, followers, fans, champion, knocked_out_by, met, stream_id)
      VALUES (${root.id}, ${cup.season}, ${cup.n}, ${cup.name}, ${cup.size}, ${wins}, ${won}, ${prize}, ${bonus}, ${fans}, ${won ? "You" : b.champion?.handle ?? "?"}, ${knockedOutBy},
        ${JSON.stringify(metKeys)}::jsonb, ${String(row.id)}) ON CONFLICT DO NOTHING RETURNING 1`)).rows.length > 0;
    if (inserted && bonus) await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${bonus}::int WHERE career_save_id=${root.id}`);
    void tier;
  }

  async function finish(tx: CareerExecutor, root: Root, row: Record<string, unknown>, result: "WON" | "LOST" | null, tally: Tally, chat: ChatEvent[], processed: number, wins = result === "WON" ? 1 : 0) {
    // Each win on stream (a challenger beaten, a drill passed): a couple of follows even in a small room, more in a big one.
    const streamer = row.format === "COLLAB" ? (row.challenger as Challenger).streamer : undefined;
    // A collab: the winner takes a share of the other's audience (a little even in defeat).
    const seriesRow = streamer ? (await tx.execute(sql`SELECT series_key FROM career_stream_creator_series
      WHERE career_save_id=${root.id} AND season=${Number(row.season)}`)).rows[0] : null;
    const seriesFit = !!streamer && creatorSeriesCollabFit(seriesRow ? String(seriesRow.series_key) : null, streamer.key);
    const bonus = wins * (2 + Math.round(tally.peak * 0.05)) +
      (streamer && result ? collabFollowers(streamer.followers, result === "WON", seriesFit) : 0);
    const format = String(row.format ?? "CHALLENGER") as StreamFormat;
    if (tally.ov) tally = { ...tally, ov: { ...tally.ov, request: null, recap: recapFor(tally, chat, "") } };
    const pledges = result === "WON" ? tally.pledgedPence ?? 0 : 0;
    // A charity stream: the night's cheers go to the cause (and win more followers); the Invitational pays prize money by round reached.
    const charity = format === "CHARITY";
    if (charity) tally = { ...tally, raisedPence: streamIncome(tally) };
    const cupTier = tierFor(Number((await tx.execute(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0]?.followers ?? 0)).key;
    const cup = format === "CUP" ? row.cup as CupState : null;
    const prize = format === "INVITATIONAL" && processed > 0 ? invitationalPrize(wins) : cup && processed > 0 ? cupPrize(cupTier, cup.size, wins) : 0;
    const seriesBonus = await recordCreatorEpisode(tx, root, row, processed);
    const gained = Math.round((tally.followersGained + bonus) * (charity ? CHARITY.followerBonus : 1)) + seriesBonus, income = charity ? 0 : streamIncome(tally) + pledges;
    const poll = processed > 0 ? pollFor(root.world_seed, String(row.id), format) : null;
    await tx.execute(sql`UPDATE career_streams SET status='ENDED', result=${result}, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
      processed_visits=${processed}, income_pence=${income + prize}, followers_gained=${gained}, poll=${poll ? JSON.stringify(poll) : null}::jsonb, ended_at=NOW()
      WHERE career_save_id=${root.id} AND id=${String(row.id)} AND status='LIVE'`);
    await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${gained}, subscribers = subscribers + ${tally.subs}
      ${poll ? sql`, poll_pick = ${poll.winner}` : sql``} WHERE career_save_id=${root.id}`);
    const weekStreams = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams
      WHERE career_save_id=${root.id} AND season=${Number(row.season)} AND week=${Number(row.week)}
        AND format NOT IN ('MATCH','CUP') AND status IN ('LIVE','ENDED')`)).rows[0]?.n ?? 0);
    if (weekStreams >= perWeekFor(root.settings_snapshot)) await tx.execute(sql`DELETE FROM career_life_commitments
      WHERE career_save_id=${root.id} AND season=${Number(row.season)} AND family='DARTCAST' AND status='ACCEPTED'
        AND day BETWEEN ${(Number(row.week) - 1) * 7 + 1} AND ${Number(row.week) * 7}`);
    // The room's regulars grow more loyal, and new ones join while there's room (more so on a community night).
    if (processed > 0 && format === "COMMUNITY") await communityNightBonus(tx, root.id);
    if (processed > 0) {
      const followersNow = Number((await tx.execute(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0]?.followers ?? 0);
      await attendStream(tx, root, Number(row.season), Number(row.week), followersNow);
    }
    // The night's best moment is clipped (it may go viral when the week is settled).
    if (tally.clip) await tx.execute(sql`INSERT INTO career_stream_clips (career_save_id, id, stream_id, season, week, kind, title, peak, status)
      VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-clip", String(row.id))}, ${String(row.id)}, ${Number(row.season)}, ${Number(row.week)}, ${tally.clip},
        ${CLIPS[tally.clip].title}, ${tally.peak}, 'NEW') ON CONFLICT DO NOTHING`);
    // A brand deal pays for every stream that got going (at least one visit thrown).
    const deal = processed > 0 ? (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status='ACTIVE'`)).rows[0] : undefined;
    if (deal) {
      const n = Number(deal.streams_done) + 1, total = Number(deal.streams_total);
      await post(tx, root, { operationKey: `stream-deal:${row.id}`, category: "STREAM_INCOME", amountPence: Number(deal.per_stream_pence),
        reason: `${deal.brand_name} brand deal: stream ${n} of ${total}`, season: Number(row.season), week: Number(row.week), detail: { streamId: String(row.id), dealId: String(deal.id) } });
      await tx.execute(sql`UPDATE career_stream_deals SET streams_done=${n}, status=${n >= total ? "COMPLETED" : "ACTIVE"} WHERE career_save_id=${root.id} AND id=${String(deal.id)}`);
    }
    const campaignId=row.sponsor_campaign_id?String(row.sponsor_campaign_id):null;
    if(campaignId){
      const campaign=(await tx.execute(sql`SELECT * FROM career_stream_campaigns WHERE career_save_id=${root.id} AND id=${campaignId} AND status='IN_PROGRESS'`)).rows[0];
      if(campaign){
        const completed=result!==null&&processed>0;
        if(completed)await post(tx,root,{operationKey:`stream-campaign:${row.id}`,category:"STREAM_INCOME",amountPence:Number(campaign.reward_pence),
          reason:`${String(campaign.sponsor_name)} sponsored DartCast stream`,season:Number(row.season),week:Number(row.week),
          detail:{streamId:String(row.id),campaignId,sponsorKey:String(campaign.sponsor_key),requiredFormat:String(campaign.required_format)}});
        await tx.execute(sql`UPDATE career_stream_campaigns SET status=${completed?"COMPLETED":"ACTIVE"},
          stream_id=${completed?String(row.id):null} WHERE career_save_id=${root.id} AND id=${campaignId} AND status='IN_PROGRESS'`);
      }
    }
    if (cup && processed > 0) await recordCup(tx, root, row, cup, cupTier, wins, prize);
    if (format === "CELEBRATION" && processed > 0) {
      const m = Number((row.cup as { milestone?: number } | null)?.milestone ?? 0);
      await tx.execute(sql`UPDATE career_stream_channels SET celebrated=GREATEST(celebrated, ${m}::int) WHERE career_save_id=${root.id}`);
    }
    if (prize > 0 && cup) await post(tx, root, { operationKey: `stream-cup:${row.id}`, category: "STREAM_INCOME", amountPence: prize,
      reason: `DartCast ${cup.name}: ${wins >= roundsFor(cup.size) ? "champion" : `out in the ${roundName(cup.size, wins).toLowerCase()}`}`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), wins, size: cup.size } });
    else if (prize > 0) await post(tx, root, { operationKey: `stream-invitational:${row.id}`, category: "STREAM_INCOME", amountPence: prize,
      reason: `DartCast Invitational: ${wins >= INVITATIONAL.rounds.length ? "champion" : `out in the ${INVITATIONAL.rounds[wins].toLowerCase()}`}`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), wins } });
    if (income > 0) await post(tx, root, { operationKey: `stream-income:${row.id}`, category: "STREAM_INCOME", amountPence: income,
      reason: `DartCast stream: ${tally.subs ? `${tally.subs} new sub${tally.subs === 1 ? "" : "s"}, ` : ""}bits and super chats${pledges ? ", pledges" : ""}`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), format, bitsPence: tally.bitsPence, superchatsPence: tally.superchatsPence, pledgesPence: pledges, subs: tally.subs, peak: tally.peak } });
  }

  async function live(tx: CareerExecutor, root: Root, streamId: string) {
    const row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${streamId}`)).rows[0];
    if (!row) throw new CareerError(404, "Stream not found");
    return row;
  }

  /** A match format's darts (play a viewer, or this King of the Oche round). */
  async function matchDarts(tx: CareerExecutor, root: Root, row: Record<string, unknown>, darts: unknown[], tier: TierKey, followers: number) {
    const format = String(row.format), round = Number(row.round ?? 0), total = roundsIn(format, row.cup), king = total > 1;
    let state;
    try { state = replay(x01For(format, row.match_format), Number(row.first_thrower) as 0 | 1, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
    const processed = Number(row.processed_visits);
    let tally = row.tally as Tally;
    const fresh: ChatEvent[] = [], visits = state.visits, regulars = await activeRegulars(tx, root.id), emotes = await emoteCodes(tx, root);
    // Chat is seeded per round, so each King of the Oche round has its own reactions.
    const key = king ? `${row.id}:${round}` : String(row.id);
    for (let i = processed; i < visits.length; i++) {
      const v = visits[i], last = state.complete && i === visits.length - 1;
      const over = last ? (state.winner === 0 ? (king && round + 1 < total ? null : "WON") : "LOST") : null;
      if (v.thrower === 0) {
        tally = { ...tally, myDarts: (tally.myDarts ?? 0) + v.darts.length, myScoredDarts: (tally.myScoredDarts ?? 0) + v.darts.length, myPoints: (tally.myPoints ?? 0) + v.points };
        const dartsInLeg = v.checkout ? visits.filter(x => x.thrower === 0 && x.legNo === v.legNo && x.setNo === v.setNo).reduce((n, x) => n + x.darts.length, 0) : undefined;
        tally = bestClip(tally, clipFor({ points: v.points, checkout: v.checkout, startScore: v.startScore, dartsInLeg }));
      }
      const out = last && king && state.winner === 0 && round + 1 < total
        ? chatForMoment(root.world_seed, key, i, format === "KING" ? "KING_DOWN" : "THROUGH", tally, tier, false, regulars, emotes)
        : chatForVisit(root.world_seed, key, i, { thrower: v.thrower, points: v.points, bust: v.bust, checkout: v.checkout, startScore: v.startScore, legNo: v.legNo }, tally, tier, over, regulars, emotes);
      tally = out.tally; fresh.push(...out.events);
      const lastDart = v.darts[v.darts.length - 1] as { segment: number; multiplier: number } | undefined;
      const legDarts = v.checkout && v.thrower === 0 ? visits.filter(x => x.thrower === 0 && x.legNo === v.legNo && x.setNo === v.setNo).reduce((n, x) => n + x.darts.length, 0) : undefined;
      const myAvg = tally.myScoredDarts ? (tally.myPoints ?? 0) / tally.myScoredDarts * 3 : null;
      const ovr = overlayVisit(root.world_seed, key, i, { you: v.thrower === 0, points: v.points, bust: v.bust, checkout: v.checkout, startScore: v.startScore,
        lastDart: lastDart ? { segment: lastDart.segment, multiplier: lastDart.multiplier } : undefined, dartsInLeg: legDarts,
        legEnded: v.checkout, legNo: v.legNo, streamOver: last && over !== null }, tally, tier, out.events,
        { drill: false, regulars, myAvg, theirAvg: (row.challenger as Challenger).avg ?? null });
      tally = ovr.tally; fresh.push(...ovr.events);
    }
    const chat = [...(row.chat as ChatEvent[]), ...fresh].slice(-200);
    if (!state.complete) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
        processed_visits=${Math.max(processed, visits.length)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      return fresh;
    }
    const won = state.winner === 0, challenger = row.challenger as Challenger;
    if (!king) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      await finish(tx, root, row, won ? "WON" : "LOST", tally, chat, visits.length);
      return fresh;
    }
    const rounds = [...((row.rounds as StreamSession["rounds"]) ?? []), { challenger: challenger.name, result: won ? "WON" as const : "LOST" as const }];
    const wins = rounds.filter(r => r.result === "WON").length;
    if (!won || round + 1 >= total) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, rounds=${JSON.stringify(rounds)}::jsonb WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      await finish(tx, root, row, won ? "WON" : "LOST", tally, chat, Number(row.processed_visits) + visits.length, wins);
      return fresh;
    }
    // Next up: a fresh match, and they throw first every other round.
    const cup = format === "CUP" ? row.cup as CupState : null;
    const cupNext = cup ? cupOpponent(root.world_seed, cup, round + 1, rounds.map(r => r.result === "WON")) : null;
    const nextUp = format === "KING" ? kingChallenger(root.world_seed, String(row.id), followers, round + 1)
      : cup && cupNext ? cupChallenger(root.world_seed, String(row.id), cupNext, round + 1)
      : invitationalChallenger(root.world_seed, String(row.id), Number(row.season), Number(row.week), round + 1);
    const hello: ChatEvent = format === "KING" ? { kind: "CHAT", user: nextUp.name, text: `My turn. ${wins} down, let's see you beat me` }
      : cup ? { kind: "ALERT", alert: "WELCOME", text: `${roundName(cup.size, round + 1)}: ${nextUp.name} awaits. First to ${legsToWinIn(cup.size, round + 1)}` }
      : { kind: "CHAT", user: "DartCast", text: `${INVITATIONAL.rounds[round + 1]}: ${nextUp.name} awaits` };
    await tx.execute(sql`UPDATE career_streams SET darts='[]'::jsonb, round=${round + 1}, rounds=${JSON.stringify(rounds)}::jsonb, challenger=${JSON.stringify(nextUp)}::jsonb,
      ${cup ? sql`match_format=${JSON.stringify(cupFormat(cup.size, round + 1))}::jsonb,` : sql``}
      first_thrower=${(round + 1) % 2}, processed_visits=0, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify([...chat, hello])}::jsonb
      WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
    return [...fresh, hello];
  }

  /** A drill's darts (checkouts, Bob's 27, the average challenge). */
  async function drillDarts(tx: CareerExecutor, root: Root, row: Record<string, unknown>, darts: unknown[], tier: TierKey) {
    const spec = row.drill as DrillSpec;
    let state;
    try { state = replayDrill(spec, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
    const processed = Number(row.processed_visits);
    let tally = row.tally as Tally;
    const fresh: ChatEvent[] = [], regulars = await activeRegulars(tx, root.id), emotes = await emoteCodes(tx, root);
    for (let i = processed; i < state.visits.length; i++) {
      const v = state.visits[i], over = state.complete && i === state.visits.length - 1 ? state.result : null;
      const scored = spec.kind === "SCORING";
      tally = { ...tally, myDarts: (tally.myDarts ?? 0) + v.darts.length, ...(scored ? { myScoredDarts: (tally.myScoredDarts ?? 0) + v.darts.length, myPoints: (tally.myPoints ?? 0) + v.points } : {}) };
      tally = bestClip(tally, v.note === "CHECKOUT" ? clipFor({ points: v.points, checkout: true, startScore: v.points }) : v.note === "HIT" && v.target === "Bull" ? "BOBS_BULL"
        : v.points === 180 ? "MAX" : null);
      const out = chatForDrillVisit(root.world_seed, String(row.id), i, { note: v.note, points: v.points, startScore: v.note === "CHECKOUT" ? v.points : undefined },
        tally, tier, over, spec.kind === "SCORING", regulars, emotes);
      tally = out.tally; fresh.push(...out.events);
      if (spec.kind === "SCORING") {
        const ovr = overlayVisit(root.world_seed, String(row.id), i, { you: true, points: v.points, bust: false, checkout: false, startScore: 0, legEnded: false, legNo: 1,
          streamOver: over !== null }, tally, tier, out.events, { drill: true, regulars });
        tally = ovr.tally; fresh.push(...ovr.events);
      } else if (tally.ov?.startFollowers !== undefined) {
        // Other drills: the hype train and milestones still run.
        const ovr = overlayVisit(root.world_seed, String(row.id), i, { you: true, points: 0, bust: false, checkout: false, startScore: 0, legEnded: false, legNo: 1,
          streamOver: true }, tally, tier, out.events, { drill: true, regulars });
        tally = ovr.tally; fresh.push(...ovr.events);
      }
    }
    const chat = [...(row.chat as ChatEvent[]), ...fresh].slice(-200);
    await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
      processed_visits=${Math.max(processed, state.visits.length)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
    if (state.complete) await finish(tx, root, row, state.result, tally, chat, state.visits.length);
    return fresh;
  }

  return {
    /** End-of-stream raid: send your audience to another creator (once per stream, after it ends, the same week). */
    async raid(actor: CareerActor, saveId: string, streamId: string, body: unknown) {
      const { streamer } = z.object({ streamer: z.string().min(1).max(40) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        if (row.status !== "ENDED") throw new CareerError(409, "Raid when the stream ends");
        if (Number(row.processed_visits) === 0) throw new CareerError(409, "Nobody stayed to raid with");
        if (Number(row.season) !== Number(root.current_season) || Number(row.week) !== Number(root.current_week)) throw new CareerError(409, "That stream's audience has gone home");
        const tally = row.tally as Tally;
        if (tally.ov?.raidOut) throw new CareerError(409, "You've already raided from this stream");
        const target = activeStreamers(Number(row.season)).find(c => c.key === streamer);
        if (!target) throw new CareerError(404, "That creator isn't streaming");
        const viewers = Math.max(1, Number(tally.viewers));
        const next: Tally = { ...tally, ov: { ...(tally.ov ?? {}), raidOut: { key: target.key, handle: target.handle, viewers } } };
        await tx.execute(sql`UPDATE career_streams SET tally=${JSON.stringify(next)}::jsonb, chat = chat || ${JSON.stringify([{ kind: "ALERT", alert: "RAID", user: target.handle,
          text: `Raiding ${target.handle} with ${viewers} viewer${viewers === 1 ? "" : "s"}!` }])}::jsonb WHERE career_save_id=${root.id} AND id=${streamId}`);
        await tx.execute(sql`INSERT INTO career_stream_raids (career_save_id, stream_id, direction, streamer_key, season, week, viewers)
          VALUES (${root.id}, ${streamId}, 'OUT', ${target.key}, ${Number(row.season)}, ${Number(row.week)}, ${viewers}) ON CONFLICT DO NOTHING`);
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key, ch.followers);
      });
    },
    /** Name (or rename) an unlocked emote slot. */
    async nameEmote(actor: CareerActor, saveId: string, body: unknown) {
      const { slot, name } = z.object({ slot: z.number().int().min(0).max(EMOTES.thresholds.length - 1), name: z.string().regex(EMOTES.nameRe) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
        const ch = await channel(tx, root);
        const named = [...ch.emotes];
        if (ch.subscribers < EMOTES.thresholds[slot] && !named[slot]) throw new CareerError(409, `That emote slot opens at ${EMOTES.thresholds[slot]} subscribers`);
        const clean = name.charAt(0).toUpperCase() + name.slice(1);
        if (named.some((n, i) => i !== slot && n?.toLowerCase() === clean.toLowerCase())) throw new CareerError(409, "You already have an emote with that name");
        while (named.length <= slot) named.push(null);
        named[slot] = clean;
        await tx.execute(sql`UPDATE career_stream_channels SET emotes=${JSON.stringify(named)}::jsonb WHERE career_save_id=${root.id}`);
        return view(tx, root);
      });
    },
    /** Accept or skip the viewer request on offer (between legs). */
    async answerRequest(actor: CareerActor, saveId: string, streamId: string, body: unknown) {
      const { accept } = z.object({ accept: z.boolean() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        if (row.status !== "LIVE") throw new CareerError(409, "This stream has ended");
        const tally = row.tally as Tally;
        if (tally.ov?.request?.status !== "OFFERED") throw new CareerError(409, "That request has gone");
        const next = answerRequest(tally, accept);
        await tx.execute(sql`UPDATE career_streams SET tally=${JSON.stringify(next)}::jsonb WHERE career_save_id=${root.id} AND id=${streamId}`);
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key, ch.followers);
      });
    },
    async setRegularRole(actor: CareerActor, saveId: string, key: string, body: unknown) {
      const { role } = z.object({ role: z.enum(["NONE", "MOD", "VIP"]) }).strict().parse(body);
      if (!/^r\d{1,6}$/.test(key)) throw new CareerError(404, "That regular isn't in your community");
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
        const ch = await channel(tx, root);
        await setRole(tx, root.id, key, role, ch.followers);
        return view(tx, root);
      });
    },
    async chooseCreatorSeries(actor: CareerActor, saveId: string, body: unknown) {
      const { seriesKey } = z.object({ seriesKey: z.enum(["HEADLINER", "SKILL_LAB", "CLUBHOUSE"]) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Retired Careers cannot start a creator series");
        const currentSeason = Number(root.current_season), currentWeek = Number(root.current_week);
        if ((await tx.execute(sql`SELECT id FROM career_streams WHERE career_save_id=${root.id} AND status='LIVE'`)).rows.length)
          throw new CareerError(409, "Finish your live stream before starting a creator series");
        const existing = (await tx.execute(sql`SELECT series_key FROM career_stream_creator_series WHERE career_save_id=${root.id} AND season=${currentSeason}`)).rows[0];
        if (existing) throw new CareerError(409, "Your creator series is already set for this season");
        await tx.execute(sql`INSERT INTO career_stream_creator_series (career_save_id,season,series_key,started_week)
          VALUES (${root.id},${currentSeason},${seriesKey},${currentWeek})`);
        return view(tx, root);
      });
    },
    async setPathway(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ focus: z.enum(["OPEN", "DARTCAST", "CREATOR"]), weeklyFrequency: z.number().int().min(0).max(STREAM.creatorPerWeek) }).strict().parse(body);
      if (input.focus !== "CREATOR" && input.weeklyFrequency > STREAM.perWeek) throw new CareerError(400, `Up to ${STREAM.perWeek} stream nights a week (${STREAM.creatorPerWeek} as a full-time creator)`);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
        const settings = { ...(root.settings_snapshot ?? {}),
          careerPathway: { focus: input.focus, weeklyFrequency: input.focus === "OPEN" ? 0 : input.weeklyFrequency } };
        await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify(settings)}::jsonb WHERE id=${root.id}`);
        const updated = { ...root, settings_snapshot: settings };
        await schedulePathwayWeek(tx, updated, true);
        return view(tx, updated);
      });
    },
    async schedulePathway(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        await schedulePathwayWeek(tx, root);
        return view(tx, root);
      });
    },
    async read(actor: CareerActor, saveId: string, requestedWeek?: number) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const current = Number(root.current_week), week = requestedWeek ?? current;
        if (!Number.isInteger(week) || week < current || week > Math.min(current + 1, 52))
          throw new CareerError(400, "You can only plan streams for this week or next week");
        return view(tx, root, week);
      });
    },
    async scheduleNight(actor: CareerActor, saveId: string, body: unknown) {
      const { dayOfWeek, week: requestedWeek } = z.object({ dayOfWeek: z.number().int().min(1).max(7), week: z.number().int().min(1).max(52) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const current = Number(root.current_week);
        if (requestedWeek < current || requestedWeek > Math.min(current + 1, 52))
          throw new CareerError(409, "You can only schedule a stream for this week or next week");
        if (requestedWeek === current) throw new CareerError(409, "Go live directly for a stream this week");
        const v = await view(tx, root, requestedWeek);
        if (v.live) throw new CareerError(409, "Finish your live stream before booking another night");
        if (v.streamsThisWeek >= v.perWeek) throw new CareerError(409, `You've streamed ${v.perWeek} times that week`);
        const day = absoluteDay(requestedWeek, dayOfWeek);
        const existing = (await tx.execute(sql`SELECT id FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${v.season}
          AND family='DARTCAST' AND status='ACCEPTED' AND day=${day}`)).rows[0];
        if (existing) return v;
        if (!v.freeNights.includes(dayOfWeek)) throw new CareerError(409, "You're booked that night");
        const id = stableUuid(root.world_seed, STREAM.version, "dartcast-planner-booking", root.id, v.season, requestedWeek, dayOfWeek);
        await tx.execute(sql`INSERT INTO career_life_commitments (career_save_id,id,family,title,season,day,fee_pence,contract_id,status)
          VALUES (${root.id},${id},'DARTCAST','DartCast stream',${v.season},${day},0,NULL,'ACCEPTED') ON CONFLICT DO NOTHING`);
        return view(tx, root, requestedWeek);
      });
    },
    async session(actor: CareerActor, saveId: string, streamId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key, ch.followers);
      });
    },

    /** Go live on a free night this week (up to three a week, one at a time) in the format of your choice. */
    async goLive(actor: CareerActor, saveId: string, body: unknown) {
      const { dayOfWeek, format = "CHALLENGER", streamer: streamerKey } = z.object({ dayOfWeek: z.number().int().min(1).max(7),
        format: z.enum(["COLLAB", "INVITATIONAL", "CUP", "CELEBRATION", ...FORMATS.map(f => f.key)] as [StreamFormat, ...StreamFormat[]]).optional(), streamer: z.string().max(40).optional() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root);
        if (v.live) throw new CareerError(409, "You're already live: finish that stream first");
        const cupNight = format === "CUP";
        if (!cupNight && v.streamsThisWeek >= v.perWeek) throw new CareerError(409, `You've streamed ${v.perWeek} times this week`);
        if (cupNight && !v.cups.current) throw new CareerError(409, "No Creator Cup is on this week");
        if (cupNight && !v.cups.current!.open) throw new CareerError(409, v.cups.current!.why ?? "The Creator Cup isn't open");
        if (format === "CELEBRATION" && !v.celebration) throw new CareerError(409, "Celebration streams come with a follower milestone");
        const planned = (await tx.execute(sql`SELECT id FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
          AND family='DARTCAST' AND status='ACCEPTED' AND day=${absoluteDay(week, dayOfWeek)}`)).rows[0];
        if (!v.freeNights.includes(dayOfWeek) && !planned) throw new CareerError(409, "You're booked that night");
        const partner = format === "COLLAB" ? v.collabs.find(c => c.key === streamerKey) : undefined;
        if (format === "COLLAB" && !partner) throw new CareerError(400, "Pick a streamer to collab with");
        if (partner && !partner.ok) throw new CareerError(409, `${partner.handle}: ${partner.why}`);
        if (format === "INVITATIONAL" && !v.invitational.open) throw new CareerError(409, v.invitational.why ?? "The Invitational isn't open");
        if (format === "CHARITY" && v.tier.key === "NEWCOMER") throw new CareerError(409, "Charity streams start once you're an Affiliate (viewers can cheer)");
        if (format === "CHARITY" && v.charity.doneThisMonth) throw new CareerError(409, "One charity stream a month");
        if (format === "COMMUNITY" && v.community.size < COMMUNITY.nightMin) throw new CareerError(409, `Community nights need ${COMMUNITY.nightMin} regulars`);
        const n = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams WHERE career_save_id=${root.id}`)).rows[0].n) + 1;
        const key = `${season}:${week}:${n}`;
        const last = (await tx.execute(sql`SELECT season, day FROM career_streams WHERE career_save_id=${root.id} ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
        const day = absoluteDay(week, dayOfWeek);
        const since = last && Number(last.season) === season ? Math.max(0, day - Number(last.day)) : null;
        const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
        const viewers = Math.max(1, Math.round(openingViewers(root.world_seed, key, v.followers, fans, dayOfWeek, since) * (format === "COLLAB" ? 1 : format === "INVITATIONAL" || cupNight || format === "CELEBRATION" ? formatByKey(format).crowd : crowdFor(format, v.lastFormat, v.pollPick))
          * studioAudienceMultiplier(v.studio.level) * (1 + await modViewerBonus(tx, root.id))
          * (planned || v.pathway.scheduledNights.includes(dayOfWeek) ? NOTIFY_BONUS : 1)
          + (partner ? partner.followers * COLLAB.tuneIn : 0)));
        const id = stableUuid(root.world_seed, STREAM.version, "stream", root.id, key);
        // A booked night: followers got the go-live notification. And maybe a creator raids you as you start.
        const notified = !!planned || v.pathway.scheduledNights.includes(dayOfWeek);
        const owed = new Set((await tx.execute(sql`SELECT streamer_key FROM career_stream_raids WHERE career_save_id=${root.id} AND direction='OUT' AND NOT returned`)).rows.map(r => String(r.streamer_key)));
        const raid = format === "COLLAB" ? null : raidIn(root.world_seed, key, v.followers,
          v.scene.creators.filter(c => c.key !== streamerKey).map(c => ({ key: c.key, handle: c.handle, followers: c.followers, owed: owed.has(c.key) })));
        const opening = viewers + (raid?.viewers ?? 0);
        const tally: Tally = { viewers: opening, peak: opening, hype: format === "CELEBRATION" ? 2 : raid || cupNight ? 1.2 : 0.6, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0, studioLevel:v.studio.level,
          ov: { startFollowers: v.followers, ...(raid ? { raidIn: raid } : {}) } };
        let challenger: Challenger, drill: DrillSpec | null = null, hello: ChatEvent[], cupState: CupState | null = null, extra: Record<string, unknown> | null = null;
        if (cupNight) {
          const cup = v.cups.current!;
          cupState = { n: cup.n, name: cup.name, season, size: cup.size, field: cup.field };
          const opp = cupOpponent(root.world_seed, cupState, 0, []);
          if (!opp) throw new CareerError(409, "The draw isn't ready");
          challenger = cupChallenger(root.world_seed, id, opp, 0);
          hello = [{ kind: "ALERT", alert: "WELCOME", text: `${cup.name}: ${cup.size} creators, one night` },
            ...(cup.callout ? [{ kind: "CHAT" as const, user: cup.callout.handle, text: cup.callout.text }] : []),
            { kind: "CHAT", user: "DartCast", text: `${roundName(cup.size, 0)}: ${opp.handle}. First to ${legsToWinIn(cup.size, 0)}` }];
          extra = { cup: cupState };
        } else if (format === "CELEBRATION") {
          const c = challengerFor(root.world_seed, key, v.followers);
          challenger = { name: c.name, avg: c.avg, bot: { config: c.config, seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) } };
          hello = [{ kind: "ALERT", alert: "MILESTONE", text: `${v.celebration!.milestone.toLocaleString("en-GB")} followers: party stream! 🎉` },
            { kind: "CHAT", user: "DartCast", text: "Celebration night! Everyone's here, and one lucky viewer gets a game" },
            { kind: "CHAT", user: challenger.name, text: `What a milestone! First to ${STREAM.legsToWin}, you throw first` }];
          extra = { cup: { milestone: v.celebration!.milestone } };
        } else if (format === "INVITATIONAL") {
          challenger = invitationalChallenger(root.world_seed, id, season, week, 0);
          hello = [{ kind: "CHAT", user: "DartCast", text: `Welcome to the DartCast Invitational! ${INVITATIONAL.rounds[0]}: ${challenger.name}. First to ${STREAM.legsToWin}` }];
        } else if (partner) {
          challenger = { name: partner.handle, avg: partner.avg, bot: { config: collabBot(partner.avg), seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) },
            streamer: { key: partner.key, followers: partner.followers } };
          hello = [{ kind: "CHAT", user: partner.handle, text: `Collab night! My lot vs yours, first to ${STREAM.legsToWin}. You throw first` },
            { kind: "CHAT", user: "DartCast", text: `${partner.handle}'s viewers are joining the stream` }];
        } else if (format === "COMMUNITY") {
          const regular = await communityChallenger(tx, root.id, root.world_seed, key);
          if (!regular) throw new CareerError(409, `Community nights need ${COMMUNITY.nightMin} regulars`);
          const c = challengerFor(root.world_seed, key, v.followers);
          challenger = { name: regular.name, avg: c.avg, bot: { config: c.config, seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) } };
          hello = [{ kind: "CHAT", user: "DartCast", text: "Community night: one of your regulars takes you on" },
            { kind: "CHAT", user: regular.name, text: `Been waiting for this! First to ${STREAM.legsToWin}, you throw first` }];
        } else if (format === "CHALLENGER" || format === "KING" || format === "CHARITY") {
          if (format === "KING") challenger = kingChallenger(root.world_seed, id, v.followers, 0);
          else { const c = challengerFor(root.world_seed, key, v.followers); challenger = { name: c.name, avg: c.avg, bot: { config: c.config, seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) } }; }
          hello = [{ kind: "CHAT", user: challenger.name, text: format === "KING" ? "I'll be first up. One leg, you throw first" : `I'll have a go! First to ${STREAM.legsToWin}, you throw first` },
            ...(format === "CHARITY" ? [{ kind: "CHAT" as const, user: "DartCast", text: "Charity night: every bit and super chat tonight goes to the cause" }] : [])];
        } else {
          if (format === "CHECKOUTS") drill = { kind: "CHECKOUTS", targets: checkoutTargets(root.world_seed, key), visitsEach: 3 };
          else if (format === "BOBS_27") drill = { kind: "BOBS_27" };
          else {
            const prior = (await tx.execute(sql`SELECT drill->>'achieved' AS a FROM career_streams WHERE career_save_id=${root.id} AND format='SCORING' AND status='ENDED'
              AND drill ? 'achieved' ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
            drill = { kind: "SCORING", visits: 33, targetAverage: scoringTarget(prior ? Number(prior.a) : null) };
          }
          challenger = { name: formatByKey(format).name, avg: 0, bot: null };
          hello = [{ kind: "CHAT", user: "DartCast", text: drill.kind === "CHECKOUTS" ? `Chat picked tonight's finishes: ${drill.targets.join(", ")}`
            : drill.kind === "SCORING" ? `Target tonight: a ${drill.targetAverage} average. Pledges pay if you beat it` : "Bob's 27: D1 first. Good luck!" }];
        }
        if (notified) hello.unshift({ kind: "ALERT", alert: "NOTIFY", text: `🔔 Go-live notification sent to ${v.followers.toLocaleString("en-GB")} follower${v.followers === 1 ? "" : "s"}` });
        if (raid) hello.push({ kind: "ALERT", alert: "RAID", user: raid.handle, text: `${raid.handle} is raiding with ${raid.viewers} viewers!` },
          { kind: "CHAT", user: raid.handle, text: "Raid! Show them some love, chat" });
        hello.push(...await arrivals(tx, root.id, season, week));
        if (v.pollPick === format && v.lastFormat !== null) hello.push({ kind: "CHAT", user: "DartCast", text: "Chat voted for this one: they've turned up for it" });
        const campaignRow=(await tx.execute(sql`SELECT * FROM career_stream_campaigns WHERE career_save_id=${root.id}
          AND status='ACTIVE' AND required_format=${format} AND expires_week>=${week} ORDER BY created_at LIMIT 1`)).rows[0];
        const campaign=campaignRow?campaignFrom(campaignRow):null;
        if(campaign)hello.push({kind:"CHAT",user:campaign.sponsorName,text:`Sponsored stream: ${campaign.brief}`});
        await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, format, challenger, drill, first_thrower, tally, chat, processed_visits)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', ${format}, ${JSON.stringify(challenger)}::jsonb, ${drill ? JSON.stringify(drill) : null}::jsonb, 0,
            ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0)`);
        if(campaign){
          const snapshot={id:campaign.id,sponsorKey:campaign.sponsorKey,sponsorName:campaign.sponsorName,requiredFormat:campaign.requiredFormat,
            requiredFormatName:campaign.requiredFormatName,brief:campaign.brief,rewardPence:campaign.rewardPence};
          await tx.execute(sql`UPDATE career_streams SET sponsor_campaign_id=${campaign.id},sponsor_campaign=${JSON.stringify(snapshot)}::jsonb WHERE career_save_id=${root.id} AND id=${id}`);
          await tx.execute(sql`UPDATE career_stream_campaigns SET status='IN_PROGRESS',stream_id=${id} WHERE career_save_id=${root.id} AND id=${campaign.id} AND status='ACTIVE'`);
        }
        if (extra) await tx.execute(sql`UPDATE career_streams SET cup=${JSON.stringify(extra.cup)}::jsonb${cupState ? sql`, match_format=${JSON.stringify(cupFormat(cupState.size, 0))}::jsonb` : sql``}
          WHERE career_save_id=${root.id} AND id=${id}`);
        if (raid) {
          await tx.execute(sql`INSERT INTO career_stream_raids (career_save_id, stream_id, direction, streamer_key, season, week, viewers)
            VALUES (${root.id}, ${id}, 'IN', ${raid.key}, ${season}, ${week}, ${raid.viewers}) ON CONFLICT DO NOTHING`);
          await tx.execute(sql`UPDATE career_stream_raids SET returned=true WHERE career_save_id=${root.id} AND direction='OUT' AND streamer_key=${raid.key}`);
        }
        if (planned && !cupNight) await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND id=${String(planned.id)}`);
        return sessionFrom((await live(tx, root, id)), v.handle, v.tier.key, v.followers);
      });
    },

    /**
     * The darts so far (the whole log for this match, round or drill, as the scorer keeps it). The server replays them with
     * the shared rules and chat reacts to each new visit; when it's over the stream ends and pays. The same log again changes nothing.
     */
    async darts(actor: CareerActor, saveId: string, streamId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(600) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        const ch = await channel(tx, root);
        const tier = tierFor(ch.followers).key;
        if (row.status !== "LIVE") return { session: sessionFrom(row, ch.handle, tier, ch.followers), events: [] as ChatEvent[] };
        const events = isDrill(String(row.format)) ? await drillDarts(tx, root, row, darts, tier) : await matchDarts(tx, root, row, darts, tier, ch.followers);
        // Remember the average reached on a scoring challenge, for next time's target.
        const after = await live(tx, root, streamId);
        if (after.status === "ENDED" && after.format === "SCORING") {
          const avg = replayDrill(after.drill as DrillSpec, after.darts as unknown[]).average;
          await tx.execute(sql`UPDATE career_streams SET drill = drill || ${JSON.stringify({ achieved: avg })}::jsonb WHERE career_save_id=${root.id} AND id=${streamId}`);
        }
        return { session: sessionFrom(await live(tx, root, streamId), ch.handle, tier, ch.followers), events };
      });
    },

    /**
     * Stream your real match from the venue (an event without TV cameras): chat follows the match's own dart log, kept by
     * the live match. `start` false only reports; true starts the stream (once) and catches chat up with the darts so far.
     */
    async matchStream(actor: CareerActor, saveId: string, matchId: string, start: boolean): Promise<MatchStream> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, start) as unknown as Root;
        const live = (await tx.execute(sql`SELECT s.format, s.first_thrower, s.darts, s.opponent_key, s.bot_config, s.status, m.scheduled_day, i.presentation_tier, i.season
          FROM career_match_sessions s JOIN career_tournament_matches m ON m.career_save_id=s.career_save_id AND m.id=s.match_id
          JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
          WHERE s.career_save_id=${root.id} AND s.match_id=${matchId}`)).rows[0];
        let row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${matchId}`)).rows[0];
        const ch = await channel(tx, root), tier = tierFor(ch.followers).key;
        const why = !live ? "Open the match first" : TELEVISED.has(String(live.presentation_tier)) ? "This match is on TV: no streaming from the venue"
          : !row && live.status === "COMPLETED" ? "This match is over" : null;
        if (!start || why || !live) return { eligible: !why, why, session: row ? sessionFrom(row, ch.handle, tier, ch.followers) : null, events: [] };
        if (!row) {
          const npc = (await loadNpcs(tx, root.id, { ids: [String(live.opponent_key)] }))[0];
          const season = Number(live.season), day = Number(live.scheduled_day), week = Math.ceil(day / 7);
          const id = stableUuid(root.world_seed, STREAM.version, "stream-match", root.id, matchId);
          const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
          const viewers = Math.max(1, Math.round(openingViewers(root.world_seed, id, ch.followers, fans, ((day - 1) % 7) + 1, null) * formatByKey("MATCH").crowd * studioAudienceMultiplier(ch.studioLevel) * (1 + await modViewerBonus(tx, root.id))));
          const tally: Tally = { viewers, peak: viewers, hype: 0.7, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0, studioLevel:ch.studioLevel, ov: { startFollowers: ch.followers } };
          const name = npc ? `${npc.firstName} ${npc.surname}` : "Opponent";
          const hello: ChatEvent[] = [{ kind: "CHAT", user: "DartCast", text: `Live from the venue: ${ch.handle} vs ${name}. This one's for real` }];
          await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, format, challenger, first_thrower, tally, chat, processed_visits, match_id, match_format)
            VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', 'MATCH', ${JSON.stringify({ name, avg: Number((live.bot_config as { avg: number }).avg), bot: null })}::jsonb,
              ${Number(live.first_thrower ?? 0)}, ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0, ${matchId}, ${JSON.stringify(live.format)}::jsonb)
            ON CONFLICT DO NOTHING`);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${matchId}`)).rows[0];
        }
        let events: ChatEvent[] = [];
        // Chat catches up with the match's own darts (once the bull-up has decided who throws first).
        if (row.status === "LIVE" && live.first_thrower !== null) {
          if (Number(row.first_thrower) !== Number(live.first_thrower)) {
            await tx.execute(sql`UPDATE career_streams SET first_thrower=${Number(live.first_thrower)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
            row = { ...row, first_thrower: Number(live.first_thrower) };
          }
          events = await matchDarts(tx, root, row, live.darts as unknown[], tier, ch.followers);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${String(row.id)}`)).rows[0];
        }
        return { eligible: true, why: null, session: sessionFrom(row, ch.handle, tier, ch.followers), events };
      });
    },

    /**
     * Stream any other live Career match (money match, road trip, club or county singles, county trial, Pro-Am, webcam
     * league, local competition) on DartCast. Like a tournament match stream it is extra to your weekly stream nights
     * (format MATCH never counts towards them). The match must be one of this save's own live activities; its scorer
     * sends the same dart log it already keeps, and chat follows it until the match is decided, when the stream pays.
     */
    async sideMatchStream(actor: CareerActor, saveId: string, refId: string, body: unknown): Promise<MatchStream> {
      const input = z.object({
        start: z.boolean(),
        kind: z.enum(["MONEY", "ROAD", "TEAM", "COUNTY", "COUNTY_TRIAL", "PROAM", "CAM", "LOCAL"]),
        format: z.record(z.string(), z.unknown()),
        firstThrower: z.union([z.literal(0), z.literal(1)]),
        opponentName: z.string().min(1).max(80),
        opponentAvg: z.number().min(0).max(130),
        darts: z.array(z.unknown()).max(600),
      }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, input.start) as unknown as Root;
        const ch = await channel(tx, root), tier = tierFor(ch.followers).key;
        let row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${refId}`)).rows[0];
        if (!row) {
          if (!(await ownsSideMatch(tx, root.id, input.kind, refId))) return { eligible: false, why: "That match isn't yours to stream", session: null, events: [] };
          if (root.status !== "ACTIVE") return { eligible: false, why: "Your Career has ended", session: null, events: [] };
          if (!input.start) return { eligible: true, why: null, session: null, events: [] };
          let format: X01Format;
          try { format = validateFormat(input.format as unknown as X01Format); } catch { throw new CareerError(400, "That match can't be streamed"); }
          const season = Number(root.current_season), week = Number(root.current_week), day = absoluteDay(week, 1);
          const id = stableUuid(root.world_seed, STREAM.version, "stream-side-match", root.id, refId);
          const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
          const viewers = Math.max(1, Math.round(openingViewers(root.world_seed, id, ch.followers, fans, 1, null) * formatByKey("MATCH").crowd * studioAudienceMultiplier(ch.studioLevel) * (1 + await modViewerBonus(tx, root.id))));
          const tally: Tally = { viewers, peak: viewers, hype: 0.7, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0, studioLevel: ch.studioLevel, ov: { startFollowers: ch.followers } };
          const where = SIDE_MATCH_WHERE[input.kind];
          const hello: ChatEvent[] = [{ kind: "CHAT", user: "DartCast", text: `Live ${where}: ${ch.handle} vs ${input.opponentName}. This one's for real` }];
          await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, format, challenger, first_thrower, tally, chat, processed_visits, match_id, match_format)
            VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', 'MATCH', ${JSON.stringify({ name: input.opponentName, avg: input.opponentAvg, bot: null })}::jsonb,
              ${input.firstThrower}, ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0, ${refId}, ${JSON.stringify(format)}::jsonb)
            ON CONFLICT DO NOTHING`);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${refId}`)).rows[0];
        }
        let events: ChatEvent[] = [];
        if (input.start && row.status === "LIVE" && input.darts.length) {
          events = await matchDarts(tx, root, row, input.darts, tier, ch.followers);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${String(row.id)}`)).rows[0];
        }
        return { eligible: true, why: null, session: sessionFrom(row, ch.handle, tier, ch.followers), events };
      });
    },

    /** Take a brand's offer (it pays for each of your next streams) or turn it down. */
    async answerDeal(actor: CareerActor, saveId: string, dealId: string, body: unknown) {
      const { accept } = z.object({ accept: z.boolean() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = (await tx.execute(sql`SELECT status FROM career_stream_deals WHERE career_save_id=${root.id} AND id=${dealId}`)).rows[0];
        if (!row) throw new CareerError(404, "Brand deal not found");
        if (row.status !== "OFFERED") throw new CareerError(409, "That offer has gone");
        await tx.execute(sql`UPDATE career_stream_deals SET status=${accept ? "ACTIVE" : "DECLINED"} WHERE career_save_id=${root.id} AND id=${dealId}`);
        return view(tx, root);
      });
    },

    async answerCampaign(actor:CareerActor,saveId:string,campaignId:string,body:unknown){
      const {accept}=z.object({accept:z.boolean()}).strict().parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as unknown as Root;
        const campaign=(await tx.execute(sql`SELECT status,season,expires_week FROM career_stream_campaigns WHERE career_save_id=${root.id} AND id=${campaignId}`)).rows[0];
        if(!campaign)throw new CareerError(404,"Sponsor campaign not found");
        if(campaign.status!=="OFFERED")throw new CareerError(409,"That campaign offer has gone");
        if(Number(campaign.season)!==Number(root.current_season)||Number(campaign.expires_week)<Number(root.current_week)){
          throw new CareerError(409,"That campaign offer has expired");
        }
        await tx.execute(sql`UPDATE career_stream_campaigns SET status=${accept?"ACTIVE":"DECLINED"} WHERE career_save_id=${root.id} AND id=${campaignId} AND status='OFFERED'`);
        return view(tx,root);
      });
    },

    /** Set this month's sub goal (Partner up, one a month): hit it and the buzz wins followers. */
    async setSubGoal(actor: CareerActor, saveId: string, body: unknown) {
      const { target, promise } = z.object({ target: z.number().int(), promise: z.string() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), month = monthOf(Number(root.current_week));
        const v = await view(tx, root);
        if (!v.goalOptions) throw new CareerError(409, "Sub goals start once you're a Partner");
        if (!SUB_GOAL.targets.includes(target) || !(SUB_GOAL.promises as readonly string[]).includes(promise)) throw new CareerError(400, "Pick a target and a promise from the list");
        if (v.subGoal && v.subGoal.season === season && v.subGoal.month === month) throw new CareerError(409, "You've set this month's goal");
        await tx.execute(sql`UPDATE career_stream_channels SET sub_goal=${JSON.stringify({ season, month, target, promise, status: "ON" })}::jsonb WHERE career_save_id=${root.id}`);
        return view(tx, root);
      });
    },

    /** Buy only the next studio tier; payment and upgrade are atomic and optional. */
    async buyStudioUpgrade(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Retired Careers cannot buy studio upgrades");
        const ch = await channel(tx, root), upgrade = STUDIO_UPGRADES.find(item => item.level === ch.studioLevel + 1);
        if (!upgrade) throw new CareerError(409, "Your DartCast studio is already fully upgraded");
        const balance=Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id=${root.id}`)).rows[0]?.balance_pence??0);
        const reserved=Number((await tx.execute(sql`SELECT COALESCE(SUM(estimated_trip_pence),0)::bigint AS reserved FROM career_event_finance
          WHERE career_save_id=${root.id} AND status='ENTERED'`)).rows[0]?.reserved??0);
        if(balance-reserved<upgrade.costPence)throw new InsufficientFundsError(upgrade.costPence,balance-reserved);
        await post(tx, root, { operationKey: `adjustment:studio-upgrade:${upgrade.level}`, category: "ADJUSTMENT", headline: "EXPENSE",
          amountPence: -upgrade.costPence, reason: `DartCast studio upgrade: ${upgrade.name}`, season: Number(root.current_season), week: Number(root.current_week),
          detail: { type: "DARTCAST_STUDIO_UPGRADE", level: upgrade.level, name: upgrade.name, audienceBonusPercent: Math.round(upgrade.audienceBonus * 100) } });
        await tx.execute(sql`UPDATE career_stream_channels SET studio_level=${upgrade.level} WHERE career_save_id=${root.id}`);
        return view(tx, root);
      });
    },

    /** End the stream early (no result): followers and money so far are kept. */
    async end(actor: CareerActor, saveId: string, streamId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        if (row.status === "LIVE") {
          const wins = ((row.rounds as StreamSession["rounds"]) ?? []).filter(r => r.result === "WON").length;
          await finish(tx, root, row, null, row.tally as Tally, row.chat as ChatEvent[], Number(row.processed_visits) + wins, wins);
        }
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key, ch.followers);
      });
    },
  };
}

