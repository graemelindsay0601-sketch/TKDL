export type ChallengeCat  = 'league' | 'practice' | 'm501' | 'tour' | 'career';
export type ChallengeDiff = 'bronze'  | 'silver'   | 'gold' | 'platinum';

export interface ChallengeDef {
  key:            string;
  name:           string;
  description:    string;
  category:       ChallengeCat;
  icon:           string;
  gamerscore:     number;
  difficulty:     ChallengeDiff;
  criteriaType:   string;
  criteriaTarget: number; // -1 = dynamic (computed per player)
}

export const CHALLENGE_DEFS: ChallengeDef[] = [
  // ── LEAGUE ─────────────────────────────────────────────────────────────────
  { key:'FIRST_WIN',      name:'First Blood',    description:'Win your first league match',                          category:'league',   icon:'🩸', gamerscore:50,   difficulty:'bronze',   criteriaType:'career_wins',    criteriaTarget:1    },
  { key:'WIN_5',          name:'On the Board',   description:'Win 5 league matches',                                 category:'league',   icon:'🎯', gamerscore:100,  difficulty:'bronze',   criteriaType:'career_wins',    criteriaTarget:5    },
  { key:'WIN_10',         name:'Consistent',     description:'Win 10 league matches',                                category:'league',   icon:'⚔️', gamerscore:200,  difficulty:'silver',   criteriaType:'career_wins',    criteriaTarget:10   },
  { key:'WIN_25',         name:'Veteran',        description:'Win 25 league matches',                                category:'league',   icon:'🏆', gamerscore:400,  difficulty:'gold',     criteriaType:'career_wins',    criteriaTarget:25   },
  { key:'WIN_STREAK_3',   name:'Hat-Trick',      description:'Win 3 consecutive league matches',                     category:'league',   icon:'🔥', gamerscore:150,  difficulty:'bronze',   criteriaType:'win_streak',     criteriaTarget:3    },
  { key:'WIN_STREAK_5',   name:'On Fire',        description:'Win 5 consecutive league matches',                     category:'league',   icon:'💥', gamerscore:300,  difficulty:'silver',   criteriaType:'win_streak',     criteriaTarget:5    },
  { key:'WIN_STREAK_10',  name:'Unstoppable',    description:'Win 10 consecutive league matches',                    category:'league',   icon:'⚡', gamerscore:600,  difficulty:'platinum', criteriaType:'win_streak',     criteriaTarget:10   },
  { key:'BEAT_GOLD',      name:'Giant Killer',   description:'Beat a Gold-tier or higher player in a league match',  category:'league',   icon:'👑', gamerscore:200,  difficulty:'silver',   criteriaType:'beat_high_tier', criteriaTarget:1    },
  { key:'SEASON_TITLE',   name:'Champion',       description:'Win a season title',                                   category:'league',   icon:'🥇', gamerscore:1000, difficulty:'platinum', criteriaType:'season_title',   criteriaTarget:1    },
  { key:'PLAY_ALL',       name:'Well Rounded',   description:'Record a match against every active player',           category:'league',   icon:'🌐', gamerscore:300,  difficulty:'gold',     criteriaType:'play_all',       criteriaTarget:-1   },

  // ── PRACTICE ────────────────────────────────────────────────────────────────
  { key:'FIRST_SESSION',  name:'Getting Started',description:'Complete your first practice session',                 category:'practice', icon:'🏋️', gamerscore:50,   difficulty:'bronze',   criteriaType:'practice_sessions', criteriaTarget:1    },
  { key:'SESSIONS_10',    name:'Dedicated',      description:'Complete 10 practice sessions',                        category:'practice', icon:'🎯', gamerscore:100,  difficulty:'bronze',   criteriaType:'practice_sessions', criteriaTarget:10   },
  { key:'SESSIONS_50',    name:'Grinder',        description:'Complete 50 practice sessions',                        category:'practice', icon:'💪', gamerscore:250,  difficulty:'silver',   criteriaType:'practice_sessions', criteriaTarget:50   },
  { key:'SESSIONS_100',   name:'The Machine',    description:'Complete 100 practice sessions',                       category:'practice', icon:'🤖', gamerscore:500,  difficulty:'gold',     criteriaType:'practice_sessions', criteriaTarget:100  },
  { key:'DARTS_1000',     name:'Thousand Darts', description:'Throw 1,000 practice darts',                           category:'practice', icon:'🏹', gamerscore:150,  difficulty:'bronze',   criteriaType:'total_darts',       criteriaTarget:1000 },
  { key:'DARTS_5000',     name:'Five Thousand',  description:'Throw 5,000 practice darts',                           category:'practice', icon:'🎳', gamerscore:300,  difficulty:'silver',   criteriaType:'total_darts',       criteriaTarget:5000 },
  { key:'DARTS_10000',    name:'Ten Thousand',   description:'Throw 10,000 practice darts',                          category:'practice', icon:'🌟', gamerscore:600,  difficulty:'gold',     criteriaType:'total_darts',       criteriaTarget:10000},
  { key:'HIGH_AVG',       name:'Sharp Shooter',  description:'Score 60+ average in any X01 practice session',        category:'practice', icon:'📊', gamerscore:200,  difficulty:'silver',   criteriaType:'max_avg',           criteriaTarget:60   },

  // ── MASTER 501 ──────────────────────────────────────────────────────────────
  { key:'M501_FIRST',     name:'On the Clock',   description:'Complete your first Master-501 session',               category:'m501',     icon:'⏱️', gamerscore:50,   difficulty:'bronze',   criteriaType:'m501_runs',      criteriaTarget:1    },
  { key:'M501_TIER2',     name:'Stepping Up',    description:'Reach Tier 2 in Master-501',                           category:'m501',     icon:'📈', gamerscore:150,  difficulty:'bronze',   criteriaType:'m501_tier',      criteriaTarget:2    },
  { key:'M501_TIER4',     name:'Rising Star',    description:'Reach Tier 4 in Master-501',                           category:'m501',     icon:'⭐', gamerscore:300,  difficulty:'silver',   criteriaType:'m501_tier',      criteriaTarget:4    },
  { key:'M501_TIER6',     name:'Master of 501',  description:'Reach Tier 6 in Master-501',                           category:'m501',     icon:'👑', gamerscore:600,  difficulty:'gold',     criteriaType:'m501_tier',      criteriaTarget:6    },
  { key:'M501_180',       name:'Maximum!',       description:'Hit a 180 in any practice or Master-501 session',      category:'m501',     icon:'💯', gamerscore:300,  difficulty:'silver',   criteriaType:'max_180s',       criteriaTarget:1    },
  { key:'M501_PERFECT',   name:'Flawless',       description:'Complete a Master-501 tier round without a single loss',category:'m501',    icon:'🎪', gamerscore:400,  difficulty:'gold',     criteriaType:'m501_perfect',   criteriaTarget:1    },

  // ── TOUR ────────────────────────────────────────────────────────────────────
  { key:'TOUR_FIRST',     name:'Tour Debut',     description:'Start your first Tour run',                            category:'tour',     icon:'🚌', gamerscore:50,   difficulty:'bronze',   criteriaType:'tour_runs',      criteriaTarget:1    },
  { key:'TOUR_WIN',       name:'Trophy Hunter',  description:'Win your first Tour event',                            category:'tour',     icon:'🏆', gamerscore:200,  difficulty:'silver',   criteriaType:'tour_trophies',  criteriaTarget:1    },
  { key:'TOUR_3_TROPHIES',name:'Collector',      description:'Earn 3 Tour trophies',                                 category:'tour',     icon:'🗝️', gamerscore:300,  difficulty:'silver',   criteriaType:'tour_trophies',  criteriaTarget:3    },
  { key:'TOUR_10_TROPHIES',name:'Trophy Cabinet',description:'Earn 10 Tour trophies',                                category:'tour',     icon:'🏰', gamerscore:600,  difficulty:'gold',     criteriaType:'tour_trophies',  criteriaTarget:10   },
  { key:'TOUR_ELITE',     name:'Going Pro',      description:'Enter an Elite difficulty Tour event',                 category:'tour',     icon:'⚡', gamerscore:400,  difficulty:'platinum', criteriaType:'elite_tour',     criteriaTarget:1    },
  { key:'TOUR_PRO_WIN',   name:'The Pro',        description:'Win a Pro or Elite difficulty Tour event',             category:'tour',     icon:'💎', gamerscore:800,  difficulty:'platinum', criteriaType:'pro_tour_win',   criteriaTarget:1    },

  // ── CAREER ──────────────────────────────────────────────────────────────────
  { key:'ELO_SILVER',     name:'Silver Tier',    description:'Reach Silver tier (Elo 950+)',                         category:'career',   icon:'🥈', gamerscore:100,  difficulty:'bronze',   criteriaType:'peak_elo',       criteriaTarget:950  },
  { key:'ELO_GOLD',       name:'Gold Tier',      description:'Reach Gold tier (Elo 1100+)',                          category:'career',   icon:'🥇', gamerscore:200,  difficulty:'silver',   criteriaType:'peak_elo',       criteriaTarget:1100 },
  { key:'ELO_PLATINUM',   name:'Platinum Tier',  description:'Reach Platinum tier (Elo 1250+)',                      category:'career',   icon:'💎', gamerscore:350,  difficulty:'gold',     criteriaType:'peak_elo',       criteriaTarget:1250 },
  { key:'ELO_DIAMOND',    name:'Diamond Tier',   description:'Reach Diamond tier (Elo 1400+)',                       category:'career',   icon:'💠', gamerscore:600,  difficulty:'platinum', criteriaType:'peak_elo',       criteriaTarget:1400 },
  { key:'CAREER_50',      name:'Journeyman',     description:'Play 50 career league matches',                        category:'career',   icon:'🎲', gamerscore:200,  difficulty:'bronze',   criteriaType:'career_games',   criteriaTarget:50   },
  { key:'CAREER_100',     name:'Centurion',      description:'Play 100 career league matches',                       category:'career',   icon:'💯', gamerscore:400,  difficulty:'silver',   criteriaType:'career_games',   criteriaTarget:100  },
];
