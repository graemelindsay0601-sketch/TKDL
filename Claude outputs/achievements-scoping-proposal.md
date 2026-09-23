# Achievements — scoping proposal

## What I found

I pulled the actual achievement counts per game mode from the codebase rather than guessing:

| Mode | Achievements today |
|---|---|
| Core (season play) | 116 |
| Shadow Bot | 185 |
| Tour | 173 |
| Master-501 | 127 |
| Practice | 69 |
| Card Clash | 18 |
| Board Curse | 0 |
| Boss Battle | 0 |
| Shift Wars | 0 |
| Doubles | 0 |

The picture is pretty clear: the four newest modes are fully playable but have **no achievements at all**, and Card Clash is thin next to everything else it sits alongside. Everything else is already well covered — I'm not proposing to touch core, Shadow Bot, Tour, Master-501, or Practice.

## Proposed new content

Grounded in what each mode actually tracks today, not invented from scratch:

**Board Curse** (tracks best visits, best streak, wins/losses per format via `board_curse_best` / `board_curse_records`)
- Streak-based: survive 5 / 10 / 20 turns without breaking your curse streak
- Efficiency: win a leg in your fewest-ever visits
- Format mastery: win 5 games in each Board Curse format
- Comeback: win after being cursed 3+ times in one leg

**Boss Battle** (tracks attempts/wins/best time per boss, ladder order, via `boss_battle_stats` / `boss_battle_progress`)
- Ladder completion: beat every boss on the ladder at least once
- Speed: beat any boss in under a target time (needs your input on what's a good time per boss)
- No-death run: beat 3 bosses in a row without a loss
- First-try: beat a boss on your very first attempt

**Shift Wars** (team-based, stake-tracked, via `shift_wars_matches`)
- Team win milestones: 5 / 15 / 30 team wins
- High-stakes team win
- Win streak as a team
- Beat the same rival team 3+ times

**Doubles** (partnership-based, Elo-tracked, via `doubles_matches`)
- Partnership win milestones
- Big Elo swing win as a pair
- Same-partner win streak (loyalty to one partner)
- Season doubles participation (play doubles across a full season)

**Card Clash top-up** (currently 18, thin next to its neighbors)
- Would need a look at what's already covered before proposing specifics here, so I'm flagging this as "needs a pass" rather than guessing content, especially since Card Clash is currently on hold per your earlier note — happy to skip this one entirely if you'd rather leave it alone.

## Questions before I build anything

1. **Scale** — Board Curse/Boss Battle/Shift Wars/Doubles are all zero today. Do you want each brought up to a similar depth as Practice (~70) and Master-501 (~127), or would a smaller starter set (10-20 each) be enough for now, with room to add more later?
2. **Reward balance** — the existing system pays out coins and occasionally card packs per achievement, scaled by rarity (Common/Rare/etc.). Should new achievements follow the same coin scale, or do these modes deserve their own tuning since they're newer/harder?
3. **Boss Battle timing thresholds** — I don't have a feel for what counts as a "fast" clear per boss. Would need either your gut-feel numbers or to pull the actual best-time data once there's a decent sample of real attempts.
4. **Card Clash** — top up now, or leave it alone entirely for the time being given it's on hold?
5. **Priority order** — if I'm doing one mode at a time rather than all four at once, which first?

Nothing here is built yet — this is just the proposal to react to.
