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
  pledgedPence?: number;
  /** The best clip-worthy moment so far. */
  clip?: ClipKind;
  /** Your own darts on stream (all), and the darts and points that count toward a scoring average (x01 and the average challenge). */
  myDarts?: number; myScoredDarts?: number; myPoints?: number;
  /** A charity stream: what the night raised. */
  raisedPence?: number };

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
  THROUGH: ["THROUGH TO THE NEXT ROUND", "what a win 🏆", "the dream is alive", "on to the next one", "you can win this thing"],
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
  YOU_LOW: -0.05, IDLE: 0, DRILL_HIT: 0.45, DRILL_MISS: 0, DRILL_OUT: 0.2, DRILL_SCORE: 0.05, DRILL_BIG: 1, KING_DOWN: 0.8, THROUGH: 1 };

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
  return { events, tally: { ...tally, viewers, peak: Math.max(tally.peak, viewers), hype, followersGained: tally.followersGained + follows, followerCarry: carry - follows,
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
  campaignsPerSeason:1,
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
  { key: "CHARITY", name: "Charity stream", blurb: "Play a viewer for a good cause: every bit and super chat goes to charity. Generous crowds, and fans remember it. Once a month.", crowd: 1.1 },
] as const;
/** The formats on the picker, plus a collab (picked from the streamers list), the DartCast Invitational and a real match streamed from an event. */
export type StreamFormat = typeof FORMATS[number]["key"] | "COLLAB" | "INVITATIONAL" | "MATCH";
const COLLAB_FORMAT = { key: "COLLAB", name: "Collab", blurb: "A match against another streamer, on both channels.", crowd: 1 } as const;
const SPECIAL_FORMATS = {
  COLLAB: COLLAB_FORMAT,
  INVITATIONAL: { key: "INVITATIONAL", name: "DartCast Invitational", blurb: "The season's top streamers, knockout, first to 2 legs.", crowd: 2 },
  MATCH: { key: "MATCH", name: "Live from the event", blurb: "Your real match, streamed from the venue.", crowd: 1.3 },
} as const;
export const formatByKey = (key: string) => (SPECIAL_FORMATS as Record<string, typeof FORMATS[number] | typeof SPECIAL_FORMATS[keyof typeof SPECIAL_FORMATS]>)[key] ?? FORMATS.find(f => f.key === key) ?? FORMATS[0];
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

/**
 * Other DartCast streamers (made up): each with an audience that grows week by week and a level they throw at. A collab
 * is a match against one of them on both channels: their viewers tune in, and the winner takes a share of the other's
 * audience. They'll only collab with a channel somewhere near their size, and once a season each.
 */
export const STREAMERS = [
  { key: "doubletrouble", handle: "DoubleTroubleDan", followers: 120, avg: 48, blurb: "Pub player, all heart, can't find a double." },
  { key: "oche-sophie", handle: "OcheSophie", followers: 450, avg: 55, blurb: "County ladies' player, streams every Sunday." },
  { key: "tungsten-tom", handle: "TungstenTomTV", followers: 900, avg: 58, blurb: "Reviews every set of darts on the market." },
  { key: "bullbarry", handle: "BullseyeBarry", followers: 1600, avg: 52, blurb: "The comedian of darts streaming." },
  { key: "checkoutqueen", handle: "CheckoutQueen", followers: 3200, avg: 66, blurb: "Famous for her 'any finish in 9' challenges." },
  { key: "arrowsandale", handle: "ArrowsAndAle", followers: 5200, avg: 61, blurb: "Darts and craft beer, every Friday." },
  { key: "the-maximiser", handle: "TheMaximiser", followers: 9000, avg: 72, blurb: "Ex-pro, now the king of the 180 compilation." },
  { key: "dartsdaddy", handle: "DartsDaddyLive", followers: 15000, avg: 64, blurb: "Family-friendly darts with his three kids." },
  { key: "shanghai-sam", handle: "ShanghaiSam", followers: 26000, avg: 75, blurb: "Trick shots and big personality." },
  { key: "ninedartnick", handle: "NineDartNick", followers: 48000, avg: 82, blurb: "Hit a nine-darter live in 2019 and never looked back." },
  { key: "oche-official", handle: "TheOcheShow", followers: 90000, avg: 80, blurb: "The biggest darts channel on DartCast." },
] as const;
export type StreamerKey = typeof STREAMERS[number]["key"];
export const COLLAB = Object.freeze({ weeklyGrowth: 0.004, minShare: 0.2, maxShare: 5, minFollowers: 50,
  /** Share of their audience that tunes in, and the share of it that follows you if you win / lose. */
  tuneIn: 0.04, winShare: 0.02, loseShare: 0.005 });
/** A streamer's audience now (it grows a little every week of the career). */
export const streamerFollowers = (base: number, season: number, week: number) => Math.round(base * Math.pow(1 + COLLAB.weeklyGrowth, (season - 1) * 52 + week));
/** Will they collab with you? Near your size, you're an Affiliate or above, and not already this season. */
export function collabAnswer(theirs: number, yours: number, doneThisSeason: boolean): { ok: true } | { ok: false; why: string } {
  if (yours < COLLAB.minFollowers) return { ok: false, why: "Get to Affiliate first" };
  if (doneThisSeason) return { ok: false, why: "Already collabed this season" };
  if (theirs > yours * COLLAB.maxShare) return { ok: false, why: "Too big for you yet" };
  if (theirs < yours * COLLAB.minShare) return { ok: false, why: "Too small for your channel" };
  return { ok: true };
}
export const collabFollowers = (theirs: number, won: boolean) => Math.round(theirs * (won ? COLLAB.winShare : COLLAB.loseShare));
export const collabBot = (avg: number) => ({ avg, sd: 22, checkoutPct: Math.min(0.45, 0.12 + (avg - 30) * 0.008), hitAcc: Math.min(0.92, 0.45 + (avg - 30) * 0.012) });

/**
 * Clips: the best moment of each stream is clipped. At the end of the week a clip may go viral (a nine-darter almost
 * always does, a 180 rarely), bringing followers on DartCast and new fans for your darts.
 */
export const CLIPS = {
  NINE: { title: "NINE-DARTER LIVE ON STREAM", weight: 100, chance: 0.9, followers: 1500 },
  BIG_FISH: { title: "The Big Fish! 170 checkout", weight: 40, chance: 0.5, followers: 600 },
  BIG_FINISH: { title: "Ton-plus finish", weight: 15, chance: 0.15, followers: 200 },
  BOBS_BULL: { title: "Bull to finish Bob's 27", weight: 8, chance: 0.08, followers: 120 },
  MAX: { title: "Maximum!", weight: 5, chance: 0.04, followers: 80 },
} as const;
export type ClipKind = keyof typeof CLIPS;
/** Does this visit make a clip? (`dartsInLeg` counts your darts in the leg, for a nine-darter.) */
export function clipFor(v: { points: number; checkout: boolean; startScore: number; dartsInLeg?: number }): ClipKind | null {
  if (v.checkout && v.dartsInLeg !== undefined && v.dartsInLeg <= 9) return "NINE";
  if (v.checkout && v.startScore === 170) return "BIG_FISH";
  if (v.checkout && v.startScore >= 100) return "BIG_FINISH";
  if (v.points === 180) return "MAX";
  return null;
}
/** The clip's fate at the end of the week: viral or not, its views, and the followers and fans it brings. */
export function clipOutcome(seed: string, clipId: string, kind: ClipKind, peak: number, followers: number) {
  const rng = scopedRandom(seed, STREAM.version, "stream-clip", clipId);
  const c = CLIPS[kind], viral = rng() < Math.min(0.95, c.chance * (1 + Math.min(1, peak / 200)));
  const gained = viral ? Math.round(c.followers * (1 + followers / 2000) * (0.7 + rng() * 0.6)) : 0;
  const views = viral ? Math.round(gained * (25 + rng() * 40)) : Math.round(peak * (2 + rng() * 4));
  return { viral, views, followers: gained, fans: gained * 2 };
}

/**
 * The DartCast Invitational: once a season, from week 40, the top seven streamers and you (a Partner or above), knockout,
 * first to 2 legs. Real prize money for every round reached.
 */
export const INVITATIONAL = Object.freeze({ fromWeek: 40, toWeek: 50, field: 7,
  /** Prize by round reached: out in the quarter-finals, semi-finals, the final, or the winner. */
  prizePence: [25_000, 75_000, 150_000, 400_000] as const, rounds: ["Quarter-final", "Semi-final", "Final"] as const });
/** Your opponents round by round: the field's lowest seed first, the biggest streamer in the final. */
export function invitationalField(season: number, week: number) {
  return [...STREAMERS].map(st => ({ ...st, now: streamerFollowers(st.followers, season, week) })).sort((a, b) => b.now - a.now).slice(0, INVITATIONAL.field);
}
export const invitationalOpponent = (field: ReturnType<typeof invitationalField>, round: number) => field[[6, 3, 0][round] ?? 0];
export const invitationalPrize = (wins: number) => INVITATIONAL.prizePence[Math.min(3, wins)];

/** Charity streams: the night's cheers go to the cause, a bigger follower bonus, and fans who remember it. */
export const CHARITY = Object.freeze({ followerBonus: 1.5, penceForAFan: 50 });
export const charityFans = (raisedPence: number) => Math.floor(raisedPence / CHARITY.penceForAFan);

/** Streaming and your career: followers gained on DartCast bring fans for your darts (they fade like any fans). */
export const FOLLOWER_FANS = 0.3;
