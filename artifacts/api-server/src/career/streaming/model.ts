import { pick, scopedRandom } from "../world/random.ts";

/**
 * Streaming on DartCast (a fictional platform). You go live on a free night: a viewer from chat steps up and you play them,
 * first to a few legs of 501, and chat reacts to every visit, both yours and theirs. Viewers come from your followers and your
 * fan base; big moments (a 180, a ton-plus finish, beating the challenger) win followers; once you're an Affiliate viewers
 * can cheer with bits and super chats, and once you're a Partner they subscribe. Everything here is worked out from the
 * darts actually thrown (the server replays the log), never from the browser's say-so.
 */
export const STREAM = Object.freeze({
  version: 1,
  perWeek: 3,
  /** First to this many legs against the challenger. */
  legsToWin: 2,
  /** Followers needed for each step of the streamer route. */
  tiers: [
    { key: "NEWCOMER", name: "Newcomer", followers: 0, perks: "Go live and build an audience." },
    { key: "AFFILIATE", name: "Affiliate", followers: 50, perks: "Viewers can cheer with bits and send super chats." },
    { key: "PARTNER", name: "Partner", followers: 1000, perks: "Viewers can subscribe (£2.50 a month, half to you), and brands start to notice." },
    { key: "STAR", name: "Star", followers: 25000, perks: "A household name in darts streaming: the biggest audiences and the biggest tips." },
  ] as const,
  /** A pound of bits is 100 bits; DartCast keeps half of every subscription. */
  subPence: 250, subShare: 0.5,
});
export type TierKey = typeof STREAM.tiers[number]["key"];
export const tierFor = (followers: number) => [...STREAM.tiers].reverse().find(t => followers >= t.followers)!;
export const nextTier = (followers: number) => STREAM.tiers.find(t => t.followers > followers) ?? null;

/** Your starting audience: a share of the fans who already follow your darts. */
export const followersFromFans = (fans: number) => Math.floor(Math.max(0, fans) / 10);

/** Viewers when you go live: followers who tune in, fans who drop by, more at the weekend and after a break. */
export function openingViewers(seed: string, streamKey: string, followers: number, fans: number, dayOfWeek: number, daysSinceLast: number | null) {
  const rng = scopedRandom(seed, STREAM.version, "stream-open", streamKey);
  const weekend = dayOfWeek >= 5 ? 1.3 : 1;
  const fresh = daysSinceLast === null ? 1.2 : Math.min(1.25, 0.85 + daysSinceLast * 0.06);
  return Math.max(1, Math.round((2 + followers * 0.06 + Math.max(0, fans) * 0.005) * weekend * fresh * (0.85 + rng() * 0.3)));
}

/** A viewer who fancies their chances: their name and a level that grows with your channel. */
export function challengerFor(seed: string, streamKey: string, followers: number) {
  const rng = scopedRandom(seed, STREAM.version, "stream-challenger", streamKey);
  const base = 34 + Math.min(22, Math.log10(1 + followers) * 5);
  const avg = Math.round((base + (rng() - 0.5) * 16) * 10) / 10;
  return { name: handleFor(rng), avg, config: { avg, sd: 22, checkoutPct: Math.min(0.42, 0.12 + (avg - 30) * 0.008), hitAcc: Math.min(0.9, 0.45 + (avg - 30) * 0.012) } };
}

const ADJ = ["Oche", "Treble", "Double", "Bullseye", "Arrows", "Shanghai", "Madhouse", "Checkout", "Tungsten", "Flight", "Barrel", "Kebab", "Bed&Breakfast", "Ton", "Maximum"];
const NOUN = ["Tony", "Gremlin", "Dave", "Queen", "Wizard", "Legend", "Gaz", "Mo", "Bazza", "Shaz", "Kev", "Wolf", "Viking", "Hammer", "Sniper"];
export const handleFor = (rng: () => number) => `${pick(rng, ADJ)}${pick(rng, NOUN)}${Math.floor(rng() * 99)}`;

export type Visit = { thrower: 0 | 1; points: number; bust: boolean; checkout: boolean; startScore: number; legNo: number; dartsInLeg?: number };
export type ChatEvent =
  | { kind: "CHAT"; user: string; text: string }
  | { kind: "BITS"; user: string; pence: number; text: string }
  | { kind: "SUPERCHAT"; user: string; pence: number; text: string }
  | { kind: "SUB"; user: string; months: number }
  | { kind: "FOLLOW"; user: string };
export type Tally = { viewers: number; peak: number; hype: number; followersGained: number; followerCarry: number; bitsPence: number; superchatsPence: number; subs: number };

const LINES: Record<string, readonly string[]> = {
  YOU_180: ["ONE HUNDRED AND EIGHTYYYY", "180!!! 🎯🎯🎯", "MAXIMUM", "clip it!!", "he's on fire", "absolute scenes"],
  YOU_TON: ["ton plus 💪", "lovely darts", "big score", "that's the way", "keep that up"],
  YOU_LOW: ["oof", "wakey wakey", "bed and breakfast lol", "unlucky mate", "the board moved"],
  YOU_BUST: ["BUST 😬", "too greedy", "noooo", "maths is hard", "steady"],
  YOU_CHECKOUT: ["GAME SHOT", "what a finish", "cash register sound", "checkout king", "ice cold"],
  YOU_BIG_CHECKOUT: ["BIG FISH??", "WHAT A CHECKOUT", "SCENES 🐟", "clip that NOW", "unreal finish"],
  THEM_180: ["the challenger's got a 180!", "uh oh", "chat we might be in trouble", "they're good!"],
  THEM_CHECKOUT: ["leg to the challenger", "they took that out", "gg on that leg", "you'll get the next one"],
  WON: ["GG!! 🏆", "too good", "who's next?", "next challenger pls", "streamer diff"],
  LOST: ["the chat wins this one", "rematch!!", "gg wp challenger", "tough night", "we go again next stream"],
  IDLE: ["love the stream", "first time here", "what darts do you use?", "where are you from?", "hi from Ayr", "this is relaxing", "lurking 👀", "nice setup", "good luck tonight", "LETS GO"],
};

/**
 * Chat for one visit: the reaction, any cheers, follows and subs, and the viewer count after it. The same visit on the same
 * stream always gives the same chat. `tier` gates what viewers can do (bits and super chats from Affiliate, subs from Partner).
 */
export function chatForVisit(seed: string, streamKey: string, index: number, v: Visit, tally: Tally, tier: TierKey, matchOver: "WON" | "LOST" | null):
  { events: ChatEvent[]; tally: Tally } {
  const rng = scopedRandom(seed, STREAM.version, "stream-visit", streamKey, index);
  const you = v.thrower === 0;
  const moment = matchOver ?? (you
    ? v.checkout ? (v.startScore >= 100 ? "YOU_BIG_CHECKOUT" : "YOU_CHECKOUT") : v.bust ? "YOU_BUST" : v.points === 180 ? "YOU_180" : v.points >= 100 ? "YOU_TON" : v.points < 30 ? "YOU_LOW" : "IDLE"
    : v.points === 180 ? "THEM_180" : v.checkout ? "THEM_CHECKOUT" : "IDLE");
  const lift = { YOU_180: 1, YOU_BIG_CHECKOUT: 1.2, YOU_CHECKOUT: 0.5, YOU_TON: 0.25, WON: 1, THEM_180: 0.3, YOU_BUST: 0.1, LOST: 0.2, THEM_CHECKOUT: 0.1, YOU_LOW: -0.05, IDLE: 0 }[moment] ?? 0;
  const hype = Math.max(0, Math.min(3, tally.hype * 0.85 + lift));
  const events: ChatEvent[] = [];
  // The room's regulars: a crowd the size of the audience (a three-viewer stream is three or four names, not twenty).
  const crowd = Array.from({ length: Math.max(2, Math.min(40, Math.round(tally.peak * 1.5))) }, (_, i) => handleFor(scopedRandom(seed, STREAM.version, "stream-user", streamKey, i)));
  const someone = () => pick(rng, crowd);
  const say = (pool: string) => events.push({ kind: "CHAT", user: someone(), text: pick(rng, LINES[pool]) });
  const messages = Math.max(1, Math.min(6, Math.round(Math.sqrt(tally.viewers) / 2 * (0.6 + hype))));
  for (let i = 0; i < messages; i++) say(i === 0 || rng() < 0.6 ? moment : "IDLE");
  // Cheers: bits and super chats from Affiliate up, more likely on a big moment and in a bigger room.
  const room = Math.min(1, tally.viewers / 300);
  let bits = 0, supers = 0, subs = 0;
  if (tier !== "NEWCOMER") {
    if (rng() < Math.min(0.6, 0.04 + room * 0.25 + lift * 0.2)) {
      const pence = Math.round((1 + rng() * (2 + hype * 4) * (1 + room * 4))) * 100;
      bits += pence; events.push({ kind: "BITS", user: someone(), pence, text: pick(rng, ["for the 180s", "love the stream", "buy some new flights", "gg", "for the next ton"]) });
    }
    if (rng() < Math.min(0.25, 0.01 + room * 0.08 + lift * 0.08)) {
      const pence = Math.round(2 + rng() * (3 + hype * 6) * (1 + room * 3)) * 100;
      supers += pence; events.push({ kind: "SUPERCHAT", user: someone(), pence, text: pick(rng, ["What a player. Keep it up!", "Watching from the pub, cheers mate", "Get that tour card!", "Best darts stream going", "One more leg!"]) });
    }
  }
  if ((tier === "PARTNER" || tier === "STAR") && rng() < Math.min(0.3, 0.02 + room * 0.1 + lift * 0.06)) {
    subs++; events.push({ kind: "SUB", user: someone(), months: 1 + Math.floor(rng() * 6) });
  }
  // Follows: a share of the room on every visit, and a big moment wins one or two even in a tiny room; whole follows carry over.
  const carry = tally.followerCarry + tally.viewers * 0.01 + Math.max(0, lift) * (0.8 + tally.viewers * 0.04);
  const follows = Math.floor(carry);
  for (let i = 0; i < Math.min(follows, 3); i++) events.push({ kind: "FOLLOW", user: handleFor(rng) });
  const viewers = Math.max(1, Math.round(tally.viewers * (1 + (hype - 0.6) * 0.04) + (rng() - 0.45) * 2));
  return { events, tally: { viewers, peak: Math.max(tally.peak, viewers), hype, followersGained: tally.followersGained + follows, followerCarry: carry - follows,
    bitsPence: tally.bitsPence + bits, superchatsPence: tally.superchatsPence + supers, subs: tally.subs + subs } };
}

/** What the stream pays: bits and super chats in full, half of each new subscription's first month. */
export const streamIncome = (t: Pick<Tally, "bitsPence" | "superchatsPence" | "subs">) => t.bitsPence + t.superchatsPence + Math.round(t.subs * STREAM.subPence * STREAM.subShare);
