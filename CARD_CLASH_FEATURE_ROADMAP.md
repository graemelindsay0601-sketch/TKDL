# Card Clash - Feature Implementation Roadmap

**Date:** June 26, 2026  
**Status:** Planning & Prioritization  
**Scope:** 14 major features + card audit

---

## Priority Breakdown

### 🔴 HIGH PRIORITY (Core Gameplay)
1. **Equipable Cards Toggle (1-5 per game)** - Game-changing mechanic
2. **Card Clash Practice Mode (Separate)** - Essential for learning
3. **Equip Screen Card Display** - UX critical, currently shows placeholders
4. **Favorites System** - Quality of life, frequently requested
5. **Coins Display on Main Page** - Critical info missing

### 🟠 MEDIUM PRIORITY (Polish & Features)
6. **Streak Hunter Rarity Change** - Balance adjustment (legendary)
7. **Equipable Cards per Game Toggle** - Customization
8. **Rules UI Improvement** - Readability
9. **Trade Function** - Player interaction
10. **Purchase Timestamps** - Collection tracking

### 🟡 LOW PRIORITY (Cosmetic & Admin)
11. **Free Pack Visual Appeal** - Store UX
12. **Better Buzz Text** - Main page flavor
13. **Achievements Coins/Packs** - Progression system
14. **More Admin Controls** - Backend tools
15. **Card Audit & Cleanup** - Maintenance

---

## Feature Details & Implementation Plan

### 1. FAVORITES SYSTEM 🌟
**Status:** Not Started  
**Complexity:** Medium  
**Dependencies:** Database, UI components

**What:**
- Add heart/star icon to cards in collection
- Filter/sort by favorites in equip screen
- Show favorites first in equip screen
- Persist favorite state per player

**Changes Needed:**
- DB: Add `is_favorite` boolean to player_cards table
- API: GET/POST endpoints for toggle favorite
- UI: Heart icon in CardEquipmentSelector
- UI: Filter logic to prioritize favorites

**Estimated Time:** 2-3 hours

---

### 2. EQUIPABLE CARDS TOGGLE (1-5) ⚙️
**Status:** Not Started  
**Complexity:** Medium-High  
**Dependencies:** Match schema, game logic

**What:**
- Admin setting: equipable cards count per game (1-5)
- Can set separate counts for GOOD and BAD cards
- Players must select exactly N good + N bad cards before match
- Default: 2 good + 2 bad (current)

**Changes Needed:**
- DB: Add `equipable_good_cards`, `equipable_bad_cards` to feature_flags/settings
- API: Endpoint to get current settings
- UI: Admin control panel to set counts
- UI: CardEquipmentSelector to show required count dynamically
- Logic: Validation before match creation

**Estimated Time:** 3-4 hours

---

### 3. CARD CLASH PRACTICE MODE 🎓
**Status:** Not Started  
**Complexity:** High  
**Dependencies:** Separate match flow, scoring

**What:**
- Separate from normal Practice mode
- Access ANY card from collection (not limited to equipped)
- Test strategies without restrictions
- Play vs:
  - Bot (current AI)
  - Another player
  - "Pro" difficulty (harder bot)
- Rewards: Optional coins (lower than ranked)
- Doesn't affect win/loss record or rankings

**Changes Needed:**
- DB: Add `is_practice` boolean to card_clash_matches
- API: Separate route for practice match creation
- UI: New "Card Clash Practice" tab/button
- UI: Different card selector (all cards available)
- Logic: Skip rewards/ranking updates for practice matches
- Frontend: Separate CardClashPracticeMode component

**Estimated Time:** 4-5 hours

---

### 4. EQUIP SCREEN CARD DISPLAY 🎴
**Status:** Not Started  
**Complexity:** Medium  
**Dependencies:** Card data, styling

**What:**
- Show actual card image/details in equip screen
- Not just placeholder boxes
- Display: Name, rarity, effect preview
- Visual distinction between good/bad cards
- Draggable/selectable interface

**Changes Needed:**
- UI: Enhanced CardEquipmentSelector component
- Styling: Card display grid with real data
- Logic: Load full card data (not just ID)

**Estimated Time:** 2-3 hours

---

### 5. COINS DISPLAY ON MAIN PAGE 💰
**Status:** Not Started  
**Complexity:** Low  
**Dependencies:** User context

**What:**
- Show current coin balance on Card Clash main page
- Update when coins change
- Link to shop to spend coins

**Changes Needed:**
- UI: Add CoinBalance display to CardClashPage
- Logic: Load coin balance on page load

**Estimated Time:** 0.5-1 hour

---

### 6. RULES UI IMPROVEMENT 📖
**Status:** Not Started  
**Complexity:** Low-Medium  
**Dependencies:** None

**What:**
- Current rules are hard to read
- Make more visually organized
- Better typography and spacing
- Consider collapsible sections
- Add examples or visual diagrams

**Changes Needed:**
- UI: Redesign CardClashRules component
- Styling: Better structure with headers, bullets
- Consider: Video or animated examples

**Estimated Time:** 1-2 hours

---

### 7. STREAK HUNTER CARD UPDATE 🏹
**Status:** Not Started  
**Complexity:** Low  
**Dependencies:** Card definitions

**What:**
- Current: "Remove 2 legs from opponent"
- New: "If opponent is 2+ legs ahead, remove the 2 legs they have won"
- Rarity: Change from Rare → Legendary
- More balanced, situational card

**Changes Needed:**
- DB: Update card_id X definition and rarity
- Logic: Update card activation logic (ccActivateCard)
- Rebalance: Consider if other cards need adjustment

**Estimated Time:** 1-2 hours

---

### 8. PURCHASE TIMESTAMPS 📅
**Status:** Not Started  
**Complexity:** Low  
**Dependencies:** Database tracking

**What:**
- Add purchase date/time to each card in collection
- Show in CardCollectionBook
- Filter/sort by purchase date
- Useful for tracking acquisition order

**Changes Needed:**
- DB: Add `purchased_at` timestamp to player_cards
- Backfill: Set for existing cards
- API: Return timestamp with card data
- UI: Display timestamp in collection

**Estimated Time:** 1.5-2 hours

---

### 9. TRADE FUNCTION 🔄
**Status:** Not Started  
**Complexity:** High  
**Dependencies:** Match validation, permissions

**What:**
- Players can propose trades with each other
- Trade: Card A + Coins ↔ Card B + Coins (flexible)
- Trade history
- Accept/Reject/Cancel flow
- Prevent duplicate trades

**Changes Needed:**
- DB: Create trades table (from_player, to_player, cards, coins, status)
- API: Endpoints for propose/accept/reject/list trades
- UI: Trade interface with card selection
- Logic: Validation (both players own cards, etc.)
- Notifications: Trade proposals/acceptance

**Estimated Time:** 5-6 hours

---

### 10. FREE PACK VISUAL APPEAL 🎁
**Status:** Not Started  
**Complexity:** Low-Medium  
**Dependencies:** Styling

**What:**
- Current: "Green bar and text"
- Make more visually striking
- Add animations
- Better CTAs
- Highlight: Free daily reward

**Changes Needed:**
- UI: CardClashShop free pack section redesign
- Styling: Green accent bar, icons, animations
- Copy: Better button text and description

**Estimated Time:** 1-2 hours

---

### 11. BETTER BUZZ TEXT 📢
**Status:** Not Started  
**Complexity:** Low  
**Dependencies:** Copy

**What:**
- Improve main page flavor text
- Make more engaging
- Update status messages
- Better guidance for new players

**Changes Needed:**
- UI: Update CardClashPage header text
- Copy: Write more compelling flavor text
- Dynamic: Show different messages based on player status

**Estimated Time:** 0.5-1 hour

---

### 12. ACHIEVEMENTS COINS/PACKS 🏆
**Status:** Not Started  
**Complexity:** Medium  
**Dependencies:** Achievement system

**What:**
- All game mode achievements should reward coins/packs
- Currently: Only Card Clash achievements
- Practice: Win X matches → coins
- 501: Achieve high score → coins
- Tour: Place high → packs
- All modes: Progression feels rewarding

**Changes Needed:**
- DB: Update achievement definitions to include rewards
- Logic: Distribute coins/packs on achievement unlock
- UI: Show rewards in achievement display
- Balance: Set reasonable reward amounts

**Estimated Time:** 2-3 hours

---

### 13. MORE ADMIN CONTROLS 🔧
**Status:** Not Started  
**Complexity:** Medium  
**Dependencies:** Backend, permissions

**What:**
- Manage equipable card counts (already in #2)
- Toggle Card Clash on/off
- Set seasonal parameters
- View player collections/trades
- Manage seasonal shop
- Reset player progress
- View/manage feature flags

**Changes Needed:**
- UI: Admin dashboard enhancements
- Backend: New admin endpoints
- Permissions: Restrict to admin role

**Estimated Time:** 3-4 hours

---

### 14. CARD AUDIT & CLEANUP 🔍
**Status:** Not Started  
**Complexity:** Medium  
**Dependencies:** Card data review

**What:**
- Review all 100 cards
- Remove/consolidate similar cards
- Clarify effect descriptions
- Improve card text clarity
- Balance check

**Process:**
1. Audit each card manually
2. Identify duplicates/similar effects
3. Rewrite unclear descriptions
4. Make recommendations for removal
5. Document changes

**Note:** "Don't do anything, just audit" - Will provide analysis only, no implementation

**Estimated Time:** 4-5 hours (analysis only)

---

## Implementation Strategy

### Phase 1 (Today - Critical Path)
1. ✅ Coins Display (0.5h) - Quick win
2. ✅ Favorites System (2-3h) - High impact
3. ✅ Equip Screen Cards (2-3h) - Core UX
4. ✅ Streak Hunter Update (1-2h) - Balance

**Phase 1 Total: 6-8.5 hours**

### Phase 2 (Tomorrow - Features)
5. Card Clash Practice Mode (4-5h)
6. Equipable Cards Toggle (3-4h)
7. Rules UI (1-2h)
8. Purchase Timestamps (1.5-2h)

**Phase 2 Total: 9.5-13 hours**

### Phase 3 (Future)
9. Trade Function (5-6h)
10. Achievements Coins/Packs (2-3h)
11. Admin Controls (3-4h)
12. Free Pack Visual (1-2h)
13. Better Buzz Text (0.5-1h)
14. Card Audit (4-5h analysis)

**Phase 3 Total: 15.5-21 hours**

---

## Estimated Total Effort

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1 | 6-8.5 | 🔴 Critical |
| Phase 2 | 9.5-13 | 🔴 High |
| Phase 3 | 15.5-21 | 🟠-🟡 Medium/Low |
| **TOTAL** | **31-42.5** | - |

---

## Dependencies & Risks

### Database Changes Needed
- `player_cards.is_favorite` (add column)
- `player_cards.purchased_at` (add column, backfill)
- `card_clash_matches.is_practice` (add column)
- `trades` table (new)
- Feature flags: equipable card counts

### API Endpoints to Create
- `POST /api/cards/:id/favorite` - Toggle favorite
- `GET /api/card-clash/settings` - Get equipable counts
- `POST /api/card-clash/practice` - Create practice match
- `POST /api/trades` - Propose trade
- `POST /api/trades/:id/accept` - Accept trade
- `DELETE /api/trades/:id` - Cancel trade

### UI Components to Build/Update
- CardEquipmentSelector (major rewrite)
- CardClashPracticeMode (new)
- TradeInterface (new)
- AdminCardClashPanel (enhancement)

### Potential Risks
- Trade function complexity (validation, notifications)
- Equipable cards toggle (backward compatibility)
- Practice mode scoring logic
- Card audit findings (might need artist/designer time)

---

## Decision Points

**Question 1:** Should trade function include:
- Proposal notifications?
- Trade history/records?
- Trade cancellation during acceptance window?

**Question 2:** For Card Clash Practice:
- Should practice matches award ANY coins?
- Should they appear in stats/history?
- Separate leaderboard?

**Question 3:** For Equipable Cards Toggle:
- Should new players default to 2+2?
- Can be changed mid-season?
- Affects ongoing matches?

**Question 4:** For Card Audit:
- Should I flag cards for removal? (yes)
- Should I suggest rewrites? (yes)
- Should I do competitive balance pass? (yes)

---

## Success Criteria

- ✅ All features working without bugs
- ✅ No breaking changes to existing features
- ✅ Clear UI for all new features
- ✅ Proper validation and error handling
- ✅ Performance impact minimal
- ✅ Admin controls functional
- ✅ Card audit delivered with recommendations

---

**Next Step:** Confirm prioritization and start Phase 1 implementation
