# CARD CLASH AUDIT FIX PLAN
**Date:** 2026-06-25  
**Status:** Comprehensive audit complete, fixes queued  
**Impact:** 13 issues found across 3 severity levels

---

## PHASE 1: CRITICAL FIXES (Must do first)

### Issue #1: Standings URL Mismatch
**Problem:**
- Frontend (card-clash.tsx:26): `GET /api/card-clash/standings?season=current`
- Backend (routes/card-clash.ts:316): `GET /standings/:seasonId`
- These never match → 404 on standings fetch

**Fix:** Standardize to path parameter
```typescript
// Backend: Change route
- GET /standings/:seasonId  
+ GET /standings/:seasonId (keep as-is, it's correct)

// Frontend: Change call
- GET /api/card-clash/standings?season=current
+ GET /api/card-clash/standings/1  (use active season id)
```

**Files to change:**
- `artifacts/tkdl/src/pages/card-clash.tsx` (line 26)
- `artifacts/api-server/src/routes/card-clash.ts` (verify route)

---

### Issue #2: Missing Player Stats Route
**Problem:**
- Frontend calls: `GET /api/card-clash/player/${playerId}/stats`
- Backend: No route exists → stats box always shows 0

**Fix:** Create the missing route + service
```typescript
// ADD: routes/card-clash.ts
router.get("/player/:playerId/stats", async (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const stats = await getPlayerStats(playerId);
  res.json(stats);
});

// ADD: services/card-clash-service.ts
export async function getPlayerStats(playerId: number) {
  const currency = await getPlayerCurrency(playerId);
  const inventory = await getPlayerInventory(playerId);
  const standings = await getPlayerStandings(playerId);
  
  return {
    coins: currency?.cardPoints || 0,
    cardsOwned: inventory?.length || 0,
    matchesPlayed: standings?.matches || 0,
    wins: standings?.wins || 0,
  };
}
```

**Files to create/modify:**
- `artifacts/api-server/src/routes/card-clash.ts` (add route)
- `artifacts/api-server/src/services/card-clash-service.ts` (add function)

---

### Issue #3: Missing Wildcard Grid Images
**Problem:**
- Code references: `/cards/wildcard-good-grid.png` & `/cards/wildcard-bad-grid.png`
- Actual files: Don't exist in public/cards/
- Result: 404 for all 20 wildcard cards

**Fix Options:**
A) **Create the 2 missing grid images** (from designer)
   - wildcard-good-grid.png (5 cols × 2 rows of wildcard good cards)
   - wildcard-bad-grid.png (5 cols × 2 rows of wildcard bad cards)

B) **Use individual card images instead** (we have these!)
   - Reference `/card-artwork/coin-flip.jpg` instead of grid
   - Switch CardImage.tsx to use individual images

**RECOMMENDATION:** Use option B (we already have 100 individual card images)
- Simpler: no need to create grids
- Better UX: can show full card details
- Aligns with new TKDLCard system

---

## PHASE 2: MAJOR FIXES (Do after Phase 1)

### Issue #4: CARD NAMES COMPLETELY OUT OF SYNC 🔴
**Problem:**
Two completely different card systems exist:

**Seed names (all-cards.ts):**
- X01 Good: "Big Game Player", "Power Surge", "Treble Hunter", "Unstoppable Checkout"
- Cricket Good: "Bullseye Master", "Fearless Finisher", "Opening Spree"  
- Cricket Bad: "Number Lockdown", "Corrupted Numbers", "Chain Reaction"
- Wildcard Good: "Golden Dart", "Card Recovery", "Perfect Setup"

**Component names (index.ts):**
- X01 Good: BigGamePlayer, BankingStrategy, CenturyMaker, CheckoutConfidence, CheckoutSpecialist
- Cricket Good: BullMultiplier, BullseyeRush, ClosingProtection, ComebackMarks, Dominance
- Cricket Bad: AimShift, BadAim, BullVoid, ClosingBlocker, CricketPrison
- Wildcard Good: CoinFlip, ComebackLeg, FinishingEdge, HotHand, Invincible

**Fix:** Unify to ONE system
We have two choices:

**Option A: Keep seed names, delete TSX components**
- Seed has 100 cards defined with IDs/names
- But we also have beautiful individual card artwork
- Would lose the new card images ❌

**Option B: Update seed to match TSX component names** ✅ RECOMMENDED
- Keep the new individual card images we created
- Update all-cards.ts to use component names
- Cards will render with proper artwork

**IMPLEMENTATION:**
```typescript
// Update all-cards.ts to match component names
export const ALL_CARDS = [
  // X01 GOOD (20 cards) - matching TSX
  { id: "x01g01", name: "BankingStrategy", ... },
  { id: "x01g02", name: "BigGamePlayer", ... },
  { id: "x01g03", name: "CenturyMaker", ... },
  { id: "x01g04", name: "CheckoutConfidence", ... },
  { id: "x01g05", name: "CheckoutSpecialist", ... },
  // ... etc
]

// Update card-image-mapping.ts to use individual images
const cardMapping = {
  "BigGamePlayer": "/card-artwork/big-game-player.jpg",
  "BankingStrategy": "/card-artwork/banking-strategy.jpg",
  // ... 100 mappings
}
```

**Files to update:**
- `artifacts/api-server/src/seeds/all-cards.ts` (change all 100 card names to match TSX)
- `artifacts/api-server/src/lib/card-image-mapping.ts` (map to individual images)

---

### Issue #5: "Unstoppable Checkout" in seed, no TSX component
**Status:** Moot after #4 is fixed
- Seed has this card but no component
- After unifying names, this will be resolved

---

### Issue #6: Card effects are cosmetic only
**Problem:**
- CardClashMatchScorer displays effect overlay for 2s then disappears
- applyCardEffect() functions exist but are never called
- Cards have ZERO gameplay impact

**Fix:** Wire card effects into scoring
```typescript
// CardClashMatchScorer.tsx
const handleCardClick = async (cardId) => {
  const effect = applyCardEffect(cardId, currentScore, gameMode);
  setActiveCardEffect(effect);
  
  // Actually modify the score!
  updateScore(effect.scoreModifier);
}
```

**Note:** This requires card effect logic to be defined (future work)

---

### Issue #7: Card back path inconsistency
**Problem:**
- TKDLCard.tsx uses: `/card-backs.jpg` (at public root)
- Folder has: `public/cards/card-backs.png` (different path, different format)

**Fix:** Standardize to one path
```typescript
// Option 1: Use the one in public root (current)
// TKDLCard.tsx already uses: url('/card-backs.jpg')
// ✓ This works, keep it

// Delete: public/cards/card-backs.png (is unused)
```

---

### Issue #8: Seed uses lowercase "good"/"bad", runtime expects uppercase
**Problem:**
```typescript
// Seed: type: "good" (lowercase)
// Code: cardType: "GOOD" | "BAD" (uppercase)
// Mismatch causes type errors
```

**Fix:** Update seed to use uppercase
```typescript
// all-cards.ts
type: "GOOD" | "BAD"  // was "good" | "bad"
```

---

## PHASE 3: CODE QUALITY FIXES (After phases 1-2)

### Issue #9: console.log instead of logger
**Replace all:**
- `console.log()` → `logger.info()`
- `console.error()` → `logger.error()`

**Files:** card-clash-service.ts, routes/card-clash.ts

---

### Issue #10: Admin PIN hardcoded
**Problem:**
```typescript
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";  // Hardcoded!
```

**Fix:** Load from .env only, fail if not set
```typescript
const ADMIN_PIN = process.env.ADMIN_PIN;
if (!ADMIN_PIN) {
  throw new Error("ADMIN_PIN environment variable not set");
}
```

---

### Issue #11: Duplicate artwork files with " - Copy.jpg"
**Fix:** Delete all duplicates
```bash
rm /public/card-artwork/*\ -\ Copy.jpg
```

---

### Issue #12: Static import at bottom of file
**Fix:** Move import to top with others
```typescript
// Move from line 523 to top of routes/card-clash.ts
import { getFeatureStatus, FEATURES } from "../services/feature-flags-service";
```

---

### Issue #13: cardsUsed type mismatch
**Problem:**
```typescript
// CardClashMatchScorer sends: cardsUsed: string[]
// Backend reads: cardsUsedInMatch || 0 (as number)
```

**Fix:** Standardize type throughout
```typescript
// Use consistent string[] throughout:
const cardsUsed: string[] = ["x01g01:p0", "x01b03:p1"];
// Never convert to number
```

---

## EXECUTION ORDER

**Week 1:**
1. Fix #1: Standings URL ✓
2. Fix #2: Add stats route ✓
3. Fix #3: Use individual card images instead of missing grids ✓
4. Fix #7: Clean up card-backs paths ✓

**Week 2:**
5. Fix #4: Unify card names (seed ← components) ✓
6. Fix #8: Change lowercase → uppercase types ✓
7. Fix #6: Wire card effects (design first) ✓

**Week 3:**
8. Fix #9-13: Code quality cleanup ✓

---

## TESTING AFTER EACH PHASE

**Phase 1:**
- [ ] Standings page loads with data
- [ ] Player stats box shows actual numbers
- [ ] Wildcard cards render (not 404)

**Phase 2:**
- [ ] Can buy cards and see matching names in inventory
- [ ] Card effects activate and modify score
- [ ] Database queries use correct uppercase types

**Phase 3:**
- [ ] Server logs are structured (Pino format)
- [ ] Admin PIN requires .env
- [ ] No console.log spam

---

## SUMMARY

| Issue | Severity | Phase | Effort |
|-------|----------|-------|--------|
| #1 URL Mismatch | 🔴 Critical | 1 | 30 min |
| #2 Missing stats | 🔴 Critical | 1 | 1 hour |
| #3 Missing images | 🔴 Critical | 1 | 30 min |
| #4 Card names | 🟠 Major | 2 | 4 hours |
| #5 Missing component | 🟠 Major | 2 | Auto-fixed |
| #6 Card effects | 🟠 Major | 2 | 2 hours |
| #7 Image paths | 🟠 Major | 2 | 15 min |
| #8 Type case | 🟠 Major | 2 | 1 hour |
| #9 Logger | 🟡 Minor | 3 | 30 min |
| #10 PIN hardcoded | 🟡 Minor | 3 | 15 min |
| #11 Duplicates | 🟡 Minor | 3 | 10 min |
| #12 Import order | 🟡 Minor | 3 | 5 min |
| #13 Type mismatch | 🟡 Minor | 3 | 30 min |

**Total time:** ~10 hours to fix all 13 issues

---

## NEXT STEP

Ready to start Phase 1 fixes. Which would you like to tackle first?

1. **#1 Standings URL** (fastest)
2. **#2 Player stats route** (blocks stats display)
3. **#3 Wildcard images** (blocks wildcard rendering)
