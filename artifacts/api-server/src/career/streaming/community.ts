import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { scopedRandom } from "../world/random.ts";
import { COMMUNITY, PERSONAS, STREAM, handleFor, tierFor, type ChatEvent, type Persona, type Regular, type TierKey } from "./model.ts";

/**
 * Your community: regulars join as the channel grows, grow loyal by catching your shows, and fade (then drift away)
 * when you go quiet. Loyal regulars can be made moderators or VIPs. None of it touches your darts.
 */
export type CommunityMember = { key: string; name: string; persona: Persona; personaName: string; emoji: string; loyalty: number;
  streams: number; role: "NONE" | "MOD" | "VIP"; joinedSeason: number; joinedWeek: number; canMod: boolean; canVip: boolean;
  /** Months subscribed (null if they aren't a subscriber). */ subMonths: number | null };
export type CommunityView = { size: number; target: number; members: CommunityMember[]; recentlyLeft: { name: string; persona: Persona }[];
  modSlots: number; vipSlots: number; mods: number; vips: number; modLoyalty: number; vipLoyalty: number; viewerBonusPercent: number };

const PERSONA_KEYS = Object.keys(PERSONAS) as Persona[];

/** The regulars in the room (loyalest first), for chat. */
export async function activeRegulars(tx: CareerExecutor, saveId: string, limit = 12): Promise<Regular[]> {
  if (!await ready(tx)) return [];
  return (await tx.execute(sql`SELECT name, persona, role FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE'
    ORDER BY (role<>'NONE') DESC, loyalty DESC, key LIMIT ${limit}`)).rows.map(r => ({ name: String(r.name), persona: r.persona as Persona, role: r.role as Regular["role"] }));
}

/** Moderators keep a little more of the audience watching (a share added to opening viewers). */
export async function modViewerBonus(tx: CareerExecutor, saveId: string) {
  if (!await ready(tx)) return 0;
  const mods = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE' AND role='MOD'`)).rows[0]?.n ?? 0);
  return Math.min(COMMUNITY.modViewerCap, mods * COMMUNITY.modViewerBonus);
}

/** After a stream that got going: everyone in the room grows a little more loyal, and new regulars join while there's room. */
export async function attendStream(tx: CareerExecutor, root: { id: string; world_seed: string }, season: number, week: number, followers: number) {
  if (!await ready(tx)) return;
  await tx.execute(sql`UPDATE career_stream_regulars SET loyalty=LEAST(100, loyalty + ${COMMUNITY.attend}::int), streams=streams+1, last_season=${season}, last_week=${week}
    WHERE career_save_id=${root.id} AND status='ACTIVE'`);
  const tier = tierFor(followers).key, target = COMMUNITY.size[tier];
  // From Partner, loyal regulars may subscribe (their sub anniversaries are celebrated on stream).
  if (tier === "PARTNER" || tier === "STAR") {
    const abs = (season - 1) * 52 + week;
    for (const r of (await tx.execute(sql`SELECT key FROM career_stream_regulars WHERE career_save_id=${root.id} AND status='ACTIVE' AND subbed_week IS NULL
        AND loyalty >= ${COMMUNITY.subLoyalty}::int ORDER BY key`)).rows) {
      if (scopedRandom(root.world_seed, STREAM.version, "stream-regular-sub", root.id, String(r.key), abs)() < COMMUNITY.subChance)
        await tx.execute(sql`UPDATE career_stream_regulars SET subbed_week=${abs}::int WHERE career_save_id=${root.id} AND key=${String(r.key)}`);
    }
  }
  const counts = (await tx.execute(sql`SELECT COUNT(*) FILTER (WHERE status='ACTIVE')::int AS active, COUNT(*)::int AS total
    FROM career_stream_regulars WHERE career_save_id=${root.id}`)).rows[0];
  const active = Number(counts?.active ?? 0), total = Number(counts?.total ?? 0);
  const joining = Math.min(Math.max(0, target - active), tier === "NEWCOMER" || tier === "AFFILIATE" ? 1 : 2);
  for (let i = 0; i < joining; i++) {
    const n = total + i, rng = scopedRandom(root.world_seed, STREAM.version, "stream-regular", root.id, n);
    await tx.execute(sql`INSERT INTO career_stream_regulars (career_save_id, key, name, persona, loyalty, joined_season, joined_week, last_season, last_week, streams)
      VALUES (${root.id}, ${`r${n}`}, ${handleFor(rng)}, ${PERSONA_KEYS[Math.floor(rng() * PERSONA_KEYS.length)]}, ${COMMUNITY.startLoyalty}, ${season}, ${week}, ${season}, ${week}, 1)
      ON CONFLICT DO NOTHING`);
  }
}

/** The week's end: if you haven't streamed for a while, loyalty fades (mods hold on longer); at zero a regular drifts away. */
export async function settleCommunity(tx: CareerExecutor, saveId: string, season: number, week: number) {
  if (!await ready(tx)) return;
  const absolute = (season - 1) * 52 + week;
  const last = (await tx.execute(sql`SELECT MAX((season-1)*52+week)::int AS w FROM career_streams WHERE career_save_id=${saveId} AND status='ENDED'`)).rows[0]?.w;
  if (last === null || last === undefined || absolute - Number(last) < COMMUNITY.graceWeeks) return;
  const half = Math.ceil(COMMUNITY.decay / 2);
  await tx.execute(sql`UPDATE career_stream_regulars SET loyalty=GREATEST(0, loyalty - CASE WHEN role='MOD' THEN ${half}::int ELSE ${COMMUNITY.decay}::int END)
    WHERE career_save_id=${saveId} AND status='ACTIVE'`);
  await tx.execute(sql`UPDATE career_stream_regulars SET status='LAPSED', role='NONE', last_season=${season}, last_week=${week}
    WHERE career_save_id=${saveId} AND status='ACTIVE' AND loyalty=0`);
}

/** Make a loyal regular a moderator or VIP (or take it back). Slots grow with your tier. */
export async function setRole(tx: CareerExecutor, saveId: string, key: string, role: "NONE" | "MOD" | "VIP", followers: number) {
  const row = (await tx.execute(sql`SELECT role, loyalty, status FROM career_stream_regulars WHERE career_save_id=${saveId} AND key=${key}`)).rows[0];
  if (!row || row.status !== "ACTIVE") throw new CareerError(404, "That regular isn't in your community");
  if (row.role === role) return;
  if (role !== "NONE") {
    const tier = tierFor(followers).key, slots = role === "MOD" ? COMMUNITY.modSlots[tier] : COMMUNITY.vipSlots[tier];
    const need = role === "MOD" ? COMMUNITY.modLoyalty : COMMUNITY.vipLoyalty;
    if (!slots) throw new CareerError(409, `${role === "MOD" ? "Moderators" : "VIPs"} open up at Affiliate`);
    if (Number(row.loyalty) < need) throw new CareerError(409, `They need ${need} loyalty first`);
    const used = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE' AND role=${role}`)).rows[0]?.n ?? 0);
    if (used >= slots) throw new CareerError(409, `All ${slots} ${role === "MOD" ? "moderator" : "VIP"} slots are taken`);
  }
  await tx.execute(sql`UPDATE career_stream_regulars SET role=${role} WHERE career_save_id=${saveId} AND key=${key}`);
}

export async function communityView(tx: CareerExecutor, saveId: string, tier: TierKey, absWeek = 0): Promise<CommunityView> {
  const rows = await ready(tx) ? (await tx.execute(sql`SELECT * FROM career_stream_regulars WHERE career_save_id=${saveId}
    ORDER BY (status='ACTIVE') DESC, (role<>'NONE') DESC, loyalty DESC, key`)).rows : [];
  const active = rows.filter(r => r.status === "ACTIVE");
  const mods = active.filter(r => r.role === "MOD").length, vips = active.filter(r => r.role === "VIP").length;
  const modSlots = COMMUNITY.modSlots[tier], vipSlots = COMMUNITY.vipSlots[tier];
  return { size: active.length, target: COMMUNITY.size[tier], modSlots, vipSlots, mods, vips, modLoyalty: COMMUNITY.modLoyalty, vipLoyalty: COMMUNITY.vipLoyalty,
    viewerBonusPercent: Math.round(Math.min(COMMUNITY.modViewerCap, mods * COMMUNITY.modViewerBonus) * 100),
    members: active.map(r => {
      const persona = r.persona as Persona, loyalty = Number(r.loyalty), role = r.role as CommunityMember["role"];
      return { key: String(r.key), name: String(r.name), persona, personaName: PERSONAS[persona]?.name ?? persona, emoji: PERSONAS[persona]?.emoji ?? "",
        loyalty, streams: Number(r.streams), role, joinedSeason: Number(r.joined_season), joinedWeek: Number(r.joined_week),
        canMod: role !== "MOD" && loyalty >= COMMUNITY.modLoyalty && mods < modSlots, canVip: role !== "VIP" && loyalty >= COMMUNITY.vipLoyalty && vips < vipSlots,
        subMonths: r.subbed_week === null || r.subbed_week === undefined ? null : Math.max(0, Math.floor((absWeek - Number(r.subbed_week)) / 4)) };
    }),
    recentlyLeft: rows.filter(r => r.status === "LAPSED").slice(0, 5).map(r => ({ name: String(r.name), persona: r.persona as Persona })) };
}

/** As you go live: VIPs announce themselves, and anyone whose community anniversary falls this week gets a shout-out. */
export async function arrivals(tx: CareerExecutor, saveId: string, season: number, week: number): Promise<ChatEvent[]> {
  if (!await ready(tx)) return [];
  const rows = (await tx.execute(sql`SELECT name, role, joined_season, joined_week FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE'
    AND (role='VIP' OR (joined_week=${week} AND joined_season<${season})) ORDER BY loyalty DESC, key LIMIT 6`)).rows;
  const out: ChatEvent[] = [];
  // Sub anniversaries: 3, 6, 12 months and on (each celebrated once, on the first stream after it comes round).
  const abs = (season - 1) * 52 + week;
  for (const r of (await tx.execute(sql`SELECT key, name, subbed_week, sub_celebrated FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE'
      AND subbed_week IS NOT NULL ORDER BY key`)).rows) {
    const months = Math.floor((abs - Number(r.subbed_week)) / 4);
    const m = [...COMMUNITY.subMilestones].reverse().find(x => months >= x);
    if (m && m > Number(r.sub_celebrated)) {
      out.push({ kind: "ALERT", alert: "WELCOME", user: String(r.name), text: `${r.name} resubscribed: ${m} months!` },
        { kind: "CHAT", user: String(r.name), text: m >= 12 ? `${m / 12 >= 2 ? `${m / 12} years` : "A whole year"} subbed. Wouldn't watch anyone else 💜` : `${m} months and counting!` });
      await tx.execute(sql`UPDATE career_stream_regulars SET sub_celebrated=${m}::int WHERE career_save_id=${saveId} AND key=${String(r.key)}`);
    }
  }
  for (const r of rows) {
    const years = season - Number(r.joined_season);
    if (Number(r.joined_week) === week && years > 0) out.push({ kind: "ALERT", alert: "WELCOME", user: String(r.name), text: `${r.name}: ${years} year${years === 1 ? "" : "s"} in the community!` });
    else if (r.role === "VIP") out.push({ kind: "CHAT", user: String(r.name), role: "VIP", text: "VIP in the building 👑 let's go!" });
  }
  return out;
}

/** Community night: a regular steps up (one of the loyalest, picked by the stream's seed). Null with fewer than three. */
export async function communityChallenger(tx: CareerExecutor, saveId: string, seed: string, streamKey: string) {
  if (!await ready(tx)) return null;
  const rows = (await tx.execute(sql`SELECT key, name FROM career_stream_regulars WHERE career_save_id=${saveId} AND status='ACTIVE' ORDER BY loyalty DESC, key LIMIT 6`)).rows;
  if (rows.length < COMMUNITY.nightMin) return null;
  const rng = scopedRandom(seed, STREAM.version, "stream-community-night", streamKey);
  const r = rows[Math.floor(rng() * rows.length)];
  return { key: String(r.key), name: String(r.name) };
}

/** After a community night, everyone in the room gets an extra loyalty boost. */
export async function communityNightBonus(tx: CareerExecutor, saveId: string) {
  if (!await ready(tx)) return;
  await tx.execute(sql`UPDATE career_stream_regulars SET loyalty=LEAST(100, loyalty + ${COMMUNITY.nightBonus}::int) WHERE career_save_id=${saveId} AND status='ACTIVE'`);
}

let seen = false;
async function ready(tx: CareerExecutor) {
  if (!seen) seen = (await tx.execute(sql`SELECT to_regclass('career_stream_regulars') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  return seen;
}
