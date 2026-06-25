# Card Clash Challenge System - Complete Build

## Overview
- **7 daily challenges** (1 per game mode): X01, Cricket, Practice, M-501, Tour, League, Card Clash
- **7 weekly challenges** (same structure, harder targets)
- **1 free reroll/day** per player, then coins cost (10 → 25 → 50 → 100)
- **Large challenge pool** (50+ variations) for variety
- **Flexible criteria** (e.g., "Win 2 X01" from any mode)
- **Reward scaling**: Daily = coins only, Weekly = coins + card packs

## Game Mode Mapping
- X01 (any mode: practice, tour, league, etc.)
- Cricket (any mode)
- Practice Mode
- M-501
- Tour Mode
- League Matches
- Card Clash

## Challenge Types (Requirement_Type)
- `x01_wins` - Win X01 games (any mode)
- `cricket_wins` - Win Cricket games (any mode)
- `practice_wins` - Win Practice mode
- `master501_wins` - Win M-501
- `tour_wins` - Complete Tour rounds
- `league_wins` - Win League matches
- `card_clash_wins` - Win Card Clash matches
- `total_games_played` - Play N games (any mode)
- `coins_earned` - Earn N coins from any source
- `cards_used` - Use N cards in matches
- `streak_wins` - Win N consecutive games
- `score_threshold` - Achieve N+ points in single game

## Tables Used
- `daily_challenges` - Challenge definitions
- `weekly_challenges` - Weekly challenge definitions
- `player_daily_challenges` - Player progress on daily challenges
- `player_weekly_challenges` - Player progress on weekly challenges
- `challenge_rerolls` - Track reroll usage and costs
- `player_currency` - Coins for reroll cost deduction

## Implementation Phases
1. Create challenge pool (database insert)
2. Build challenge assignment system (daily reset, weekly reset)
3. Build reroll system (free reroll, coin costs)
4. Build progress tracking (hook into game completion)
5. Build reward distribution (coins + cards)
6. Build reroll UI (admin panel buttons)

## Challenge Difficulty Levels
### Daily (Easy-Medium)
- 2 wins in a game mode
- 10-15 coins reward
- Time to complete: 30 min - 1 hour

### Weekly (Hard-Very Hard)
- 5-7 wins in a game mode
- 50-100 coins + 1-2 card packs
- Time to complete: 3-4 hours

## Next Steps
1. Build challenge pool generator
2. Build assignment logic
3. Build progress tracking hooks
4. Build reward system
5. Build reroll system
