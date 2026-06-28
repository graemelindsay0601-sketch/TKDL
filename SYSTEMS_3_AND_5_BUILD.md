# Card Clash Systems #3 & #5: Complete Build Summary

## SYSTEM #3: FREE PACKS EVERY 3 DAYS

### Database Changes
- **File:** `/lib/db/src/schema/players.ts`
- **Change:** Added `lastFreePackClaimTime` column (nullable TIMESTAMPTZ)
- **Migration:** In `app.ts` line 602: `ALTER TABLE players ADD COLUMN IF NOT EXISTS last_free_pack_claim_time TIMESTAMPTZ`

### Backend Service
- **File:** `/artifacts/api-server/src/services/free-pack-service.ts` (NEW)
- **Exports:**
  - `checkFreePackStatus(playerId)` → returns `{ canClaim, hoursUntilAvailable, lastClaimedAt }`
  - `claimFreePackForPlayer(playerId)` → awards SINGLE pack if eligible, updates timestamp
  - `resetFreePackCooldown(playerId)` → admin only, clears cooldown

### API Endpoints
- **Route prefix:** `/api/card-clash/`
- **GET `/free-pack/status`** → Check cooldown status
- **POST `/free-pack/claim`** → Claim free pack (award pack + update timestamp, fire-and-forget)
- **POST `/admin/free-pack/reset/:playerId`** → Admin only, reset cooldown for testing

### Business Logic
- Cooldown: 72 hours (3 days)
- Pack type: SINGLE
- Fire-and-forget: If pack award fails, claim still succeeds (timestamp updated)
- Error resilience: Returns clean error messages

### Testing via Admin Endpoints
```bash
# Check status
GET /api/card-clash/free-pack/status

# Claim pack
POST /api/card-clash/free-pack/claim

# Reset for testing
POST /api/card-clash/admin/free-pack/reset/16?adminPin=0601
```

---

## SYSTEM #5: TIME-GATED CARD PURCHASES (24-HOUR COOLDOWN)

### Database Usage (No Changes)
- **Existing table:** `shopPurchaseHistoryTable` in `/lib/db/src/schema/featured-card-shop.ts`
- **Usage:** Query last purchase timestamp for player + card combo
- **Cooldown:** 24 hours per card per player

### Backend Service
- **File:** `/artifacts/api-server/src/services/shop-purchase-cooldown-service.ts` (NEW)
- **Exports:**
  - `checkCardPurchaseCooldown(playerId, cardId)` → returns `{ canPurchase, hoursUntilAvailable, lastPurchasedAt }`
  - `validatePurchaseAllowed(playerId, cardId)` → returns `{ allowed, reason?, hoursUntilAvailable? }`
  - `clearPurchaseHistoryForCard(playerId, cardId)` → admin only, clears for testing

### Modified Purchase Logic
- **File:** `/artifacts/api-server/src/services/featured-card-shop-service.ts`
- **Function:** `purchaseFeaturedCard()`
- **Change:** Added cooldown check after featured card validation (before coin checks)
- **Behavior:**
  - Rejects purchase if player purchased same card in last 24 hours
  - Returns clean error: "Card on cooldown. Available in X hours"
  - Check happens early, before any state changes

### API Endpoints
- **Route prefix:** `/api/card-clash/`
- **GET `/shop/featured/:cardId/purchase-status`** → Check purchase cooldown for specific card
- **POST `/admin/shop/clear-purchase/:playerId/:cardId`** → Admin only, clear purchase history

### Business Logic
- Cooldown: 24 hours per card per player (not account-wide)
- Players CAN buy different cards same day
- Players CANNOT buy same card twice in 24 hours
- Query: Most recent purchase timestamp for (playerId, cardId)
- Fire-and-forget: If check fails, purchase rejected cleanly

### Testing via Admin Endpoints
```bash
# Check purchase status for card 5
GET /api/card-clash/shop/featured/5/purchase-status

# Clear purchase history for testing
POST /api/card-clash/admin/shop/clear-purchase/16/5?adminPin=0601

# Then purchase should work again
POST /api/card-clash/shop/featured/5/purchase { "playerId": 16 }
```

---

## FILES MODIFIED/CREATED

### Created (2)
1. `/artifacts/api-server/src/services/free-pack-service.ts`
2. `/artifacts/api-server/src/services/shop-purchase-cooldown-service.ts`

### Modified (4)
1. `/lib/db/src/schema/players.ts` — added lastFreePackClaimTime column
2. `/artifacts/api-server/src/app.ts` — added migration for new column
3. `/artifacts/api-server/src/routes/card-clash.ts` — added 6 new endpoints
4. `/artifacts/api-server/src/services/featured-card-shop-service.ts` — added cooldown check to purchaseFeaturedCard()

### Not Modified
- No schema files need updates for System #5 (uses existing shopPurchaseHistoryTable)
- No database drop/recreate needed

---

## NEXT STEPS: FRONTEND

After deployment, need to build:
1. **Free Pack UI** in Card Clash page
   - Display timer showing hours until pack available
   - Claim button (disabled if on cooldown, enabled if ready)
   - Show "Pack claimed! Check inventory" after successful claim

2. **Shop Purchase Cooldown UI**
   - Show timer on featured card slots when on cooldown
   - Disable purchase button if cooldown active
   - Update timer in real-time (or refetch on click)

3. **Admin Testing UI** (optional, for development)
   - Add buttons to reset free pack cooldown
   - Add buttons to clear purchase history
   - Use admin PIN

---

## DEPLOYMENT CHECKLIST

- [ ] Both new .ts services created without errors
- [ ] No syntax errors in modified files
- [ ] Migration statement correct in app.ts
- [ ] Endpoints registered in card-clash.ts (6 new endpoints)
- [ ] purchaseFeaturedCard cooldown check integrated
- [ ] Build passes (pnpm build)
- [ ] Deploy and test manually
