# UNIVERSAL CARD CLASH FAVORITES - BUILD PLAN

## PHASE 1: DISCOVERY (5 min)
- [ ] Find Card Collection screen component
- [ ] Find where favorites currently display
- [ ] Identify all screens showing Card Clash cards
- [ ] Understand current persistence layer

## PHASE 2: DATA LAYER (30 min)
- [ ] Use existing cardInventoryTable.isFavorite OR create dedicated table
- [ ] Verify API endpoints exist and work
- [ ] Ensure favorites load on app initialization
- [ ] Test persistence: add fav → refresh → still there

## PHASE 3: CARD COLLECTION UI (45 min)
- [ ] Find CardCollection component
- [ ] Add favorite button/star to each card
- [ ] Wire up to favorites API
- [ ] Show filled/empty star based on status
- [ ] Test add/remove functionality

## PHASE 4: EQUIPMENT SELECTION UI (45 min)
- [ ] Modify CardEquipmentSelector to group favorites first
- [ ] Separate into two sections:
   - "⭐ FAVORITES (X cards)" at top
   - "ALL CARDS" below
- [ ] Sort within each section
- [ ] Ensure favorites still show correctly

## PHASE 5: TESTING & POLISH (30 min)
- [ ] Test on all screen sizes
- [ ] Test add favorite from collection
- [ ] Test persistence across refresh
- [ ] Test remove favorite
- [ ] Test equipment selection grouping
- [ ] Test mobile UI

## SUCCESS CRITERIA
✅ Can favorite from collection
✅ Can favorite from equipment selection
✅ Favorite status persists after refresh
✅ Equipment selection shows favorites first
✅ Works on mobile
✅ No console errors
✅ Clean, intuitive UI

---

## ESTIMATED TIME: 2.5-3 hours for COMPLETE build

