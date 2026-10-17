import { pick, scopedRandom } from "../world/random.ts";
import { NOT_FOR_SALE } from "../manager/model.ts";

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
  | { kind: "FOLLOW"; user: string }
  /** The scoring challenge: bits pledged that pay only if you beat the target average. */
  | { kind: "PLEDGE"; user: string; pence: number; text: string };
export type Tally = { viewers: number; peak: number; hype: number; followersGained: number; followerCarry: number; bitsPence: number; superchatsPence: number; subs: number;
  /** Scoring challenge pledges (paid only on a win). */
  pledgedPence?: number };

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
  DRILL_HIT: ["got it!", "lovely double", "ice cold", "that's the one", "keep going", "D-D-DOUBLE"],
  DRILL_MISS: ["so close", "next one", "unlucky", "the wire!!", "shake it off"],
  DRILL_OUT: ["OUT 😭", "noooo", "run it back", "the doubles betrayed us", "next stream we go again"],
  DRILL_SCORE: ["nice scoring", "steady", "keep the average up", "lovely rhythm", "that'll do"],
  DRILL_BIG: ["MAXIMUM", "180!!", "that's the average sorted", "huge", "clip it"],
  KING_DOWN: ["another one bites the dust 👑", "NEXT!", "who's brave enough?", "the King stays the King", "line's open, who's next"],
  PLEDGE: ["pledged, don't let me down", "you've got this", "beat that average!", "my bits are on you"],
  IDLE: ["love the stream", "first time here", "what darts do you use?", "where are you from?", "hi from Ayr", "this is relaxing", "lurking 👀", "nice setup", "good luck tonight", "LETS GO"],
};

/**
 * Chat for one visit: the reaction, any cheers, follows and subs, and the viewer count after it. The same visit on the same
 * stream always gives the same chat. `tier` gates what viewers can do (bits and super chats from Affiliate, subs from Partner).
 */
export function chatForVisit(seed: string, streamKey: string, index: number, v: Visit, tally: Tally, tier: TierKey, matchOver: "WON" | "LOST" | null):
  { events: ChatEvent[]; tally: Tally } {
  const you = v.thrower === 0;
  const moment = matchOver ?? (you
    ? v.checkout ? (v.startScore >= 100 ? "YOU_BIG_CHECKOUT" : "YOU_CHECKOUT") : v.bust ? "YOU_BUST" : v.points === 180 ? "YOU_180" : v.points >= 100 ? "YOU_TON" : v.points < 30 ? "YOU_LOW" : "IDLE"
    : v.points === 180 ? "THEM_180" : v.checkout ? "THEM_CHECKOUT" : "IDLE");
  return chatForMoment(seed, streamKey, index, moment, tally, tier);
}

const LIFT: Record<string, number> = { YOU_180: 1, YOU_BIG_CHECKOUT: 1.2, YOU_CHECKOUT: 0.5, YOU_TON: 0.25, WON: 1, THEM_180: 0.3, YOU_BUST: 0.1, LOST: 0.2, THEM_CHECKOUT: 0.1,
  YOU_LOW: -0.05, IDLE: 0, DRILL_HIT: 0.45, DRILL_MISS: 0, DRILL_OUT: 0.2, DRILL_SCORE: 0.05, DRILL_BIG: 1, KING_DOWN: 0.8 };

/** Chat for one visit of a drill format (Bob's 27, checkouts, scoring). On the scoring challenge, bits come in as pledges. */
export function chatForDrillVisit(seed: string, streamKey: string, index: number, v: { note: string; points: number; startScore?: number }, tally: Tally, tier: TierKey,
  over: "WON" | "LOST" | null, pledges = false) {
  const moment = over ?? (v.note === "HIT" ? "DRILL_HIT" : v.note === "CHECKOUT" ? ((v.startScore ?? 0) >= 100 ? "YOU_BIG_CHECKOUT" : "DRILL_HIT") : v.note === "OUT" ? "DRILL_OUT"
    : v.note === "MISS" || v.note === "BUST" || v.note === "FAILED" ? "DRILL_MISS" : v.points === 180 ? "DRILL_BIG" : v.points >= 100 ? "YOU_TON" : v.points < 30 ? "YOU_LOW" : "DRILL_SCORE");
  return chatForMoment(seed, streamKey, index, moment, tally, tier, pledges);
}

/** The heart of the chat: a moment's reaction, cheers, follows and subs, and the viewer count after it. */
export function chatForMoment(seed: string, streamKey: string, index: number, moment: string, tally: Tally, tier: TierKey, pledges = false):
  { events: ChatEvent[]; tally: Tally } {
  const rng = scopedRandom(seed, STREAM.version, "stream-visit", streamKey, index);
  const lift = LIFT[moment] ?? 0;
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
  let bits = 0, supers = 0, subs = 0, pledged = 0;
  if (tier !== "NEWCOMER") {
    if (rng() < Math.min(0.6, 0.04 + room * 0.25 + lift * 0.2)) {
      const pence = Math.round((1 + rng() * (2 + hype * 4) * (1 + room * 4))) * 100;
      if (pledges) { pledged += pence; events.push({ kind: "PLEDGE", user: someone(), pence, text: pick(rng, LINES.PLEDGE) }); }
      else { bits += pence; events.push({ kind: "BITS", user: someone(), pence, text: pick(rng, ["for the 180s", "love the stream", "buy some new flights", "gg", "for the next ton"]) }); }
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
    bitsPence: tally.bitsPence + bits, superchatsPence: tally.superchatsPence + supers, subs: tally.subs + subs,
    ...(pledges || tally.pledgedPence ? { pledgedPence: (tally.pledgedPence ?? 0) + pledged } : {}) } };
}

/** What the stream pays: bits and super chats in full, half of each new subscription's first month. */
export const streamIncome = (t: Pick<Tally, "bitsPence" | "superchatsPence" | "subs">) => t.bitsPence + t.superchatsPence + Math.round(t.subs * STREAM.subPence * STREAM.subShare);

/**
 * Phase 2 of the streamer route. Subscribers renew every four weeks (half of each £2.50 to you) and some drift away each
 * month, more when you haven't streamed; Partners get brand deals (a fee for every stream, for a run of streams); Stars get
 * invitations to the televised invitationals on the strength of their audience.
 */
export const STREAM_MONEY = Object.freeze({
  /** Subs renew at the end of every fourth week. */
  monthWeeks: 4,
  /** Share of subscribers who renew: you streamed that month / you didn't. */
  renewal: { streamed: 0.85, quiet: 0.6 },
  /** Brand deals: from Partner up, at most this many a season, each for a run of streams. */
  dealsPerSeason: 2, dealStreams: 6, dealOfferWeeks: 3,
  /** Fee per stream: a floor plus so much per follower, to the pound. */
  dealFloorPence: 2500, dealPencePerFollower: 3,
});

export const BRANDS = [
  { key: "flightdeck", name: "FlightDeck", what: "flights and stems" },
  { key: "oche-energy", name: "Oche Energy", what: "an energy drink" },
  { key: "tungsten-toms", name: "Tungsten Tom's", what: "darts and barrels" },
  { key: "gripline", name: "GripLine", what: "finger wax and grips" },
  { key: "boardroom-gaming", name: "Boardroom Gaming", what: "a gaming chair maker" },
  { key: "double-top-kebabs", name: "Double Top Kebabs", what: "a late-night takeaway chain" },
] as const;

/** Whole subscriptions that renew this month (deterministic: floor of the renewal share). */
export const renewals = (subscribers: number, streamed: boolean) =>
  Math.floor(Math.max(0, subscribers) * (streamed ? STREAM_MONEY.renewal.streamed : STREAM_MONEY.renewal.quiet));
/** What a month's renewals pay you. */
export const subPayout = (renewed: number) => Math.round(renewed * STREAM.subPence * STREAM.subShare);
/** A brand's fee for each stream, to the pound. */
export const dealFee = (followers: number) => Math.round((STREAM_MONEY.dealFloorPence + Math.max(0, followers) * STREAM_MONEY.dealPencePerFollower) / 100) * 100;
/** Which brand comes calling (the n-th deal of the season, picked from the seed). */
export function brandFor(seed: string, season: number, n: number) {
  const rng = scopedRandom(seed, STREAM.version, "stream-brand", season, n);
  return BRANDS[Math.floor(rng() * BRANDS.length)];
}
/** Stars get invitations to televised invitationals; nobody streams their way into a national team. */
export const streamerCanBeInvited = (tier: TierKey | null, event: { circuit: string; definitionKey: string; takesInvitations: boolean }) =>
  tier === "STAR" && event.takesInvitations && event.circuit === "INVITATIONAL" && !NOT_FOR_SALE.has(event.definitionKey);

/**
 * Stream formats. Each draws its own crowd: King of the Oche (viewer after viewer until one beats you) pulls the most, the
 * solo drills a little less. Playing the same format stream after stream wears thin; playing what chat voted for brings
 * them back.
 */
export const FORMATS = [
  { key: "CHALLENGER", name: "Play a viewer", blurb: "A viewer steps up: first to 2 legs of 501.", crowd: 1 },
  { key: "KING", name: "King of the Oche", blurb: "One leg of 501 against viewer after viewer, up to 5. One loss and you're dethroned.", crowd: 1.25 },
  { key: "CHECKOUTS", name: "Checkout Challenge", blurb: "Chat picks 5 finishes: three visits at each. Hit 3 to win.", crowd: 0.9 },
  { key: "BOBS_27", name: "Bob's 27 live", blurb: "Every double from 1 to the bull, starting on 27. Don't drop to zero.", crowd: 0.8 },
  { key: "SCORING", name: "Average challenge", blurb: "33 visits of pure scoring against a target average. Chat pledges bits that pay only if you beat it.", crowd: 0.9 },
] as const;
export type StreamFormat = typeof FORMATS[number]["key"];
export const formatByKey = (key: string) => FORMATS.find(f => f.key === key) ?? FORMATS[0];
export const KING_ROUNDS = 5;
/** Same format as last time: the room thins. Chat's pick: they turn up. */
export const VARIETY = Object.freeze({ repeat: 0.85, pollPick: 1.2 });
export const crowdFor = (format: StreamFormat, lastFormat: string | null, pollPick: string | null) =>
  formatByKey(format).crowd * (lastFormat === format ? VARIETY.repeat : 1) * (pollPick === format ? VARIETY.pollPick : 1);

const FINISHES = [61, 64, 68, 72, 76, 81, 84, 88, 91, 96, 100, 104, 107, 110, 116, 121, 124, 130, 136, 141, 150, 161, 164, 167, 170];
/** The five finishes chat picks for a checkout challenge: mostly gettable, the odd big one. */
export function checkoutTargets(seed: string, streamKey: string) {
  const rng = scopedRandom(seed, STREAM.version, "stream-checkouts", streamKey);
  const pool = [...FINISHES], out: number[] = [];
  while (out.length < 5) out.push(pool.splice(Math.floor(Math.pow(rng(), 1.4) * pool.length), 1)[0]);
  return out;
}
/** The target average for the scoring challenge: a bit above your last one (or 45 the first time), to the half point. */
export const scoringTarget = (lastAverage: number | null) => Math.round(((lastAverage ?? 43) + 2) * 2) / 2;

/** End-of-stream poll: chat votes on what you play next time (the format played tonight rarely wins). */
export function pollFor(seed: string, streamKey: string, played: StreamFormat) {
  const rng = scopedRandom(seed, STREAM.version, "stream-poll", streamKey);
  const votes = FORMATS.map(f => ({ key: f.key as StreamFormat, name: f.name, votes: Math.round((f.key === played ? 4 : 10 + rng() * 30) * f.crowd) }));
  const total = votes.reduce((n, v) => n + v.votes, 0);
  const winner = [...votes].sort((a, b) => b.votes - a.votes)[0];
  return { options: votes.map(v => ({ ...v, share: Math.round(v.votes / total * 100) })), winner: winner.key };
}

/** Monthly sub goals (Partner up): hit the target in a month and you keep the promise; the buzz wins followers. */
export const SUB_GOAL = Object.freeze({ targets: [5, 10, 20, 50], followerBonusPerSub: 4,
  promises: ["A Bob's 27 stream", "Throw in fancy dress", "A charity night", "Answer every question in chat", "Play left-handed for a leg"] as const });
export const goalBonus = (target: number) => target * SUB_GOAL.followerBonusPerSub;
