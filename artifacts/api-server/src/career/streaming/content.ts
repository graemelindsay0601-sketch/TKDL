import { scopedRandom } from "../world/random.ts";
import { STREAM, STREAM_MONEY, type ClipKind, type StreamFormat, type TierKey } from "./model.ts";

/**
 * Content beyond going live: the things real creators make between streams.
 * - VODs: every stream stays up and keeps earning views (and ad money) for a few weeks after, fading week by week.
 * - Shorts: cut a clip into a Short. Shorts travel further than streams and pay very little: they're for growth. One a
 *   week can be boosted (a small fee to the platform) for more reach.
 * - The podcast: a weekly sit-down with a guest from the scene. Who'll come on depends on how well you know them; a good
 *   guest brings their audience, and from Partner a sponsor pays for a read.
 * - Watch-alongs: co-stream a televised event from your Career's world. No darts thrown, a big room, chat reacting to
 *   the real results. It uses a stream night.
 * - Studio sets: rooms you build out; each makes its kind of show a little more watchable.
 * None of it touches your darts.
 */
export const CONTENT = Object.freeze({
  vodWeeks: 4, vodShare: 0.6, vodFade: 0.55,
  vodFollowersPerThousand: 6,
  shortBase: { MAX: 900, BIG_FINISH: 1400, BIG_FISH: 3000, NINE: 9000, BOBS_BULL: 1100 } as Record<ClipKind, number>,
  shortFollowersPerThousand: 14, shortPencePerThousand: 20, boostPence: 2_000, boostReach: 2.5,
  podcastListenersShare: 0.06, podcastGuestShare: 0.01, podcastSponsorPence: { NEWCOMER: 0, AFFILIATE: 0, PARTNER: 3_000, STAR: 12_000, ICON: 25_000, LEGEND: 50_000 } as Record<TierKey, number>,
  watchAlongCrowd: 1.4,
});

export const PODCAST_TOPICS = [
  { key: "STORY", name: "Story time", blurb: "Tales from the oche and the road.", listen: 1.1 },
  { key: "TACTICS", name: "Tactics and setups", blurb: "Checkouts, grips, flights, practice routines.", listen: 0.95 },
  { key: "RIVALRY", name: "Settle the score", blurb: "Bring on someone you've clashed with. Big listens if it's a rival.", listen: 1 },
  { key: "QA", name: "Listener Q&A", blurb: "Your regulars' questions. Loyalty for everyone in the room.", listen: 0.9 },
] as const;
export type PodcastTopic = typeof PODCAST_TOPICS[number]["key"];

/** Studio sets: rooms you build, each a crowd bonus for its kind of show. Buy once, keep for good. */
export const STUDIO_SETS = [
  { key: "PUB", name: "Pub corner", blurb: "A proper local: dartboard, bar stools, a cheeky pint. Viewer and community nights feel like home.",
    costPence: 40_000, formats: ["CHALLENGER", "COMMUNITY", "COLLAB"] as StreamFormat[], bonus: 0.1 },
  { key: "LAB", name: "Practice lab", blurb: "Lights, cameras on the board, a stats wall. Drills become a show.",
    costPence: 60_000, formats: ["CHECKOUTS", "BOBS_27", "SCORING"] as StreamFormat[], bonus: 0.12 },
  { key: "ARENA", name: "Mini arena", blurb: "Walk-on lights and a stage. Big nights look the part.",
    costPence: 150_000, formats: ["KING", "INVITATIONAL", "CUP", "SUBATHON", "MARATHON", "CELEBRATION"] as StreamFormat[], bonus: 0.12 },
  { key: "BROADCAST", name: "Broadcast desk", blurb: "A desk, two mics and a big screen. Watch-alongs and real matches feel like TV.",
    costPence: 90_000, formats: ["WATCHALONG", "MATCH"] as StreamFormat[], bonus: 0.15 },
] as const;
export type StudioSetKey = typeof STUDIO_SETS[number]["key"];
/** The crowd bonus your sets give a format (sets don't stack on the same format beyond the best one). */
export const setBonus = (owned: readonly string[], format: string) =>
  Math.max(0, ...STUDIO_SETS.filter(s => owned.includes(s.key) && (s.formats as readonly string[]).includes(format)).map(s => s.bonus));

/** A VOD's views in a given week after the stream (week 1 = the week after it). */
export function vodViews(peak: number, visits: number, weeksAfter: number) {
  if (weeksAfter < 1 || weeksAfter > CONTENT.vodWeeks) return 0;
  const lengthFactor = Math.min(1.5, 0.5 + visits / 40);
  return Math.round(peak * CONTENT.vodShare * lengthFactor * Math.pow(CONTENT.vodFade, weeksAfter - 1) * 10);
}
/** What a week of VOD views pays (the same ad rate as live watch time, a view as two minutes). */
export const vodPence = (views: number) => Math.floor(views * 2 * STREAM_MONEY.adPencePerThousandViewerMinutes / 1000);

/** A Short's run: views from the moment, the size of the channel and luck (deterministic per Short). */
export function shortOutcome(seed: string, shortId: string, kind: ClipKind, followers: number, boosted: boolean) {
  const rng = scopedRandom(seed, STREAM.version, "stream-short", shortId);
  const base = CONTENT.shortBase[kind] ?? 800;
  const views = Math.round(base * (0.5 + rng() * 1.2) * (1 + Math.sqrt(Math.max(0, followers)) / 40) * (boosted ? CONTENT.boostReach : 1));
  return { views, followers: Math.round(views / 1000 * CONTENT.shortFollowersPerThousand), pence: Math.floor(views / 1000 * CONTENT.shortPencePerThousand) };
}

export const SMALL_CREATOR = 250;
/** Will they come on? Friends always; anyone near your size might; giants want you to be known first. */
export function guestAnswer(relationship: string, theirs: number, yours: number): { ok: boolean; why: string | null } {
  if (relationship === "FRIEND" || relationship === "BESTIE" || relationship === "RIVAL") return { ok: true, why: null };
  const ratio = theirs / Math.max(1, yours);
  // Small creators are always happy to chat (everyone remembers starting out).
  if (theirs <= SMALL_CREATOR) return { ok: true, why: null };
  if (relationship === "KNOWN" && ratio <= 12) return { ok: true, why: null };
  if (ratio <= 3) return { ok: true, why: null };
  return { ok: false, why: relationship === "NEW" ? "Doesn't know you yet: collab, raid or meet them in a cup first" : "Wants a bigger show first" };
}

/** An episode: listeners, followers, and a sponsor read from Partner. */
export function podcastOutcome(seed: string, key: string, yours: number, guestFollowers: number, topic: PodcastTopic, rival: boolean, tier: TierKey) {
  const rng = scopedRandom(seed, STREAM.version, "stream-podcast", key);
  const t = PODCAST_TOPICS.find(x => x.key === topic) ?? PODCAST_TOPICS[0];
  const bonus = topic === "RIVALRY" && rival ? 1.6 : 1;
  const listeners = Math.round((yours * CONTENT.podcastListenersShare + guestFollowers * CONTENT.podcastGuestShare) * t.listen * bonus * (0.8 + rng() * 0.4)) + 3;
  return { listeners, followers: Math.max(1, Math.round(listeners * 0.08)), sponsorPence: CONTENT.podcastSponsorPence[tier] };
}
