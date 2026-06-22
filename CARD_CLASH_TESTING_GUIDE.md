# CARD CLASH - TESTING GUIDE

**Status:** Ready to Test (Graeme = Player ID 16)  
**Feature Enabled:** Feature flag gates everything

---

## 🚀 QUICK START (10 minutes)

### Step 1: Lock Admin Page (PIN: 0601)
1. Go to **Admin** page
2. Click **🔒 Lock Admin Page**
3. Enter PIN: `0601`
4. Proceed

### Step 2: Enable Card Clash Feature Flag
1. Click **Feature Flags** in admin page
2. Find "Card Clash" toggle
3. Turn **ON** (enable)
4. Refresh page

### Step 3: Verify Card Clash Tab Appears
1. Go to main navigation (top of page)
2. Look for new **✨ Card Clash** tab
3. Should show alongside Hub, Play, Community, etc.
4. **If not visible:** Clear browser cache and refresh

---

## 🛠️ ADMIN SETUP (5 minutes)

### Step 4: Seed All 100 Cards
1. In Admin page, find **🛠️ Card Clash Admin Panel**
2. Click **Seed All 100 Cards**
3. Wait for message: "Cards seeded successfully!"
4. Cards now exist in database

### Step 5: Give Yourself Coins
1. In Admin Panel, find **💰 Coin Management**
2. Enter your **Player ID:** `16` (Graeme)
3. Enter **Coin Amount:** `500` (enough for several packs)
4. Click **Give Coins**
5. Wait for success message

### Step 6: Verify Setup
- Go to **Card Clash** tab
- Should show:
  - Coin balance: 500
  - Season info
  - Shop with pack prices

---

## 🎮 PLAYER TESTING (15 minutes)

### Step 7: Buy a Pack
1. In Card Clash page, click **Shop** tab
2. Click **SINGLE PACK** (50 coins)
3. Wait for card animation
4. Should show 1 random card (mostly COMMON/RARE, 5% LEGENDARY)
5. Coins should now be 450

### Step 8: Buy More Packs (Test Pity System)
1. Buy 50 more SINGLE packs (50×50 = 2500 coins needed)
2. **Quick method:** Admin Panel → Give 5000 coins
3. Click Shop repeatedly
4. After ~50 pulls: **51st pack MUST be LEGENDARY**
5. Check inventory for Legendary card

### Step 9: Check Inventory
1. Click **Account** page
2. Click **Cards** tab
3. Should see all your collected cards
4. Shows: Name, Rarity, Quantity, Effect description
5. Filter by X01, Cricket, Wildcard

---

## ⚔️ PLAY A CARD CLASH MATCH (10 minutes)

### Step 10: Start a Match with Equipment
1. Go to **Play** page
2. Select format: **1v1**
3. Select game type: **X01** or **Cricket**
4. Select opponent: Any player
5. Select stake: Any amount (e.g., 10 points)
6. Click **Start** button

### Step 11: Equipment Selector Should Appear
**Expected behavior:**
- Modal pops up: "Equip Cards for X01"
- Shows all your cards filtered by game mode
- Displays: Card name, rarity, quantity, effect
- Buttons to select cards

**Your selection:**
- Click 2 GOOD cards (green)
- Click 2 BAD cards (red)
- Must select exactly 2+2
- Click **Start Match with Cards**

### Step 12: Play the Match
1. GameScorer loads normally
2. Play X01/Cricket as usual
3. **Expected visual feedback:**
   - Equipment status bar (top right) shows equipped cards
   - When cards activate: Highlights with glow effect
   - Score modifier appears: "+50 from Power Surge"
4. Finish match (normal scoring)

### Step 13: Verify Match Submission
1. Match finishes, click **Submit Match** (normal flow)
2. Cards should be consumed from inventory
3. Coins should be awarded:
   - **You** (winner): 50 + (10 × cards used)
   - **Opponent** (loser): 25 + (10 × cards used)
4. Check Card Clash standings updated

---

## ✅ VERIFICATION CHECKLIST

After testing, verify:

### Equipment Selector
- [ ] Appears before X01/Cricket matches
- [ ] Shows your inventory correctly
- [ ] Filters by game mode (X01 cards only for X01, etc.)
- [ ] Won't let you proceed without 2+2 selection
- [ ] Selected cards highlighted visually

### Card Consumption
- [ ] Before match: 2 cards selected
- [ ] After match submission: Cards gone from inventory
- [ ] Quantity decreased by 1 for each card used

### Coin Rewards
- [ ] Win gets: Base 50 + (10 × 4 cards used) = 90 coins
- [ ] Loser gets: Base 25 + (10 × 4 cards used) = 65 coins
- [ ] Check in Account page → Card Clash currency

### Card Effects
- [ ] CardActivationOverlay renders (top right)
- [ ] Shows all 4 equipped cards
- [ ] Equipment status updates during match
- [ ] (Optional) Popup appears for special cards

### Feature Flag
- [ ] Turn OFF in Feature Flags
- [ ] Card Clash tab disappears from nav
- [ ] Turn back ON
- [ ] Tab reappears

---

## 🐛 TROUBLESHOOTING

### "Equipment Selector Doesn't Appear"
- ✅ Check Feature Flag is ON
- ✅ Check game type is X01 or CRICKET (not Killer FFA)
- ✅ Clear browser cache
- ✅ Hard refresh (Ctrl+Shift+R)

### "Cards Don't Show in Selector"
- ✅ Seed cards (Admin → Seed All 100 Cards)
- ✅ Give yourself coins (Admin → Give Coins)
- ✅ Buy packs (Card Clash Shop → Buy SINGLE)
- ✅ Check inventory loads (Account → Cards tab)

### "Coins Not Awarded After Match"
- ✅ Check cardsUsedInMatch is in submission payload
- ✅ Check admin panel shows coins updated
- ✅ In Account page, refresh and check balance

### "Cards Not Consumed"
- ✅ Check inventory before and after match
- ✅ Admin Panel → Player Inventory (coming soon)
- ✅ Manually verify via admin tools

### "Deploy Still Failing"
- ✅ Check error message specifically
- ✅ Most recent fix: Named exports (commit 6743279)
- ✅ If still failing: Let me know the error

---

## 📊 ADMIN TOOLS FOR DEBUGGING

In **Admin Panel**, you can:
- **Seed All 100 Cards** - One-time setup
- **Give/Remove Coins** - Fund test accounts
- **Give/Remove Cards** - Inject specific cards
- **Toggle Card Availability** - Enable/disable individual cards
- **Delete Matches** - Revert match and return cards/coins
- **Reset Player** - Clear all Card Clash data for player

---

## 🎯 SUCCESS CRITERIA

You'll know Card Clash is working when:

✅ Feature flag toggles Card Clash on/off  
✅ Equipment selector appears before X01/Cricket matches  
✅ You can select 2 GOOD + 2 BAD cards  
✅ Match plays normally with cards active  
✅ Cards consumed after match  
✅ Coins awarded to both players  
✅ Inventory updated  
✅ Standings updated  

---

## 📁 KEY ENDPOINTS FOR TESTING

**Player Flow:**
- GET `/api/card-clash/season/active` - Current season
- GET `/api/card-clash/shop/currency/:playerId` - Your coins
- POST `/api/card-clash/shop/purchase` - Buy packs
- GET `/api/card-clash/inventory/:playerId` - Your cards
- POST `/api/matches` - Submit match with cardsUsedInMatch
- GET `/api/card-clash/standings/:seasonId` - Leaderboard

**Admin Flow:**
- POST `/api/card-clash/admin/seed-cards` - Seed 100 cards
- POST `/api/card-clash/admin/coins/give` - Give coins
- GET `/api/card-clash/admin/cards` - View all cards
- POST `/api/card-clash/admin/card/toggle` - Enable/disable card
- POST `/api/card-clash/admin/player/reset` - Reset player

---

## 🚀 NEXT STEPS AFTER TESTING

If all works:
1. Test with another player (not admin)
2. Test multiple matches
3. Test pity system (buy 50+ packs)
4. Test different game modes (X01, Cricket)
5. Test popup cards (if integrated)

If issues:
1. Note the exact failure point
2. Check the troubleshooting guide
3. Use admin tools to reset state
4. Try again

---

**Ready to test? Start at Step 1 above!**
