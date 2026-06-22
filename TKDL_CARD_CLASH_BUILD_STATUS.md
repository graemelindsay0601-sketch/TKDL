# TKDL Card Clash - BUILD STATUS & CONTEXT DOCUMENT

**Last Updated:** June 22, 2026 (21:45 UTC)  
**Status:** ~75% Complete - Backend & Admin Done, Scoring Integration Needed  
**GitHub:** graemelindsay0601-sketch/TKDL (main branch)  
**Current Player ID:** 16 (Graeme, admin)

---

## 🎯 EXECUTIVE SUMMARY

Card Clash is a **parallel card collection game mode** built on top of TKDL. Players collect cards (gacha system), equip them before matches, and use them strategically during X01/Cricket games to modify scoring.

### What Works ✅
- **Backend:** All 7 database tables, 3 services, card effects engine
- **Admin:** Feature flag, PIN-protected admin controls (10 tools)
- **Coin System:** Earning hooks into all game modes + daily login
- **Card System:** 100 cards designed, seeding, inventory, pity mechanics
- **Navigation:** Card Clash tab visible when enabled

### What's Broken 🚨
- **CONTEXT WINDOW EXPLOSION** — Chats keep hitting token limits while building scoring UI
- Cards not integrated into match scoring flow
- No equipment selector UI before matches
- No visual feedback during matches

### Why Context Explodes
Card Clash is a massive feature spanning:
- 5 backend files (700+ lines total)
- 4 database schemas
- 5+ frontend components
- 100 card definitions
- Complex game logic

**Solution:** This document becomes the "truth." Future chats read this first, not 20 previous chat messages.

---

## 📊 CURRENT PROJECT STATUS

### ✅ Phase 1: Backend Infrastructure (COMPLETE)
- ✅ 7 database tables designed, deployed to Neon
- ✅ 3 services built (definitions, shop, clash)
- ✅ Card effects engine (655 lines of logic)
- ✅ 10 API endpoints (public + admin)
- ✅ 100 cards seeded and working

### ✅ Phase 2A: Admin & Security (COMPLETE - TODAY)
- ✅ Admin PIN verification middleware (routes secured)
- ✅ Card Clash feature flag (toggles visibility)
- ✅ 10 admin testing tools in UI
- ✅ Card Clash nav tab (conditional on flag)
- ✅ Admin panel integrated into admin/index.tsx

### ✅ Phase 2B: Coin System (COMPLETE - TODAY)
- ✅ Coin earning hooks in match endpoints
- ✅ League matches: Win=20, Loss=10 coins
- ✅ Card Clash matches: Win=50+(10×cards), Loss=25+(10×cards)
- ✅ Daily login bonus hook
- ✅ Account page "Cards" tab added

### 🔴 Phase 2C: Scoring Integration (BLOCKED - THIS IS THE ROADBLOCK)
- ❌ Equipment selector UI (before match)
- ❌ Card activation UI (during scoring)
- ❌ Popup card handlers (Instant Mark, Sniper Lock, etc.)
- ❌ Visual feedback (glow, animations)
- ⚠️ **Card effects engine exists but NOT CALLED in scoring**

**Why it's blocked:** Each attempt to build scoring UI causes context window overload because:
1. Need to understand current scorer implementation
2. Need to modify scoring to apply card effects
3. Need to add UI components for card selection
4. Document gets too long to fit in one chat

---

## 🗂️ FILE STRUCTURE & CODE LOCATIONS

### Backend (artifacts/api-server/src/)
```
services/
  ├── card-definitions-service.ts     (Seed, toggle, list cards)
  ├── card-shop-service.ts            (Pack purchase, inventory, pity)
  └── card-clash-service.ts           (Match lifecycle, standings, coins)

lib/
  └── card-effects.ts                 (CORE: 655 lines of card mechanics)

routes/
  └── card-clash.ts                   (10 API endpoints)
```

### Database (lib/db/src/schema/)
```
card-definitions.ts          (100 cards with effects/rarity)
card-inventory.ts            (Player card ownership)
card-pity.ts                 (Pull tracking for 50-pity)
player-currency.ts           (Coin balance)
card-clash-seasons.ts        (Monthly seasons)
card-clash-standings.ts      (Leaderboard per season)
card-clash-matches.ts        (Match records)
```

### Frontend (artifacts/tkdl/src/)
```
pages/
  └── card-clash.tsx                  (Main Card Clash page - 3 tabs)

components/
  ├── card-inventory.tsx              (Full card collection view)
  ├── admin-card-clash-panel.tsx      (10 admin testing tools)
  └── card-clash-feature-flag.tsx     (Feature flag toggle UI)

pages/admin/
  └── index.tsx                       (UPDATED: AdminCardClashPanel integrated)

pages/
  └── account.tsx                     (UPDATED: "Cards" tab added)

layout.tsx                            (UPDATED: Nav routing for Card Clash tab)
```

---

## 🃏 THE 100 CARDS (Quick Reference)

### Distribution
```
X01 GOOD (20):      Power Surge +50, Treble Hunter, Unstoppable Checkout, ...
X01 BAD (20):       Rust Hands -40, Wild Throw, Brick Wall, ...
Cricket GOOD (20):  Instant Mark, Double Strike, Sniper Lock, ...
Cricket BAD (20):   Bad Aim, Distraction, Out of Position, ...
Wildcards (20):     10 GOOD + 10 BAD (work in both modes)
```

### Rarity Distribution
```
COMMON:     75% drop rate
RARE:       20% drop rate
LEGENDARY:  5% drop rate (guaranteed after 50 pulls without one)
```

### Pack Pricing
```
SINGLE:  50 coins  (1 card)
FIVE:    200 coins (5 cards, -20% discount)
TEN:     350 coins (10 cards, -30% discount)
```

---

## 🎮 HOW CARD CLASH WORKS

### Player Journey
1. **Opt-in:** Admin toggles Card Clash feature flag
2. **Earn Coins:** Play league matches (20 win, 10 loss) or daily login (+10)
3. **Buy Packs:** Spend coins on randomized card packs
4. **Build Inventory:** Collect cards over time
5. **[MISSING]** Select equipment before Card Clash match
6. **[MISSING]** Cards activate during match scoring
7. **Consume:** After match, used cards deleted from inventory
8. **Earn Points:** Win/loss rewards (50/10 + 10×cards used)
9. **Compete:** Leaderboard tracks season standings

### Card Effects Timing
- **GOOD CARDS:** Activate at **start of player's turn** (modify context, increase score)
- **BAD CARDS:** Applied by opponent at **end of player's turn** (penalty next turn)
- **Popup Cards:** Require player input (Instant Mark: which number to mark, etc.)

### Coin Formula
```
League Match Win:      +20 coins
League Match Loss:     +10 coins
Card Clash Match Win:  +50 coins + (10 × cards used)
Card Clash Match Loss: +25 coins + (10 × cards used)
Daily Login:           +10 coins (once per 24h)
```

### Card Points (Standings)
```
Win:  +50 + (10 × cards used)
Loss: +10 + (10 × cards used)
```

---

## 🚨 CURRENT BLOCKER: CONTEXT WINDOW ISSUES

### The Problem
Every time we try to build scoring UI integration, the conversation hits token limits because:
1. Need to re-explain the entire system
2. Need to show card definitions (100 cards)
3. Need to modify scoring logic
4. Need to add UI components
5. Document becomes too large to fit in next chat

### Why This Document Fixes It
- ✅ Single source of truth
- ✅ Next chat reads THIS document, not chat history
- ✅ Saves ~30k tokens on context
- ✅ Clear pointers to exact file locations
- ✅ Pre-formatted code snippets ready to use

### To Use This Document in Future Chats
**Paste this text and say:**
> "I'm working on TKDL Card Clash. Here's the full build status. Read this and understand where we are, then [specific next step]"

---

## 📋 IMMEDIATE NEXT STEPS (DO NOT START YET)

### Step 1: Build Equipment Selector (1-2 hours)
**Goal:** Before match starts, player can select 2 GOOD + 2 BAD cards

**What to build:**
- New component: `CardEquipmentSelector.tsx`
  - Shows player's owned cards
  - Allows selection of exactly 2 GOOD + 2 BAD
  - Saves to match record

**Where it goes:**
- Call from Play flow when "Card Clash" toggle is ON
- Pass selected cards to match/start endpoint
- Store in `cardsEquippedInMatch` parameter

**API endpoint exists:** `POST /api/card-clash/match/start`
- Already accepts `cardsEquippedInMatch: CardEquipment[]`

---

### Step 2: Integrate Card Effects into Scorer (2-3 hours)
**Goal:** Cards actually modify scoring during matches

**What to modify:**
- `artifacts/api-server/src/lib/card-effects.ts` — Already 100% built, just needs to be called
- Scoring context needs to:
  1. Load equipped cards for current player
  2. Before turn score calculation: Apply GOOD cards
  3. After turn score calculation: Apply BAD cards from opponent
  4. Return modified score

**How card-effects.ts works:**
```typescript
// Already implemented:
applyX01GoodCard(cardEffect: string, context: ScoringContext): number
applyX01BadCard(cardEffect: string, context: ScoringContext): number
applyCricketGoodCard(cardEffect: string, context: ScoringContext): number
applyCricketBadCard(cardEffect: string, context: ScoringContext): number

// These return a score modifier (positive or negative)
// Just call them and apply the result
```

**Where scoring happens:**
- Probably in `artifacts/api-server/src/services/` or similar
- Look for where X01/Cricket scores are calculated
- Before final score returned, apply card effects

---

### Step 3: Build Scoring Screen UI (2-3 hours)
**Goal:** Visual feedback when cards are played during match

**What to build:**
- Show which cards are equipped at match start
- Highlight when a GOOD card is played (visual feedback)
- Popup for cards needing input (Instant Mark → "which number?")
- Show score modifier ("+50 from Power Surge")
- Mobile responsive

---

### Step 4: Test & Polish (2-3 hours)
- Test all 100 cards with various scoring scenarios
- Verify coin awarding works
- Check standings calculation
- Mobile responsiveness

---

## ⚙️ ADMIN CONTROLS (10 TOOLS - ALREADY WORKING)

All require admin PIN (default: 0601) via `x-admin-pin` header.

### 1. Seed All 100 Cards
```
POST /api/card-clash/admin/seed-cards
Headers: x-admin-pin: 0601
Response: { seeded: 100, message: "All cards seeded" }
```

### 2-4. Manage Player Coins
```
POST /api/card-clash/admin/coins/give
Body: { playerId: number, amount: number }

POST /api/card-clash/admin/coins/remove
Body: { playerId: number, amount: number }

GET /api/card-clash/admin/coins/:playerId
```

### 5-6. Manage Player Cards
```
POST /api/card-clash/admin/card/give
Body: { playerId: number, cardId: number, quantity: number }

POST /api/card-clash/admin/card/remove
Body: { playerId: number, cardId: number, quantity: number }
```

### 7. Delete Matches
```
POST /api/card-clash/admin/match/delete
Body: { matchId: number }
Effect: Reverts points/coins to both players
```

### 8. Reset Player
```
POST /api/card-clash/admin/player/reset
Body: { playerId: number }
Effect: Clear all coins, cards, matches
```

### 9-10. Card Availability & Stats
```
GET /api/card-clash/admin/cards
Response: All 100 cards with enable/disable status

POST /api/card-clash/admin/card/toggle
Body: { cardId: number, enabled: boolean }
```

---

## 🧪 TESTING CHECKLIST

### Setup (Requires Admin Access)
- [ ] Lock admin page (PIN: 0601)
- [ ] Navigate to Feature Flags
- [ ] Toggle "Card Clash" to ON
- [ ] Refresh page
- [ ] Verify "Card Clash" tab appears in main nav

### Seeding
- [ ] Open admin panel
- [ ] Click "Seed All 100 Cards"
- [ ] Verify success message
- [ ] Check `/api/card-clash/admin/cards` returns 100 cards

### Coin Testing
- [ ] Give test account 500 coins
- [ ] Navigate to Card Clash
- [ ] Verify coin balance shows 500
- [ ] Buy SINGLE pack (50 coins)
- [ ] Verify balance is now 450
- [ ] Check inventory for new card

### Pity System
- [ ] Give test account 5000 coins (enough for 50 packs)
- [ ] Buy 50 SINGLE packs
- [ ] Track legendary card pull rate (~5%)
- [ ] On 51st pack, should be guaranteed legendary
- [ ] Verify pity counter resets after legendary

### Card Consumption
- [ ] Give test account 2 of "Power Surge +50" card
- [ ] Play Card Clash match (needs opponent, might need 2 test accounts)
- [ ] Use both Power Surge cards
- [ ] Verify inventory shows 0 remaining

### Standings
- [ ] Play 3+ Card Clash matches
- [ ] Check /card-clash/standings
- [ ] Verify leaderboard sorted by points
- [ ] Verify win/loss counts correct
- [ ] Verify card_points calculation (50 + 10×cards for wins)

---

## 🔑 CRITICAL IMPLEMENTATION NOTES

### 1. Card Effects Engine is DONE
File: `artifacts/api-server/src/lib/card-effects.ts`

It has these functions ready to call:
- `applyX01GoodCard(cardEffect, context)` → number (score modifier)
- `applyX01BadCard(cardEffect, context)` → number (score modifier)
- `applyCricketGoodCard(cardEffect, context)` → number (score modifier)
- `applyCricketBadCard(cardEffect, context)` → number (score modifier)
- `applyWildcardGoodCard(cardEffect, context)` → number
- `applyWildcardBadCard(cardEffect, context)` → number

**No need to rebuild this.** Just call it from the scorer.

### 2. Match Recording Already Works
When match finishes:
- `POST /api/card-clash/match/finish` accepts `cardsUsedInMatch`
- Coins are awarded automatically
- Cards are consumed automatically
- Standings updated automatically

### 3. Feature Flag Controls Everything
If Card Clash isn't showing:
- Check Feature Flags page
- Toggle card_clash_enabled to ON
- May need page refresh

### 4. Admin PIN is Hardcoded
- Default: 0601
- Frontend pulls from sessionStorage after login
- Change in production!

---

## 🐛 KNOWN ISSUES

### Deploy Failing - Missing Boolean Import 🔴 CRITICAL (FIXED)
- ✅ FIXED in commit 9f1bade
- Was: `card-definitions.ts` missing `boolean` from imports
- Solution: Added `boolean` to drizzle-orm/pg-core imports
- Action: Redeploy on Render

### Context Window Explosion 🔴 CRITICAL
- Every chat discussing full feature hits limits
- Solution: This document + smaller focused chats
- Don't try to build entire scoring system in one chat

### Cards Not in Scoring 🔴 CRITICAL
- Card effects engine exists but isn't called
- Need to wire into scoring calculation
- This is THE blocker

### No Equipment Selector 🟡 HIGH
- Can't select cards before match
- Need UI component + Play flow integration

### No Popup Card Handlers 🟡 HIGH
- Instant Mark, Sniper Lock, etc. need popups
- UI components exist, need integration

### Render Deploy Unreliable 🟡 MEDIUM
- Auto-deploy sometimes stale
- Use "Clear build cache & deploy" if needed

### Card Artwork Placeholder 🟢 LOW
- image_urls point to placeholder
- AI generation (Midjourney) not done

---

## 📝 HOW TO USE THIS DOCUMENT

### For New Chats
**Copy & paste this entire document into a new chat, then say:**
```
I'm continuing TKDL Card Clash development. I've pasted the full build 
status document. Read it and understand the current state, then help me 
with [specific task].
```

### For Debugging
- Check section "🐛 KNOWN ISSUES" first
- Verify Feature Flag is ON
- Check admin PIN in code
- Use admin tools to inspect state

### For Continuing Development
1. Read "IMMEDIATE NEXT STEPS" section
2. Start with Equipment Selector (simplest)
3. Move to Scoring Integration (most complex)
4. Then polish

---

## 📞 CRITICAL NOTES FOR GRAEME

1. **This Document Replaces Chat History**
   - Don't rely on past chat context
   - Always reference this file
   - Update it as progress is made

2. **Admin PIN is Hardcoded**
   - Currently: 0601
   - Change in production before public release
   - Can be set via ADMIN_PIN env var

3. **Card Clash is NOT Integrated into Scoring Yet**
   - Equipment selector: NOT BUILT
   - Card effects: BUILT but NOT CALLED
   - Scoring UI: NOT BUILT

4. **Context Window is Your Enemy**
   - Don't try to build entire feature in one chat
   - Break into smaller pieces
   - Always paste this document first

5. **Feature Flag Controls Everything**
   - If Card Clash doesn't appear: Check this first
   - Default: OFF (hidden)
   - Toggle via Feature Flags page (admin only)

---

## 🔗 USEFUL COMMANDS

### Check Current Status
```bash
# Clone repo
git clone https://ghp_[PAT]@github.com/graemelindsay0601-sketch/TKDL.git
cd TKDL

# Check last 10 commits
git log --oneline -10

# Check for uncommitted changes
git status

# View current feature flag state
# (requires running app)
curl https://tkdl-wt7y-onrender.com/api/settings/feature-flags
```

### Seed Cards (From Admin Panel)
1. Lock admin page (PIN: 0601)
2. Go to admin-card-clash-panel
3. Click "Seed All 100 Cards"
4. Wait for success message

### Give Test Coins (From Admin Panel)
1. Open admin-card-clash-panel
2. Enter player ID
3. Click "Give 500 Coins"
4. Refresh app

---

## 📊 PROJECT METRICS

| Aspect | Status |
|--------|--------|
| Backend Infrastructure | ✅ 100% |
| Database Schema | ✅ 100% |
| Card Definitions | ✅ 100% (100 cards) |
| Card Effects Engine | ✅ 100% (not called) |
| Admin Controls | ✅ 100% |
| Feature Flag | ✅ 100% |
| Coin System | ✅ 100% |
| Navigation Integration | ✅ 100% |
| **Equipment Selector UI** | ❌ 0% |
| **Scoring Integration** | ❌ 0% |
| **Scoring Screen UI** | ❌ 0% |
| **Visual Polish** | ❌ 0% |

**Overall:** ~75% Complete

---

**END OF DOCUMENT**

Last commit: 395a665 (feat: Implement comprehensive coin earning across all game modes)

Next session: Start with Equipment Selector UI, then Scoring Integration.
