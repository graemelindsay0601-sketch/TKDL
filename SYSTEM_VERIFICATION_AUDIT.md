# CARD CLASH SYSTEM VERIFICATION AUDIT

**Status:** Starting comprehensive audit of all reward/coin systems
**Date:** 2026-06-28

---

## SYSTEM 1: LOGIN COINS & STREAKS

**Expected Behavior:**
- Daily login: +10 coins
- 7-day streak: +25 bonus coins  
- 30-day streak: +100 bonus coins
- Streak counter visible to player
- Persists across sessions

**Where to check:**
- [ ] Login endpoint
- [ ] Streak calculation logic
- [ ] Coin reward application
- [ ] UI showing current streak

---

## SYSTEM 2: WIN REWARDS

**Expected Behavior:**
- Win: +50 coins + 10×(cards equipped)
- Loss: +25 coins + 10×(cards equipped)
- Applied immediately after match
- Shows in UI/match summary

**Where to check:**
- [ ] Match completion endpoint
- [ ] Win/loss coin calculation
- [ ] Card count multiplier
- [ ] Match summary display

---

## SYSTEM 3: FREE PACKS EVERY 3 DAYS

**Expected Behavior:**
- One free pack claimable every 3 days
- Timer shows countdown
- Can't claim before ready
- Persists across sessions
- Shows in pack inventory

**Where to check:**
- [ ] Pack inventory storage
- [ ] Timer calculation (3 days = 72 hours)
- [ ] Claim endpoint
- [ ] UI pack display

---

## SYSTEM 4: END OF SEASON REWARDS

**Expected Behavior:**
- Season ends on schedule (monthly?)
- Rewards distributed based on ranking
- Standings reset
- Coins preserved
- Cards preserved
- Players keep season history

**Where to check:**
- [ ] Season schedule/timing
- [ ] Season ending trigger
- [ ] Reward calculation logic
- [ ] Reset logic (what resets, what doesn't)
- [ ] Season history storage

---

## SYSTEM 5: TIME-GATED CARD PURCHASES

**Expected Behavior:**
- Can buy specific card once per X hours
- Timer shows when available again
- Prevents spam purchases
- Per-card, per-player tracking

**Where to check:**
- [ ] Purchase endpoint
- [ ] Cooldown check logic
- [ ] Timer storage
- [ ] UI showing cooldown status

---

## AUDIT PLAN

1. Search codebase for each system
2. Trace logic from API to UI
3. Identify if implemented/incomplete/missing
4. Document findings
5. Create fix list

