import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Persona data (mirrors bot-engine.ts on frontend) ─────────────────────────

export type TourPersona = {
  key: string;
  name: string;
  nickname: string;
  flag: string;
  tagline: string;
  level: "beginner" | "amateur" | "club" | "county" | "pro" | "elite";
  avg: number;
};

export const TOUR_PERSONAS: TourPersona[] = [
  { key: "luke_harbours",       name: "Luke Harbours",       nickname: "The World Beater",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "World No.1. Clinical. Composed. Unstoppable.",              level: "elite",    avg: 109 },
  { key: "luca_scrawler",       name: "Luca Scrawler",       nickname: "The Nuke",           flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Teenager. Already terrifying.",                            level: "elite",    avg: 107 },
  { key: "mikkel_van_garwin",   name: "Mikkel van Garwin",   nickname: "Green Machine",      flag: "🇳🇱",  tagline: "Three-time world champ. Still averaging 100+.",             level: "elite",    avg: 104 },
  { key: "bill_tailor",         name: "Bill Tailor",         nickname: "The Power",          flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "16 world titles. A darts god.",                             level: "elite",    avg: 101 },
  { key: "geert_van_veen",      name: "Geert van Veen",      nickname: "The Young Gun",      flag: "🇳🇱",  tagline: "Dutch teenager. Already bothering the top 8.",              level: "pro",      avg: 95  },
  { key: "nathan_aspley",       name: "Nathan Aspley",       nickname: "The Asp",            flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Lightning fast. Bites when cornered.",                      level: "pro",      avg: 93  },
  { key: "perry_wight",         name: "Perry Wight",         nickname: "Snakebite",          flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tagline: "The spikiest player in the game.",                          level: "pro",      avg: 92  },
  { key: "gareth_prise",        name: "Gareth Prise",        nickname: "The Iceman",         flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", tagline: "Ice in his veins, fire in his eyes.",                       level: "pro",      avg: 90  },
  { key: "josh_stone",          name: "Josh Stone",          nickname: "The Rock",           flag: "🇮🇪",  tagline: "Hard as rock. Harder to beat.",                              level: "pro",      avg: 89  },
  { key: "barry_anderson",      name: "Barry Anderson",      nickname: "Flying Scotsman",    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tagline: "Two world titles and a chip on his shoulder.",              level: "pro",      avg: 88  },
  { key: "steve_bunton",        name: "Steve Bunton",        nickname: "The Bullet",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Gritty, passionate, and very good.",                        level: "pro",      avg: 87  },
  { key: "danny_hera",          name: "Danny Hera",          nickname: "The Heat",           flag: "🇦🇺",  tagline: "Turning up the heat from down under.",                       level: "pro",      avg: 85  },
  { key: "ryan_searsley",       name: "Ryan Searsley",       nickname: "Heavy Metal",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Tour card holder. Reliable. Dangerous on a good day.",      level: "county",   avg: 83  },
  { key: "dmitri_van_den_berg", name: "Dmitri Van den Berg", nickname: "DreamMaker",        flag: "🇧🇪",  tagline: "Dreams big. Throws bigger.",                                 level: "county",   avg: 81  },
  { key: "ronny_clapton",       name: "Ronny Clapton",       nickname: "The Ferret",         flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", tagline: "Small, quick, deadly.",                                     level: "county",   avg: 79  },
  { key: "jono_de_souza",       name: "Jono de Souza",       nickname: "The Special One",    flag: "🇵🇹",  tagline: "He knows exactly what he's doing.",                          level: "county",   avg: 77  },
  { key: "bob_frost",           name: "Bob Frost",           nickname: "Voltage",            flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "World champion. Still dangerous.",                          level: "county",   avg: 75  },
  { key: "dave_chiselton",      name: "Dave Chiselton",      nickname: "Chizzy",             flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Consistent. Underestimated. Dangerous.",                    level: "club",     avg: 74  },
  { key: "james_blade",         name: "James Blade",         nickname: "The Machine",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Cold. Calculated. Reliable.",                               level: "club",     avg: 70  },
  { key: "simon_whitfield",     name: "Simon Whitfield",     nickname: "The Wizard",         flag: "🇦🇺",  tagline: "Makes darts look like magic. Sometimes.",                    level: "club",     avg: 67  },
  { key: "fallon_sherrick",     name: "Fallon Sherrick",     nickname: "Queen of the Oche",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "First woman to beat a pro at Worlds. Don't sleep on her.", level: "amateur",  avg: 62  },
  { key: "lisa_ashford",        name: "Lisa Ashford",        nickname: "Lancashire Lass",    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "All heart, all grit.",                                      level: "amateur",  avg: 55  },
  { key: "ned_bankley",         name: "Ned Bankley",         nickname: "The Count",          flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Two-time BDO champ. A different era.",                       level: "amateur",  avg: 49  },
  { key: "gary_blunt",          name: "Gary Blunt",          nickname: "The Builder",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Throws after a long shift. Still dangerous.",               level: "amateur",  avg: 58  },
  { key: "tracey_stubbs",       name: "Tracey Stubbs",       nickname: "Comeback Queen",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Loses the first leg. Wins the next three.",                 level: "amateur",  avg: 52  },
  { key: "paddy_obrien",        name: "Paddy O'Brien",       nickname: "The Shamrock",       flag: "🇮🇪",  tagline: "Dublin's finest amateur. Close enough.",                    level: "amateur",  avg: 46  },
  { key: "darren_webb",         name: "Darren Webb",         nickname: "The Steady Hand",    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Boring to watch. Impossible to beat.",                      level: "club",     avg: 73  },
  { key: "nicky_cole",          name: "Nicky Cole",          nickname: "The Maverick",       flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", tagline: "Unorthodox grip. Lethal finish.",                            level: "club",     avg: 68  },
  { key: "roberto_fuentes",     name: "Roberto Fuentes",     nickname: "El Maestro",         flag: "🇪🇸",  tagline: "Spanish regional champion. Three years running.",           level: "club",     avg: 65  },
  { key: "andy_hamish",         name: "Andy Hamish",         nickname: "The Hammer",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Hits the board. Mostly.",                                   level: "beginner", avg: 32  },
  { key: "terry_jenkins_jr",    name: "Terry Jenkins Jr",    nickname: "Trincomalee",        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Son of a journeyman. Still learning.",                       level: "beginner", avg: 28  },
  { key: "mick_barton",         name: "Mick Barton",         nickname: "The Punter",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", tagline: "Down the local every Friday night. It shows.",              level: "beginner", avg: 35  },
  { key: "wee_jimmy",           name: "Wee Jimmy Doyle",     nickname: "The Rookie",         flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tagline: "First season on the oche. Nerves of jelly.",                level: "beginner", avg: 24  },
];

const DIFFICULTY_LEVELS: Record<string, string[]> = {
  amateur: ["beginner", "amateur"],
  club:    ["amateur", "club"],
  county:  ["club", "county"],
  pro:     ["county", "pro"],
  elite:   ["pro", "elite"],
};

export function getPersonaPool(difficulty: string): TourPersona[] {
  const levels = DIFFICULTY_LEVELS[difficulty] ?? ["beginner", "amateur"];
  return TOUR_PERSONAS.filter(p => levels.includes(p.level));
}

export const TROPHY_GAMERSCORE: Record<string, number> = {
  amateur: 25,
  club:    50,
  county:  75,
  pro:     100,
  elite:   150,
};

// ── Tour definitions ─────────────────────────────────────────────────────────

type TourDef = {
  slug: string; name: string; tier: number; emoji: string; description: string;
  game_type_key: string; format: string; bracket_size: number;
  legs_per_match: number; sets_per_match: number | null; legs_per_set: number | null;
  unlock_type: string; unlock_value: string | null; sort_order: number;
};

const TOUR_DEFINITIONS: TourDef[] = [
  // ── TIER 1 — Pub & Local ──────────────────────────────────────────────────
  { slug: "friday_night_501",    name: "Friday Night 501",          tier: 1, emoji: "🍺", description: "The classic pub oche. Straight out, 3 legs, and bragging rights.",                     game_type_key: "501_straight_out",  format: "knockout", bracket_size: 8,  legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 1  },
  { slug: "pub_doubles_night",   name: "Pub Doubles Night",         tier: 1, emoji: "🎯", description: "Double out or go home. Standard pub rules, 3 legs.",                                   game_type_key: "501_double_out",    format: "knockout", bracket_size: 8,  legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 2  },
  { slug: "sunday_league",       name: "Sunday League",             tier: 1, emoji: "☀️", description: "301 double out — fast, fierce, and over quick.",                                       game_type_key: "301_double_out",    format: "knockout", bracket_size: 8,  legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 3  },
  { slug: "pub_cricket_night",   name: "Pub Cricket Night",         tier: 1, emoji: "🏏", description: "Close the numbers, own the bull. Classic pub cricket.",                                game_type_key: "cricket",           format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 4  },
  { slug: "count_up_challenge",  name: "Count Up Challenge",        tier: 1, emoji: "🔢", description: "Highest score after 20 darts wins. Simple as that.",                                   game_type_key: "count_up",          format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 5  },
  { slug: "halve_it_night",      name: "Halve It Night",            tier: 1, emoji: "✂️", description: "Miss your target and your score gets halved. Pure nerve.",                             game_type_key: "halve_it",          format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 6  },
  { slug: "killer_league",       name: "Killer League",             tier: 1, emoji: "💀", description: "Claim your number, defend it, eliminate everyone else.",                                game_type_key: "killer",            format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 7  },
  { slug: "football_darts_cup",  name: "Football Darts Cup",        tier: 1, emoji: "⚽", description: "Score goals, save shots. The most dramatic format on the oche.",                       game_type_key: "football_darts",    format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 8  },
  { slug: "golf_night_9",        name: "Golf Night (9 Holes)",      tier: 1, emoji: "⛳", description: "Lowest score wins. Like real golf, but at the oche.",                                   game_type_key: "golf_darts",        format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 9  },
  { slug: "sudden_death_friday", name: "Sudden Death Friday",       tier: 1, emoji: "💥", description: "One life. No second chances. Go out in style.",                                         game_type_key: "sudden_death",      format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 10 },
  { slug: "tactics_night",       name: "Tactics Night",             tier: 1, emoji: "🧠", description: "Mickey Mouse darts. Outsmart the opposition.",                                          game_type_key: "tactics",           format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 11 },
  { slug: "gotcha_cup",          name: "Gotcha! Cup",               tier: 1, emoji: "🎉", description: "Race to exactly 301. Hit it exact or you're sent back.",                               game_type_key: "gotcha",            format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "none", unlock_value: null, sort_order: 12 },

  // ── TIER 2 — County & Amateur Circuit ─────────────────────────────────────
  { slug: "county_501_open",      name: "County 501 Open",          tier: 2, emoji: "🏆", description: "Step up from the pub. 16-player draw, 5 legs per match.",                             game_type_key: "501_straight_out",  format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 13 },
  { slug: "county_championship",  name: "County Championship",      tier: 2, emoji: "🥇", description: "Double out is the only way out. County standard.",                                     game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 14 },
  { slug: "county_classic_dido",  name: "County Classic (DIDO)",    tier: 2, emoji: "🎯", description: "Double in, double out. The purist format.",                                            game_type_key: "501_double_in",     format: "knockout", bracket_size: 8,  legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 15 },
  { slug: "county_cricket_open",  name: "County Cricket Open",      tier: 2, emoji: "🏏", description: "Cricket at county level. More tactical, more pressure.",                               game_type_key: "cricket",           format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 16 },
  { slug: "cutthroat_championship", name: "Cut-Throat Championship", tier: 2, emoji: "🔪", description: "Hit open numbers and your score goes on the opponent. Chaos guaranteed.",            game_type_key: "cutthroat_cricket", format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 17 },
  { slug: "tactics_trophy",       name: "Tactics Trophy",           tier: 2, emoji: "🧠", description: "County-level Mickey Mouse. Bigger field, sharper minds.",                             game_type_key: "tactics",           format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 18 },
  { slug: "701_county_open",      name: "701 County Open",          tier: 2, emoji: "7️⃣", description: "Single long leg of 701 double out. Stamina and scoring power count.",                game_type_key: "701_double_out",    format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 19 },
  { slug: "301_county_sprint",    name: "301 County Sprint",        tier: 2, emoji: "⚡", description: "Fast, aggressive 301 best of 3. Blink and it's over.",                               game_type_key: "301_bo3",           format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 20 },
  { slug: "amateur_1001",         name: "Amateur 1001",             tier: 2, emoji: "🎳", description: "One massive leg of 1001 double out. Pure endurance.",                                  game_type_key: "1001_double_out",   format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 21 },
  { slug: "national_halve_it",    name: "National Halve It",        tier: 2, emoji: "✂️", description: "Miss and you pay. 16-player national format.",                                         game_type_key: "halve_it",          format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 22 },
  { slug: "shanghai_showdown",    name: "Shanghai Showdown",        tier: 2, emoji: "🥠", description: "Hit the treble, double, and single of each number. The classic finisher.",            game_type_key: "shanghai",          format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 23 },
  { slug: "bobs_27_open",         name: "Bob's 27 Open",            tier: 2, emoji: "🎱", description: "Start on 27, hit each double or lose that amount. A scoring masterclass.",            game_type_key: "bobs_27",           format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 24 },
  { slug: "scram_cup",            name: "Scram Cup",                tier: 2, emoji: "🚨", description: "Scorer and stopper alternate — one player can't score while the other is open.",      game_type_key: "scram",             format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 25 },
  { slug: "baseball_open",        name: "Baseball Open",            tier: 2, emoji: "⚾", description: "9 innings, score on each number 1-9. America meets the oche.",                        game_type_key: "baseball",          format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 26 },
  { slug: "fives_championship",   name: "Fives Championship",       tier: 2, emoji: "✋", description: "Only scores divisible by 5 count. Precision and pattern recognition.",                game_type_key: "fives",             format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "any_tier", unlock_value: "1", sort_order: 27 },

  // ── TIER 3 — Modus / Regional Circuit ─────────────────────────────────────
  { slug: "modus_ss_leg1",        name: "Modus Super Series Leg 1", tier: 3, emoji: "🔵", description: "The Modus circuit begins. Double out, 16-player draw, 5 legs.",                       game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 28 },
  { slug: "modus_ss_leg2",        name: "Modus Super Series Leg 2", tier: 3, emoji: "🔵", description: "Best of 5. Stamina counts at Modus level.",                                            game_type_key: "501_bo5",           format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 29 },
  { slug: "modus_ss_leg3",        name: "Modus Super Series Leg 3", tier: 3, emoji: "🔵", description: "Double in, double out. Classic Modus purist format.",                                  game_type_key: "501_double_in",     format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 30 },
  { slug: "modus_ss_finals",      name: "Modus Super Series Finals",tier: 3, emoji: "🏆", description: "The Modus season climax. Win this and Q-School beckons. Unlock: win any Modus Leg.", game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "any_of",     unlock_value: "modus_ss_leg1,modus_ss_leg2,modus_ss_leg3", sort_order: 31 },
  { slug: "modus_masters",        name: "Modus Masters",            tier: 3, emoji: "⭐", description: "Master out — only doubles and trebles count as checkouts. A real test.",              game_type_key: "501_master_out",    format: "knockout", bracket_size: 16, legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 32 },
  { slug: "bdo_classic",          name: "BDO Classic",              tier: 3, emoji: "🎖️", description: "The BDO's flagship event. Old school, no frills, straight out.",                      game_type_key: "501_straight_out",  format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 33 },
  { slug: "bdo_county_qualifier", name: "BDO County Qualifier",     tier: 3, emoji: "🎖️", description: "Win here, represent your county on the national stage.",                              game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 34 },
  { slug: "bdo_world_trophy",     name: "BDO World Trophy",         tier: 3, emoji: "🏆", description: "The old format returns. Best of 7 legs, pure 501 double out.",                       game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 7, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 35 },
  { slug: "treble_out_masters",   name: "Treble Out Masters",       tier: 3, emoji: "3️⃣", description: "You can only finish on a treble. More nerve-wracking than it sounds.",               game_type_key: "501_treble_out",    format: "knockout", bracket_size: 16, legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 36 },
  { slug: "challenge_tour_open",  name: "Challenge Tour Open",      tier: 3, emoji: "🎪", description: "PDC's feeder circuit. The bottom rung of the professional ladder.",                   game_type_key: "501_double_out",    format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 37 },
  { slug: "national_1001",        name: "National 1001 Championship",tier: 3, emoji: "🎳", description: "1001 double out. The marathon challenge at national level.",                          game_type_key: "1001_double_out",   format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 38 },
  { slug: "marathon_2001",        name: "2001 Marathon Open",       tier: 3, emoji: "🏃", description: "One leg of 2001 double out. This will take a while.",                                 game_type_key: "2001_double_out",   format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 39 },
  { slug: "national_cricket_champ", name: "National Cricket Championship", tier: 3, emoji: "🏏", description: "Cricket without the bull. Close 15-20 only. Surgical.",                       game_type_key: "cricket_no_bull",   format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 40 },
  { slug: "chase_dragon_open",    name: "Chase the Dragon Open",    tier: 3, emoji: "🐉", description: "Hit doubles 1 through 20 in order. Then the bull.",                                   game_type_key: "chase_the_dragon",  format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 41 },
  { slug: "three_in_bed_classic", name: "Three-in-a-Bed Classic",   tier: 3, emoji: "🛏️", description: "Three darts in the same segment scores a multiplier bonus. Precision rewarded.",      game_type_key: "three_in_a_bed",    format: "knockout", bracket_size: 8,  legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 42 },
  { slug: "golf_classic_18",      name: "Golf Classic (18 Holes)",  tier: 3, emoji: "⛳", description: "18 holes of darts golf. A full round on the oche.",                                   game_type_key: "golf_darts_18",     format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 43 },
  { slug: "jdc_invitational",     name: "JDC Invitational",         tier: 3, emoji: "🌟", description: "The Junior Darts Corporation format. Speed, skill, and ambition.",                    game_type_key: "jdc_challenge_41",  format: "knockout", bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 44 },
  { slug: "regional_pl",          name: "Regional Premier League",  tier: 3, emoji: "🏟️", description: "Round-robin, 10 players. Top 2 face off in the final. Real Premier League format.", game_type_key: "501_double_out",    format: "premier_league", bracket_size: 10, legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "tier_count", unlock_value: "2:3", sort_order: 45 },

  // ── TIER 4 — Q-School ─────────────────────────────────────────────────────
  { slug: "qschool_day1", name: "PDC Q-School Day 1", tier: 4, emoji: "🎓", description: "Your shot at a PDC Tour Card. Win today, change your career forever.",     game_type_key: "501_double_out", format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "specific_tour", unlock_value: "modus_ss_finals", sort_order: 46 },
  { slug: "qschool_day2", name: "PDC Q-School Day 2", tier: 4, emoji: "🎓", description: "Four days of Q-School. Win any one to earn your Tour Card.",               game_type_key: "501_double_out", format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "specific_tour", unlock_value: "modus_ss_finals", sort_order: 47 },
  { slug: "qschool_day3", name: "PDC Q-School Day 3", tier: 4, emoji: "🎓", description: "The pressure builds. One more chance tomorrow if today goes wrong.",        game_type_key: "501_double_out", format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "specific_tour", unlock_value: "modus_ss_finals", sort_order: 48 },
  { slug: "qschool_day4", name: "PDC Q-School Day 4", tier: 4, emoji: "🎓", description: "Final day. Last chance. No more tomorrows.",                                game_type_key: "501_double_out", format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "specific_tour", unlock_value: "modus_ss_finals", sort_order: 49 },

  // ── TIER 5 — PDC Tour ─────────────────────────────────────────────────────
  { slug: "players_championship",  name: "Players Championship",   tier: 5, emoji: "🃏", description: "The weekly grind of the PDC calendar. Pro standard, double out.",               game_type_key: "501_double_out",  format: "knockout",       bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 50 },
  { slug: "european_tour",         name: "European Tour",          tier: 5, emoji: "🇪🇺", description: "Tour across the continent. Hostile crowds, high pressure.",                      game_type_key: "501_double_out",  format: "knockout",       bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 51 },
  { slug: "uk_open",               name: "UK Open",                tier: 5, emoji: "🇬🇧", description: "The FA Cup of darts. Straight out, open draw, anyone can win.",                 game_type_key: "501_straight_out",format: "knockout",       bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 52 },
  { slug: "world_series_of_darts", name: "World Series of Darts", tier: 5, emoji: "🌍", description: "Around the world, 7-leg matches. The prestige of the international calendar.",   game_type_key: "501_double_out",  format: "knockout",       bracket_size: 16, legs_per_match: 7, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 53 },
  { slug: "grand_prix",            name: "Grand Prix",             tier: 5, emoji: "🏎️", description: "Double in, double out. The Grand Prix has its own unforgiving ruleset.",        game_type_key: "501_double_in",   format: "knockout",       bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 54 },
  { slug: "world_matchplay",       name: "World Matchplay",        tier: 5, emoji: "🌊", description: "501 straight out, best of 7 legs. The Blackpool magic.",                          game_type_key: "501_bo7",         format: "knockout",       bracket_size: 16, legs_per_match: 7, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 55 },
  { slug: "grand_slam",            name: "Grand Slam of Darts",    tier: 5, emoji: "⚡", description: "Master out — only doubles and trebles count. Group stage + knockout.",            game_type_key: "501_master_out",  format: "knockout",       bracket_size: 16, legs_per_match: 5, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 56 },
  { slug: "world_grand_prix",      name: "World Grand Prix",       tier: 5, emoji: "🎪", description: "Double in, double out — in sets. The most theatrical event on the circuit.",      game_type_key: "501_double_in",   format: "knockout",       bracket_size: 16, legs_per_match: 3, sets_per_match: 3,    legs_per_set: 3,  unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 57 },
  { slug: "pdc_premier_league",    name: "Premier League",         tier: 5, emoji: "🏟️", description: "10 of the world's best. Round-robin plus a two-way final. The real thing.",      game_type_key: "501_double_out",  format: "premier_league", bracket_size: 10, legs_per_match: 3, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 58 },
  { slug: "snooker_darts_masters", name: "Snooker Darts Masters",  tier: 5, emoji: "🎱", description: "Score like snooker — pot the balls in order. A cult classic format.",             game_type_key: "snooker_darts",   format: "knockout",       bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 59 },
  { slug: "noughts_crosses",       name: "Noughts & Crosses Open", tier: 5, emoji: "❌", description: "Get three in a row on the dartboard grid. Strategy meets precision.",              game_type_key: "noughts_crosses", format: "knockout",       bracket_size: 16, legs_per_match: 1, sets_per_match: null, legs_per_set: null, unlock_type: "achievement", unlock_value: "pdc_tour_card", sort_order: 60 },

  // ── TIER 6 — PDC Majors ───────────────────────────────────────────────────
  { slug: "pdc_world_championship", name: "PDC World Championship", tier: 6, emoji: "👑", description: "The pinnacle of darts. Best of 3 sets (5 legs each). The world is watching.", game_type_key: "501_double_out", format: "knockout", bracket_size: 16, legs_per_match: 5, sets_per_match: 3, legs_per_set: 5, unlock_type: "any_tier", unlock_value: "5", sort_order: 61 },
];

// ── Achievement definitions ───────────────────────────────────────────────────

type AchievDef = { key: string; name: string; description: string; gamerscore: number; category: string; icon: string };

export const TOUR_ACHIEVEMENT_DEFS: AchievDef[] = [
  // Career milestones
  { key: "first_blood",          name: "First Blood",             description: "Win your first tour at any difficulty.",                                          gamerscore: 50,   category: "career",        icon: "🩸" },
  { key: "county_bound",         name: "County Bound",            description: "Win any Tier 2 county circuit tour.",                                             gamerscore: 75,   category: "career",        icon: "🏅" },
  { key: "regional_player",      name: "Regional Player",         description: "Win any Tier 3 regional circuit tour.",                                           gamerscore: 100,  category: "career",        icon: "🌍" },
  { key: "tour_card_holder",     name: "Tour Card Holder",        description: "Earn the PDC Tour Card by winning any Q-School event.",                           gamerscore: 200,  category: "career",        icon: "🎓" },
  { key: "on_the_circuit",       name: "On the Circuit",          description: "Win any PDC Tour (Tier 5) event.",                                                gamerscore: 250,  category: "career",        icon: "⚡" },
  { key: "world_champion",       name: "World Champion",          description: "Win the PDC World Championship.",                                                  gamerscore: 500,  category: "career",        icon: "👑" },
  { key: "q_school_survivor",    name: "Q-School Survivor",       description: "Reach the final of any Q-School event.",                                          gamerscore: 100,  category: "career",        icon: "🎓" },
  { key: "modus_champion",       name: "Modus Champion",          description: "Win the Modus Super Series Finals.",                                               gamerscore: 100,  category: "career",        icon: "🔵" },
  { key: "modus_sweep",          name: "Modus Sweep",             description: "Win all 3 Modus Super Series Legs.",                                              gamerscore: 150,  category: "career",        icon: "🔵" },
  { key: "qschool_legend",       name: "Q-School Legend",         description: "Win all 4 Q-School days.",                                                        gamerscore: 300,  category: "career",        icon: "🎓" },

  // Format explorer
  { key: "cricket_ace",          name: "Cricket Ace",             description: "Win any Cricket format tour.",                                                    gamerscore: 75,   category: "format",        icon: "🏏" },
  { key: "cutthroat_tactician",  name: "Cut-Throat Tactician",    description: "Win the Cut-Throat Championship.",                                                gamerscore: 75,   category: "format",        icon: "🔪" },
  { key: "mickey_mouse_master",  name: "Mickey Mouse Master",     description: "Win any Tactics format tour.",                                                    gamerscore: 75,   category: "format",        icon: "🧠" },
  { key: "marathon_runner",      name: "Marathon Runner",         description: "Win any 1001 or 2001 format tour.",                                               gamerscore: 75,   category: "format",        icon: "🏃" },
  { key: "dido_devotee",         name: "DIDO Devotee",            description: "Win any Double In/Out tour.",                                                     gamerscore: 100,  category: "format",        icon: "🎯" },
  { key: "master_finish",        name: "Master Finish",           description: "Win any Master Out tour.",                                                        gamerscore: 100,  category: "format",        icon: "⭐" },
  { key: "treble_trouble",       name: "Treble Trouble",          description: "Win the Treble Out Masters.",                                                     gamerscore: 100,  category: "format",        icon: "3️⃣" },
  { key: "golf_pro",             name: "Golf Pro",                description: "Win any Golf Darts tour.",                                                        gamerscore: 75,   category: "format",        icon: "⛳" },
  { key: "three_in_bed_winner",  name: "Three in a Bed",          description: "Win the Three-in-a-Bed Classic.",                                                 gamerscore: 75,   category: "format",        icon: "🛏️" },
  { key: "dragon_slayer",        name: "Dragon Slayer",           description: "Win the Chase the Dragon Open.",                                                  gamerscore: 75,   category: "format",        icon: "🐉" },
  { key: "pub_legend",           name: "Pub Legend",              description: "Win 5 different Tier 1 pub events.",                                              gamerscore: 100,  category: "format",        icon: "🍺" },
  { key: "format_explorer",      name: "Format Explorer",         description: "Win tours in 8 different game format categories.",                                gamerscore: 300,  category: "format",        icon: "🗺️" },
  { key: "sets_format_winner",   name: "Sets Format Winner",      description: "Win any sets-format tour (World Grand Prix or World Championship).",              gamerscore: 150,  category: "format",        icon: "📺" },

  // Difficulty climber
  { key: "amateur_graduate",     name: "Amateur Graduate",        description: "Win any tour at Amateur difficulty.",                                             gamerscore: 25,   category: "difficulty",    icon: "🟢" },
  { key: "club_standard",        name: "Club Standard",           description: "Win any tour at Club difficulty.",                                                gamerscore: 50,   category: "difficulty",    icon: "🔵" },
  { key: "county_class",         name: "County Class",            description: "Win any tour at County difficulty.",                                              gamerscore: 100,  category: "difficulty",    icon: "🟣" },
  { key: "pro_standard",         name: "Pro Standard",            description: "Win any tour at Pro difficulty.",                                                 gamerscore: 200,  category: "difficulty",    icon: "🟡" },
  { key: "elite_status",         name: "Elite Status",            description: "Win any tour at Elite difficulty.",                                               gamerscore: 300,  category: "difficulty",    icon: "🔴" },
  { key: "difficulty_king",      name: "Difficulty King",         description: "Win the same tour at all 5 difficulty levels.",                                  gamerscore: 400,  category: "difficulty",    icon: "👑" },
  { key: "elite_world_champ",    name: "Untouchable",             description: "Win the PDC World Championship at Elite difficulty.",                             gamerscore: 1000, category: "difficulty",    icon: "💎" },

  // Specific tour wins
  { key: "grand_prix_winner",    name: "Grand Prix Winner",       description: "Win the Grand Prix.",                                                             gamerscore: 150,  category: "specific",      icon: "🏎️" },
  { key: "matchplay_winner",     name: "Matchplay Winner",        description: "Win the World Matchplay.",                                                        gamerscore: 150,  category: "specific",      icon: "🌊" },
  { key: "uk_open_winner",       name: "UK Open Winner",          description: "Win the UK Open.",                                                                gamerscore: 150,  category: "specific",      icon: "🇬🇧" },
  { key: "grand_slam_winner",    name: "Grand Slam Winner",       description: "Win the Grand Slam of Darts.",                                                   gamerscore: 200,  category: "specific",      icon: "⚡" },
  { key: "world_grand_prix_winner", name: "World Grand Prix Winner", description: "Win the World Grand Prix.",                                                   gamerscore: 200,  category: "specific",      icon: "🎪" },
  { key: "premier_league_winner",name: "Premier League Winner",   description: "Win the Premier League.",                                                         gamerscore: 250,  category: "specific",      icon: "🏟️" },
  { key: "world_series_winner",  name: "World Series Winner",     description: "Win the World Series of Darts.",                                                 gamerscore: 200,  category: "specific",      icon: "🌍" },

  // Completionist
  { key: "tier1_sweep",          name: "Pub Legend Supreme",      description: "Win all 12 Tier 1 pub events.",                                                  gamerscore: 200,  category: "completionist", icon: "🍺" },
  { key: "tier2_sweep",          name: "County Conqueror",        description: "Win all 15 Tier 2 county events.",                                               gamerscore: 300,  category: "completionist", icon: "🏆" },
  { key: "all_rounder",          name: "All-Rounder",             description: "Win tours in 5 different game format categories.",                               gamerscore: 200,  category: "completionist", icon: "🎯" },
];

// ── Per-tour per-difficulty trophy achievements (305 total) ───────────────────

const DIFFICULTIES = ["amateur", "club", "county", "pro", "elite"] as const;
type Difficulty = typeof DIFFICULTIES[number];

const TROPHY_ACH_GS: Record<number, Record<Difficulty, number>> = {
  1: { amateur: 15,  club: 20,  county: 30,  pro: 50,  elite: 75  },
  2: { amateur: 20,  club: 30,  county: 45,  pro: 75,  elite: 100 },
  3: { amateur: 30,  club: 45,  county: 60,  pro: 100, elite: 150 },
  4: { amateur: 40,  club: 60,  county: 80,  pro: 125, elite: 175 },
  5: { amateur: 50,  club: 75,  county: 100, pro: 150, elite: 200 },
  6: { amateur: 75,  club: 100, county: 125, pro: 175, elite: 250 },
  7: { amateur: 100, club: 150, county: 175, pro: 200, elite: 300 },
};

const DIFF_LABEL: Record<Difficulty, string> = {
  amateur: "Amateur", club: "Club", county: "County", pro: "Pro", elite: "Elite",
};

function generateTrophyAchievements(): AchievDef[] {
  const result: AchievDef[] = [];
  for (const t of TOUR_DEFINITIONS) {
    const gsRow = TROPHY_ACH_GS[t.tier] ?? TROPHY_ACH_GS[6];
    for (const diff of DIFFICULTIES) {
      result.push({
        key:         `tour_win_${t.slug}_${diff}`,
        name:        `${t.name} – ${DIFF_LABEL[diff]}`,
        description: `Win the ${t.name} at ${DIFF_LABEL[diff]} difficulty.`,
        gamerscore:  gsRow[diff],
        category:    "trophy",
        icon:        t.emoji,
      });
    }
  }
  return result;
}

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedTourSystem() {
  // Tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tour_definitions (
      id             SERIAL PRIMARY KEY,
      slug           TEXT UNIQUE NOT NULL,
      name           TEXT NOT NULL,
      tier           INTEGER NOT NULL,
      emoji          TEXT NOT NULL DEFAULT '🎯',
      description    TEXT NOT NULL DEFAULT '',
      game_type_key  TEXT NOT NULL,
      format         TEXT NOT NULL DEFAULT 'knockout',
      bracket_size   INTEGER NOT NULL DEFAULT 8,
      legs_per_match INTEGER NOT NULL DEFAULT 3,
      sets_per_match INTEGER,
      legs_per_set   INTEGER,
      unlock_type    TEXT NOT NULL DEFAULT 'none',
      unlock_value   TEXT,
      sort_order     INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS player_tour_runs (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL,
      tour_id     INTEGER NOT NULL REFERENCES tour_definitions(id),
      difficulty  TEXT NOT NULL,
      bracket     JSONB NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active',
      started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ptr_player_id ON player_tour_runs(player_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tour_trophies (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL,
      tour_id     INTEGER NOT NULL REFERENCES tour_definitions(id),
      difficulty  TEXT NOT NULL,
      gamerscore  INTEGER NOT NULL DEFAULT 0,
      awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(player_id, tour_id, difficulty)
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tt_player_id ON tour_trophies(player_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tour_achievement_definitions (
      id          SERIAL PRIMARY KEY,
      key         TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      gamerscore  INTEGER NOT NULL DEFAULT 0,
      category    TEXT NOT NULL DEFAULT 'career',
      icon        TEXT NOT NULL DEFAULT '🏆'
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS player_tour_achievements (
      id              SERIAL PRIMARY KEY,
      player_id       INTEGER NOT NULL,
      achievement_key TEXT NOT NULL,
      awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(player_id, achievement_key)
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_pta_player_id ON player_tour_achievements(player_id)
  `);

  // Seed tour definitions (idempotent)
  for (const t of TOUR_DEFINITIONS) {
    await db.execute(sql`
      INSERT INTO tour_definitions (slug, name, tier, emoji, description, game_type_key, format, bracket_size, legs_per_match, sets_per_match, legs_per_set, unlock_type, unlock_value, sort_order)
      VALUES (${t.slug}, ${t.name}, ${t.tier}, ${t.emoji}, ${t.description}, ${t.game_type_key}, ${t.format}, ${t.bracket_size}, ${t.legs_per_match}, ${t.sets_per_match ?? null}, ${t.legs_per_set ?? null}, ${t.unlock_type}, ${t.unlock_value ?? null}, ${t.sort_order})
      ON CONFLICT (slug) DO UPDATE SET
        name           = EXCLUDED.name,
        tier           = EXCLUDED.tier,
        emoji          = EXCLUDED.emoji,
        description    = EXCLUDED.description,
        game_type_key  = EXCLUDED.game_type_key,
        format         = EXCLUDED.format,
        bracket_size   = EXCLUDED.bracket_size,
        legs_per_match = EXCLUDED.legs_per_match,
        sets_per_match = EXCLUDED.sets_per_match,
        legs_per_set   = EXCLUDED.legs_per_set,
        unlock_type    = EXCLUDED.unlock_type,
        unlock_value   = EXCLUDED.unlock_value,
        sort_order     = EXCLUDED.sort_order
    `);
  }

  // Seed achievement definitions (idempotent)
  const allAchievements = [...TOUR_ACHIEVEMENT_DEFS, ...generateTrophyAchievements()];
  for (const a of allAchievements) {
    await db.execute(sql`
      INSERT INTO tour_achievement_definitions (key, name, description, gamerscore, category, icon)
      VALUES (${a.key}, ${a.name}, ${a.description}, ${a.gamerscore}, ${a.category}, ${a.icon})
      ON CONFLICT (key) DO UPDATE SET
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        gamerscore  = EXCLUDED.gamerscore,
        category    = EXCLUDED.category,
        icon        = EXCLUDED.icon
    `);
  }

  logger.info("Tour system tables and seed data ready");
}
