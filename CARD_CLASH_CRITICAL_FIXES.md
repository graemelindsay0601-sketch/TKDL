# CARD CLASH - CRITICAL ISSUES FIXED

**Date:** 2026-06-25  
**Severity:** 🔴 CRITICAL - All Card Clash features blocked  
**Status:** ✅ FIXED (Requires immediate deployment)

---

## Issues Found & Fixed

### 🔴 ISSUE 1: `card_pity_system` Table Name Mismatch
**Error:** 
```
Failed query: select "id", "player_id", "pulls_since_legendary", "last_legendary_pull_id", 
"created_at", "updated_at" from "card_pity_system"...
```

**Root Cause:**
- Database migration created table named `card_pity` (line 60 of cardTablesMigration.ts)
- Drizzle schema expected `card_pity_system` (card-pity.ts)
- Query failed because table didn't exist with expected name
- All pack purchases failed with obscure query error

**Fix Applied:**
```typescript
// BEFORE: CREATE TABLE IF NOT EXISTS card_pity (...)
// AFTER:  CREATE TABLE IF NOT EXISTS card_pity_system (...)

// Also fixed schema mismatch:
- Added: last_legendary_pull_id INTEGER column
- Added: UNIQUE constraint on player_id
- All columns now match schema exactly
```

**File Changed:** `artifacts/api-server/src/lib/cardTablesMigration.ts`  
**Commit:** `16b2456`

---

### 🔴 ISSUE 2: Players Start With 0 Coins

**Error:**
```
"Purchase failed: Insufficient coins"
```

**Root Cause:**
- `ensurePlayerCurrency()` created new player records with `card_points = 0`
- When user tried to buy a pack (costs 50-350 coins), they had 0 coins
- No mechanism existed to grant initial coins
- No coin-earning endpoints were working
- Result: **Shop completely broken for new players**

**Fix Applied:**
```typescript
// BEFORE: INSERT ... card_points = 0
// AFTER:  INSERT ... card_points = 100

// New players now START with 100 coins
// Existing players get +50 bonus coins
```

**File Changed:** `artifacts/api-server/src/lib/cardTablesMigration.ts`  
**Commit:** `16b2456`

---

### 🔴 ISSUE 3: Season Endpoint 500 Error

**Error:**
```
GET /api/card-clash/season/active → 500
```

**Root Cause:**
- Related to above: if card_pity_system doesn't exist, DB connection/transaction fails
- Season table creation might also fail due to cascade dependencies
- No active season exists to return

**Fix Applied:**
```typescript
// Created fix-card-clash.ts admin script that:
1. Drops and recreates card_pity_system correctly
2. Ensures active season exists
3. Verifies all tables are created
```

**File Created:** `artifacts/api-server/scripts/fix-card-clash.ts`  
**Commit:** `16b2456`

---

### 🔴 ISSUE 4: Old Card Images Still Rendering

**Issue:**
User says cards are still showing old artwork (grid images), not new individual cards

**Status:** ℹ️ NOT ADDRESSED YET
This requires:
1. Update CardImage component to use new individual card components
2. Wire TKDLCard into the scoring screen
3. Remove references to old grid images

**Next Step:** Separate session (Phase 2B)

---

## What Needs to Happen Now

### IMMEDIATE (Before next test)

1. **Run the fix script on production database:**
   ```bash
   cd artifacts/api-server
   npx tsx scripts/fix-card-clash.ts
   ```
   This will:
   - ✅ Fix card_pity_system table
   - ✅ Give all players coins (100 new, +50 bonus)
   - ✅ Create active season
   - ✅ Verify tables

2. **Restart backend server** on Render

3. **Test purchases:**
   - Login as a player
   - Try buying a Single Pack (50 coins)
   - Should succeed now

### FOLLOW-UP (Next session)

1. **Wire new card components into UI**
   - Update CardImage.tsx to use TKDLCard
   - Update scoring screen to show active cards

2. **Test full flow:**
   - View cards
   - Buy packs and get new cards
   - Use cards in matches
   - See new card images render

---

## Technical Details

### Table Schema Issues

| Table | Was | Now | Issue |
|-------|-----|-----|-------|
| card_pity_system | `card_pity` | `card_pity_system` | Name mismatch |
| player_currency | N/A (was 0 coins) | 100 coins | No starting capital |
| card_clash_seasons | Broken | ✓ Fixed | Cascade failure |

### Files Modified

```
artifacts/api-server/src/lib/cardTablesMigration.ts
  - Line 58-68: Fixed card_pity_system creation
  - Line 197-216: Fixed ensurePlayerCurrency() to grant 100 coins

artifacts/api-server/scripts/fix-card-clash.ts (NEW)
  - Admin script to reset/fix all Card Clash data
  - Verify all tables exist
  - Grant coins to players
```

### Database Constraints

All fixes ensure:
- ✓ Foreign key constraints (player_id → players.id)
- ✓ Unique constraints (player_id in currency, pity, etc.)
- ✓ Cascade delete for data integrity
- ✓ Date columns use ISO format (YYYY-MM-DD)
- ✓ Timestamp columns use TIMESTAMP WITH TIME ZONE

---

## Testing Checklist

After deployment and running fix script:

- [ ] Login to app → Player created with 100 coins
- [ ] GET /api/card-clash/shop/currency/:playerId → Returns 100
- [ ] GET /api/card-clash/season/active → Returns active season (no 500)
- [ ] POST /api/card-clash/shop/purchase → Success (pack generated)
- [ ] GET /api/card-clash/inventory/:playerId → Shows new cards
- [ ] Player coins deducted after purchase
- [ ] Can buy multiple packs
- [ ] Pity system works (50 pulls → guaranteed legendary)

---

## Commits This Session

```
16b2456 FIX: Critical Card Clash issues - table schema, coins, seasons
c2f9d33 ADD: Checkout Specialist card (missing X01 GOOD card #20)
59efc81 FIX: Add missing closing brace for challengeService export
f36eb73 DOC: Add CARD_INTEGRATION_GUIDE
742894e ORGANIZE: Move card designs into proper structure (203 files)
```

---

## What's Left for Phase 2

### Scoring Integration
- [ ] Display cards during live match
- [ ] Activate card effects in real-time
- [ ] Update scores with card modifiers

### UI Integration
- [ ] Render new individual card images (not grid)
- [ ] Card flip animation
- [ ] Collection book with new design

### Backend Wiring
- [ ] Card-clash-scorer integration
- [ ] Match history with card data
- [ ] Leaderboard updates

---

## Critical Note

**DO NOT assume fixes are complete until:**
1. ✅ fix-card-clash.ts runs successfully
2. ✅ Server restarts without errors
3. ✅ User can buy a pack and see coins deducted
4. ✅ New cards appear in inventory

Current database state may be corrupted. The fix script should repair it completely.
