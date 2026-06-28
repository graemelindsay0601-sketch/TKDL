# CARD CLASH - CRITICAL AUDIT & FIX LIST

**Session 23 - New Issues Found by User**

---

## 🔴 CONFIRMED BUGS (Ready to Fix)

### 1. CRICKET RULES TEXT ❌ INCORRECT
**Location:** `/artifacts/tkdl/src/components/RulesUI.tsx`
**Current Text:** "reach 75+ points in Cricket after closing all numbers"
**Problem:** Cricket doesn't have a 75+ point requirement. You close numbers and have highest score.
**Fix:** Update to correct cricket rules

### 2. PRACTICE MODE - CAN'T EQUIP CARDS ❌ BUG
**Location:** Card Clash Practice Tab
**Problem:** Users can't equip cards before practice matches
**Expected:** Should show CardEquipmentSelector before launching practice match
**Fix:** Add equipment selection step to practice mode

---

## ❓ VERIFICATION NEEDED (Audit)

### 3. LOGIN COINS & STREAKS ❓ VERIFY
**Expected:**
- Daily login: +10 coins
- 7-day streak: +25 coins
- 30-day streak: +100 coins
- Streak counter visible
**Status:** Need to verify if fully working

### 4. WIN REWARDS ❓ VERIFY
**Expected:**
- Win: +50 coins + 10×(cards equipped)
- Loss: +25 coins + 10×(cards equipped)
**Status:** Need to verify if fully working

### 5. FREE PACKS EVERY 3 DAYS ❓ VERIFY
**Expected:**
- Timer shows 3-day countdown
- Can claim one free pack
- Can't claim again until timer reset
**Status:** Need to verify if fully working

### 6. END OF SEASON REWARDS ❓ VERIFY
**Expected:**
- Season ends automatically
- Rewards distributed
- Standings reset
- Coins/cards preserved
**Status:** Need to verify if fully working

### 7. TIME-GATED CARD PURCHASES ❓ VERIFY
**Expected:**
- Can only buy specific card once per X hours
- Timer shows when available again
- Prevents spam buying
**Status:** Need to verify if fully working

---

## ⚠️ FEATURES TO BUILD

### 8. GAME MODE CUSTOMIZATION ❌ MISSING
**What's needed:**
After selecting X01 or Cricket, show settings screen:
- Game Mode: 101 / 501 / 1001 (X01 only)
- Cards to Equip: 2-4 selector
- Legs/Sets: 1-5 selector
**Impact:** Currently only X01 with fixed settings

### 9. "NEW" TAG ON PULLED CARDS ❌ MISSING
**What's needed:**
- Add visual badge (🆕 or "NEW") on newly pulled cards
- Show for 24 hours or until viewed
- In collection view
**Impact:** Players can't easily see new cards

### 10. SELL DUPLICATES COLLAPSIBLE ⚙️ UI POLISH
**What's needed:**
- Make "Sell Duplicates" section collapsible
- Show/hide on click
- Default: collapsed or expanded?
**Impact:** Minor UX improvement

---

## 🔴 CRITICAL: PERFORMANCE ❌ AUDIT NEEDED

**User reported:** "Things are getting slow again"
**Potential issues:**
- Too many re-renders
- Unoptimized database queries
- Missing database indexes
- Large data loads without pagination
- Memory leaks
- Asset loading issues

**Need to:**
1. Profile React renders
2. Check network requests
3. Audit database queries
4. Check for missing indexes
5. Review component optimization

---

## PRIORITY RANKING

### MUST FIX (Blocking)
1. Cricket rules text (quick fix - 10 min)
2. Practice mode cards (medium - 30 min)
3. Performance audit (depends)

### SHOULD FIX (Important)
4. Verify login coins/streaks
5. Verify win rewards
6. Verify free packs
7. Verify season rewards
8. Verify time-gated purchases

### NICE-TO-HAVE (Polish)
9. Game mode customization (feature)
10. "NEW" tag (polish)
11. Collapsible sell section (polish)

---

## RECOMMENDED ACTION ORDER

1. **Quick Wins (10-30 min)**
   - Fix cricket rules text
   - Fix practice mode cards

2. **Verification (20-30 min)**
   - Verify each coin/reward system
   - Document what's working/broken

3. **Performance (1-2 hours)**
   - Profile app
   - Find bottlenecks
   - Optimize

4. **Build Missing Features (2-3 hours)**
   - Game mode customization
   - New tag on cards
   - Collapsible sections

---

## YOUR DECISION

What should we tackle first?
1. Quick fixes (cricket + practice)
2. Verify all systems are working
3. Performance audit
4. Build new features

**My vote:** Fix quick bugs first, then verify systems, then performance.

