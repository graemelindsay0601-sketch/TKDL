# TKDL Card Clash - Project Summary

**Last Updated:** June 22, 2026  
**Project Status:** Phase 2 - Core Systems Built, Integration Pending  
**GitHub Branch:** main (commits 582da60 onwards)

---

## 🎯 WHAT IS CARD CLASH?

Card Clash is a **separate game mode** running parallel to the normal TKDL league. Players collect cards (like a gacha system) and equip them before matches to gain strategic advantages (GOOD cards) or sabotage opponents (BAD cards).

**Key Concept:** Cards modify scoring/mechanics during actual X01 and Cricket matches, making the game more strategic and rewarding card collection.

---

## 📊 PROJECT OVERVIEW

### Core Stats
- **100 Total Cards** organized into:
  - X01 Mode: 20 GOOD + 20 BAD (40 total)
  - Cricket Mode: 20 GOOD + 20 BAD (40 total)
  - Wildcards: 10 GOOD + 10 BAD (20 total) - work across both modes

- **Rarity Distribution:** 75% Common, 20% Rare, 5% Legendary
- **Pity System:** After 50 pulls without Legendary → 51st guaranteed Legendary
- **Season Structure:** Monthly (same dates as league: 1st-last of month)
- **Currency:** Card Points (separate from League Points)
- **Card Wager:** Win +50 points, Loss +10 points

---

## 🏗️ CURRENT BUILD STATUS

### ✅ COMPLETED - PHASE 2 PART 1 (Backend)

#### Database Schema (7 new tables)
```sql
card_definitions          - All 100 cards (name, effect, rarity, game_mode, image_url)
player_card_inventory     - Player card ownership (player_id, card_id, quantity)
player_currency           - Coin tracking (coin_balance, lifetime_coins_earned)
card_clash_seasons        - Monthly seasons (name, start_date, end_date, is_locked)
card_clash_standings      - Leaderboard (season_id, player_id, card_points, wins, losses)
card_clash_matches        - Match records (game_mode, cards_equipped, cards_used, points_earned)
card_pity_system          - Guaranteed pulls (pulls_since_legendary, last_legendary_pull_id)
```

#### Backend Services
1. **card-definitions-service** - Seed 100 cards, toggle availability, get cards by mode
2. **card-shop-service** - Pack purchasing, inventory, pity tracking, currency management
3. **card-clash-service** - Match lifecycle (start/finish/delete), standings, card consumption

#### API Routes (`/api/card-clash/*`)
- `GET /shop/currency/:playerId` - Get player's coins
- `POST /shop/purchase` - Buy packs (SINGLE, FIVE, TEN)
- `GET /inventory/:playerId` - Get all owned cards
- `GET /pity/:playerId` - Check pity status
- `GET /season/active` - Current season info
- `POST /match/start` - Create match with equipped cards
- `POST /match/finish` - End match, award points, consume cards
- `GET /standings/:seasonId` - Season leaderboard
- `GET /matches/:playerId` - Match history
- **Admin:** `/admin/seed-cards`, `/admin/cards`, `/admin/card/toggle`, `/admin/coins/*`, `/admin/card/*`, `/admin/match/delete`, `/admin/player/reset`

#### Card Effects Engine
**File:** `artifacts/api-server/src/lib/card-effects.ts`

Complete function library for:
- `applyX01GoodCard()` - Modify X01 scoring based on card effect
- `applyX01BadCard()` - Apply penalties to opponent in X01
- `applyCricketGoodCard()` - Modify cricket marks and points
- `applyCricketBadCard()` - Reduce opponent's cricket marks
- `applyWildcardGoodCard/BadCard()` - Cross-mode effects
- `validateCardCanPlay()` - Check if card is playable in current game state

### ✅ COMPLETED - PHASE 2 PART 2 (Frontend Components)

#### Main Pages/Components
1. **card-clash.tsx** - Main Card Clash page
   - Overview tab: Season info, how it works
   - Shop tab: Pack purchase UI (Single, 5-pack, 10-pack)
   - Standings tab: Season leaderboard with rankings

2. **card-inventory.tsx** - Full card collection view
   - Search & filter by game mode, card type, rarity
   - Expandable card details with effects
   - Rarity stats (Common/Rare/Legendary counts)
   - Collection progress (X/100 cards)

3. **admin-card-clash-panel.tsx** - Admin testing tools
   - Seed all 100 cards
   - Toggle card availability (enable/disable testing)
   - Give/remove coins to players
   - Give/remove cards to players
   - Delete matches and revert points/cards
   - Reset player (clear all data)

4. **card-clash-feature-flag.tsx** - Admin-only toggle
   - Switch between "Admin Only" and "Public" release

---

## 🃏 THE 100 CARDS

### X01 GOOD (20 cards)
```
Power Surge +50              | Add 50 to turn total | COMMON
Treble Hunter                | Next treble = 3x | RARE
Unstoppable Checkout         | Block opponent penalties on double | RARE
Banking Strategy             | 50+ score = next +20 | COMMON
Checkout Confidence          | Free re-throw on missed double | RARE
High Roller                  | 60+ score = +20 bonus | COMMON
Perfect Round                | All darts +20% | RARE
Accuracy Zone                | Trebles +25% | RARE
Momentum Builder             | Previous 50+ = this +15 | COMMON
Target Master                | Select segment, +15 there | RARE (popup)
Last Stand                   | Final dart 1.5x if 40+ | COMMON
Focus Fire                   | Select 2 segments, +20 | RARE (popup)
Victory Rush                 | Lead = next +10 | COMMON
Safe Zone                    | Lowest dart +10 | COMMON
Bull's Eye                   | Bull = 100 (not 50) | LEGENDARY
Treble Rush                  | 2+ trebles = +30 | RARE
Comeback Card                | Down 100+ = 2x next | LEGENDARY
Exact Finish                 | Block penalties on finish | RARE
Double Closer                | Doubles 1.2x until checkout | RARE
Finishing Touch              | Final double +10 | COMMON
```

### X01 BAD (20 cards)
```
Rust Hands -40               | Next turn -40 | COMMON
Wild Throw                   | Random dart = 0 | COMMON
Brick Wall                   | Treble 20 blocked | RARE
Shaky Aim                    | All darts 50% | COMMON
Off Balance                  | Next turn -30 | COMMON
Distraction                  | Drop lowest dart | RARE
Bad Luck -50                 | Next turn -50 | COMMON
Ricochet                     | Random dart to adjacent | RARE
Tired Hands                  | Last dart = 0 | COMMON
Penalty Zone                 | Only 1-10 score | RARE
Blocked Bullseye             | Bull blocked | COMMON
Cold Hands                   | Next turn -60 | RARE
Energy Drain                 | Next -30 | COMMON
Bad Aim                      | Trebles = singles | COMMON
Momentum Breaker             | Remove streaks | RARE
Outer Only                   | Outer ring only | COMMON
Pressure Cooker              | Next -80 | LEGENDARY
Doubles Don't Count          | Doubles = singles | RARE
Trapped                      | Can't score on double until 20+ | RARE
Low Blow                     | Singles = 0 | COMMON
```

### CRICKET GOOD (20 cards)
```
Instant Mark                 | Auto-mark chosen number | COMMON (popup)
Double Strike                | Marks 2x | COMMON
Sniper Lock                  | Lock 3 numbers | RARE (popup)
Closing Speed                | Close = +20 points | LEGENDARY
Mark Master                  | No wasted marks | COMMON
Scoring Surge                | Each close +10 points | COMMON
Number Hunter                | Any hit on target = mark | RARE
Bullseye Blitz               | Bull = 2x mark | RARE
Mark Momentum                | Mark = +5 points | COMMON
Precision Marks              | Marks never wasted | RARE
Final Push                   | Closing -1 mark | COMMON
All In                       | All darts same number, all count | LEGENDARY
Perfect Set                  | Full set = +25 | RARE
Mark Multiplier              | 19-20 marks = 2x | COMMON
Closing Bonus                | First close +15 | COMMON
Board Control                | More closed = +20 | RARE
High Value Marks             | 19-20 only, 2x | COMMON
Mark Rush                    | Consecutive = +10 each | COMMON
Victory Marks                | Marks when ahead = 2x | RARE
Triple Threat                | 3 same number = +40 | LEGENDARY
```

### CRICKET BAD (20 cards)
```
Bad Aim                      | Marks 50% | COMMON
Distraction                  | Lose next mark | RARE
Out of Position              | 20,19,18 blocked | COMMON
Penalty Zone                 | 15-17 only | RARE
Shaky Throws                 | Marks 75% | COMMON
Block 20                     | 20 blocked | COMMON
Wasted Darts                 | Random dart no mark | COMMON
Mark Decay                   | Lose 2 marks | RARE
Off Target                   | Bull only | COMMON
Tired Hands                  | Last dart no mark | COMMON
Marked Man                   | Opponent marks 2x | RARE
Block Bull                   | Bull blocked | COMMON
Lock Down                    | 1 number only | RARE
Double Penalty               | Marks 50% | COMMON
Closing Blocked              | No closing | RARE
Random Chaos                 | Marks to random numbers | RARE
Low Marks Only               | 15-17 only | COMMON
Total Lockdown               | Can't mark any | LEGENDARY
Low Blow                     | Singles = 0 | RARE
Zone Restriction             | Outer ring only | COMMON
```

### WILDCARDS GOOD (10 cards)
```
Coin Flip                    | 50/50 +30/-30 | COMMON
Lucky Streak                 | Leg win = +25 | COMMON
Perfect Throw                | First dart 1.5x | COMMON
Clutch Factor                | Down 50+ = 2x | RARE
Hot Hand                     | Success = +5 next | COMMON
Momentum                     | 40+ = +15 next | RARE
Phoenix Rising               | Leg loss = +40 | RARE
Sudden Surge                 | +40 to turn | COMMON
Unstoppable Force            | Block 1 penalty | RARE
Perfect Match                | This + next +20 | LEGENDARY
```

### WILDCARDS BAD (10 cards)
```
Bad Omen                     | Next -25 | COMMON
Curse                        | Next -45 | RARE
Slip Up                      | Random = 0 | COMMON
Deflate                      | Win bonus removed | RARE
Dark Cloud                   | Next -35 | COMMON
Momentum Killer              | Remove bonuses | RARE
Unlucky Night                | Darts 75% | COMMON
Hex                          | Darts 50% | RARE
Wipeout                      | Last 2 = 0 | RARE
Total Annihilation           | Next -100 or lose close | LEGENDARY
```

---

## 💰 COIN EARNING SYSTEM

Players earn coins from:
```
Daily Login:                 +10 coins
Win Card Clash Match:        +50 coins
Win League Match:            +20 coins
Win M-501:                   +10 coins
Tour Mode Completion:        +10 coins
Daily Challenges:            +15 coins (optional)
Weekly Challenges:           +50 coins (optional)
```

**Pack Costs:**
- Single: 50 coins (1 card)
- 5-Pack: 200 coins (5 cards, better value)
- 10-Pack: 350 coins (10 cards, best value)

**Casual player (~1 match/day):** 60-70 coins/day = ~1 free Common pack/day

---

## 🎮 CARD ACTIVATION FLOW

### Before Match
1. Player selects game mode (X01 or Cricket)
2. Selects opponent
3. Equips 2 GOOD cards + 2 BAD cards (can override each time, or use saved setup)
4. Confirms and starts match

### During Match
1. **YOUR TURN:**
   - START: Optionally play 1 GOOD card (effect active for your turn)
   - THROW: 3 darts (with card effect applied)
   - SCORE: Points calculated with card bonus
   - END: Optionally play 1 BAD card on opponent (consumed)

2. **OPPONENT'S TURN:**
   - BAD card effect active (forced, can't prevent)
   - Rest plays normally

3. **After Match:**
   - Cards used are consumed (deleted from inventory)
   - Winner gets +50 card points
   - Loser gets +10 card points
   - Standings updated

---

## 🏗️ TECHNICAL ARCHITECTURE

### Database Flow
```
Match Starts
  ↓
Record equipped cards: player1_equipped_cards, player2_equipped_cards
  ↓
During Turn: Record card used in: cards_used_in_match (JSON array)
  ↓
Match Ends
  ↓
For each card in cards_used_in_match:
  - Reduce quantity in card_inventory by 1
  ↓
Award points: player1_points_earned, player2_points_earned
  ↓
Update card_clash_standings with new totals
```

### Card Effect Application
```
Scoring Engine Receives:
  - Turn darts: [20, 20, 5]
  - Active cards: [Power Surge +50, Rust Hands -40]
  ↓
For GOOD card:
  - Call applyX01GoodCard(effect, context)
  - Returns score modifier: +50
  ↓
For BAD card (opponent):
  - Call applyX01BadCard(effect, context)
  - Returns score modifier: -40
  ↓
Final Score = Base Score + 50 - 40
```

---

## ⚠️ STILL NEEDED - INTEGRATION POINTS

### 1. Navigation & UI Integration
- [ ] Add "Card Clash" tab to main navigation (alongside Hub, Community, Play, etc.)
- [ ] Add "Card Inventory" section to Account page
- [ ] Add "Card Clash Stats" section to Player profiles
- [ ] Add "Card Clash Admin Panel" to Admin page (admin-only)
- [ ] Feature flag: Show Card Clash tab only when enabled (admin-only) or public

### 2. Scoring Screen Integration (CRITICAL)
- [ ] During X01 scoring, show available GOOD cards
- [ ] Player can click card to activate (or choose to not activate)
- [ ] Card effect applies to that turn's score
- [ ] Visual feedback: Card slides in, glows, floats animation
- [ ] Sound effect on activation
- [ ] After turn, show option to play BAD card on opponent
- [ ] Same for Cricket scoring

### 3. Popup Cards
- [ ] "Instant Mark" - Popup asking which number to auto-mark
- [ ] "Sniper Lock" - Popup asking which 3 numbers to lock
- [ ] "Checkout Master" - Popup asking which double to target
- [ ] "Target Master" - Popup asking which segment to boost
- [ ] "Focus Fire" - Popup asking which 2 segments to boost
- [ ] "Number Hunter" - Popup asking which number to hunt

### 4. Coin Earning Integration
- [ ] Hook into X01 match endpoint: Award coins on win/loss
- [ ] Hook into Cricket match endpoint: Award coins on win/loss
- [ ] Hook into M-501 endpoint: +10 coins on completion
- [ ] Hook into Tour Mode endpoint: +10 coins on leg/match win
- [ ] Daily login trigger: +10 coins (once per day)
- [ ] Challenge completion: +15 or +50 coins

### 5. Pre-Equipment System
- [ ] Inventory page with checkboxes to equip 2 GOOD + 2 BAD
- [ ] Save equipment per game mode (X01 setup ≠ Cricket setup)
- [ ] During match start, show equipped cards
- [ ] Option to override before match (swap cards)
- [ ] Show which cards are consumed after match

### 6. Match Recording
- [ ] When Card Clash match finishes, create card_clash_matches record
- [ ] Log all cards used: `cardsUsedInMatch: [{cardId, usedBy, turn}]`
- [ ] Award points to standings
- [ ] Consume cards from inventory

### 7. Visual Polish (Lower Priority)
- [ ] AI generate artwork for each card (Midjourney/DALL-E)
- [ ] Card slide-in animation when activated
- [ ] Glow effect when card is active
- [ ] Floating animation for cards
- [ ] Sound effect on pack opening
- [ ] Sound effect on card activation
- [ ] Mobile responsiveness for Card Clash pages

---

## 🔑 KEY DESIGN DECISIONS

1. **Separate from League:** Card Clash has its own seasons, standings, currency. Doesn't affect normal league ELO/points.

2. **Card Consumption:** Cards are ONE-TIME USE per match. Encourages strategic equipment, makes packs valuable.

3. **Popup Cards:** Some cards require player choice (Instant Mark, Sniper Lock) to add strategy depth.

4. **Good at START, Bad at END:** Prevents mid-turn interruption and maintains sportsmanship.

5. **Monthly Seasons:** Same structure as league (1st-last of month) for consistency.

6. **card_points NOT points:** Avoids confusion with league points. Clear separation in database.

7. **Feature Flag:** Admin-only until testing complete, then toggle public.

---

## 🚀 NEXT IMMEDIATE STEPS

1. **Connect Card Clash tab to navigation** (1 hour)
2. **Integrate card-inventory.tsx into Account page** (30 min)
3. **Add Card Clash stats to Player profiles** (1 hour)
4. **Add Admin panel to Admin page** (30 min)
5. **Build scoring screen card UI** (2-3 hours) - MOST COMPLEX
6. **Hook coin earning into match endpoints** (1 hour)
7. **Build popup card selection modals** (1-2 hours)
8. **Test all card effects** (3-4 hours)
9. **Deploy and iterate based on feedback** (ongoing)

---

## 📁 FILE LOCATIONS

### Backend
- Database schemas: `lib/db/src/schema/card-*.ts` (7 files)
- Services: `artifacts/api-server/src/services/card-*.ts` (3 files)
- Card effects engine: `artifacts/api-server/src/lib/card-effects.ts`
- API routes: `artifacts/api-server/src/routes/card-clash.ts`

### Frontend
- Main page: `artifacts/tkdl/src/pages/card-clash.tsx`
- Components: `artifacts/tkdl/src/components/card-*.tsx` (3 components)

---

## 🐛 KNOWN ISSUES / TODOs

1. **Auth middleware:** Removed from card-clash routes (need to add back properly)
2. **AI card artwork:** Not yet generated (placeholder image_urls)
3. **Popup cards:** Components exist, need integration with scoring
4. **Card effect validation:** Started, not complete
5. **Match history:** Need to format card_used_in_match JSON properly
6. **Render deploy failed:** Build error fixed, but not tested on deploy yet

---

## 💡 TESTING CHECKLIST

- [ ] Seed all 100 cards
- [ ] Give player 1000 coins
- [ ] Purchase packs (Single, 5, 10)
- [ ] Verify drop rates (75/20/5)
- [ ] Check pity system (pull 50+ times, verify Legendary)
- [ ] Delete match and verify points reverted
- [ ] Reset player and verify 0 coins/cards
- [ ] Play X01 with GOOD card, verify score increased
- [ ] Play X01 with BAD card on opponent, verify score decreased
- [ ] Play Cricket with GOOD card, verify marks increased
- [ ] Test popup cards (Instant Mark, Sniper Lock)
- [ ] Verify cards consumed after match
- [ ] Check leaderboard updates correctly
- [ ] Test feature flag toggle

---

## 📝 NOTES FOR FUTURE CHATS

- **Most critical:** Scoring screen integration. Cards are useless without UI integration.
- **Second priority:** Coin earning. Players need to fund their card collecting.
- **Third priority:** Visual polish (animations, artwork).
- **Test on mobile:** Card selection UI needs to work on phone.
- **Error handling:** Need proper error messages for failed pack purchases, invalid card plays, etc.

---

**END OF SUMMARY**

This document should be pasted into future chats to keep Claude in context. Update the "Last Updated" date and "Project Status" as progress is made.
