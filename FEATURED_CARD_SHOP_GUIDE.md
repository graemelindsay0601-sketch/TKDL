# 🛍️ Featured Card Shop - Daily Rotating System

## Overview

**Daily Rotating Card Shop** allows players to buy individual cards at rarity-based pricing instead of relying purely on pack RNG.

### Key Features
- ✅ **3 featured cards daily** - One Common, Rare, Legendary
- ✅ **Rarity-based pricing** - Premium over pack cost
- ✅ **Player choice** - Buy specific cards they want
- ✅ **Time-gated** - Resets daily at midnight UTC
- ✅ **Audit trail** - Full tracking of purchases for analytics

---

## Pricing Strategy

Prices are set to be **slightly more than pack equivalent** but cheaper than buying multiple packs for RNG:

| Rarity | Price | Value Vs Pack |
|--------|-------|---------------|
| **Common** | 40 coins | -20% vs SINGLE (50) |
| **Rare** | 75 coins | +50% vs SINGLE (50) |
| **Legendary** | 200 coins | +300% vs SINGLE (50) |

### Rationale
- **Common**: Slight discount encourages new players
- **Rare**: Premium rewards intermediate grind
- **Legendary**: Significant premium (1/100 chance in SINGLE, guaranteed here)

---

## Daily Rotation

### How It Works
1. **Midnight UTC** - System checks for rotation
2. **Random Selection** - Picks random card from each rarity:
   - 1 Common (from ~33 commons)
   - 1 Rare (from ~33 rares)
   - 1 Legendary (from ~6-10 legendaries)
3. **Slot Assignment** - Cards placed in slots 1, 2, 3
4. **Activation** - Featured cards go live
5. **Old Cards** - Previous day's cards marked inactive

### Admin Control
Can force rotation manually:
```
POST /api/card-clash/shop/admin/rotate
Header: x-admin-pin: [PIN]
```

---

## Player API

### Get Featured Cards
```
GET /api/card-clash/shop/featured

Response:
{
  "success": true,
  "featured": [
    {
      "id": 1,
      "cardId": 42,
      "slotNumber": 1,
      "priceCoins": 40,
      "card": {
        "id": 42,
        "name": "Frost Strike",
        "rarity": "COMMON",
        "icon": "❄️",
        "category": "GOOD"
      }
    },
    // ... 2 more cards
  ],
  "message": "Featured cards loaded"
}
```

### Purchase Featured Card
```
POST /api/card-clash/shop/featured/42/purchase
Body: { "playerId": 16 }

Success Response:
{
  "success": true,
  "message": "Purchased Frost Strike for 40 coins",
  "cardName": "Frost Strike",
  "coinsSpent": 40
}

Error Response:
{
  "success": false,
  "message": "Insufficient coins. Need 75, have 50"
}
```

---

## Admin API

### View Purchase History
```
GET /api/card-clash/shop/admin/purchase-history?limit=100
Header: x-admin-pin: [PIN]

Response:
{
  "success": true,
  "count": 25,
  "history": [
    {
      "playerId": 16,
      "cardId": 42,
      "cardName": "Frost Strike",
      "cardRarity": "COMMON",
      "priceCoins": 40,
      "purchasedAt": "2026-06-27T14:30:00Z"
    },
    // ... more purchases
  ]
}
```

### View Shop Statistics
```
GET /api/card-clash/shop/admin/statistics
Header: x-admin-pin: [PIN]

Response:
{
  "success": true,
  "statistics": {
    "totalPurchases": 542,
    "totalCoinsSpent": 31500,
    "purchasesByRarity": [
      { "rarity": "COMMON", "count": 250 },
      { "rarity": "RARE", "count": 200 },
      { "rarity": "LEGENDARY", "count": 92 }
    ]
  }
}
```

---

## Database Schema

### featured_card_shop
```sql
CREATE TABLE featured_card_shop (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES card_definitions(id),
  slot_number INTEGER NOT NULL,           -- 1, 2, or 3
  price_coins INTEGER NOT NULL,           -- Price in coins
  rotation_date TIMESTAMP WITH TIME ZONE, -- Date rotation started
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### shop_purchase_history
```sql
CREATE TABLE shop_purchase_history (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  card_id INTEGER NOT NULL REFERENCES card_definitions(id),
  slot_number INTEGER NOT NULL,
  price_coins INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## Integration with Economy

### How It Fits
1. **Packs**: Random pulls (coin or token cost)
2. **Featured Shop**: Guaranteed cards (coin cost, premium)
3. **Achievements**: Reward coins (free over time)
4. **Matches**: Earn coins (active play)
5. **Challenges**: Earn coins (objectives)

### Player Pathways
- **New Player**: Get commons cheap from shop, build starter deck
- **Active Player**: Mix pack pulls with featured shop certainty
- **Hardcore**: Use achievements + matches to afford featured legendaries
- **Whale**: Buy packs for RNG, use shop for guaranteed catches

---

## Audit & Analytics

### What We Track
- Every purchase (player, card, price, timestamp)
- All rotations and featured cards
- Purchase distribution by rarity
- Total coins spent on shop
- Player spending patterns

### Use Cases
- **Balance**: See if Legendary price is too high/low
- **Engagement**: Track shop adoption rate
- **Economy**: Monitor coin flow through shop
- **Fraud**: Detect anomalies in purchase patterns
- **Reporting**: Understand player spending behavior

---

## Future Enhancements

### Possible Additions
1. **Weekly Specials** - Discounted cards certain days
2. **Limited Editions** - Exclusive cards only in shop
3. **Card Trades** - Players sell duplicates to shop
4. **Bulk Discounts** - Buy 3 cards, get discount
5. **Seasonal Rotations** - Theme weeks (holiday cards, etc.)
6. **Player Wishlists** - Notify when card comes to shop

---

## Deployment Checklist

- [ ] Run migration: `featured-card-shop.ts`
- [ ] Tables created in production database
- [ ] Admin PIN configured in env
- [ ] Initial featured cards seeded (call rotate endpoint)
- [ ] Test purchase flow manually
- [ ] Monitor purchase history audit table
- [ ] Check coin deductions in playerCurrencyTable

---

## Troubleshooting

**"Card not currently featured"**
- Card has rotated out
- Check featured cards endpoint
- Wait for daily rotation or ask admin to force

**"Insufficient coins"**
- Player doesn't have enough coins
- Calculate cost from featured cards endpoint
- Suggest earning coins from matches/challenges

**Purchase succeeded but card doesn't appear**
- Wait for inventory sync
- Check cardInventoryTable directly
- Purchase history should show transaction

**Rotation not happening**
- Check if migration ran
- Verify system time is UTC
- Force rotation via admin endpoint

---

## Status

✅ **PRODUCTION READY**

- Schema complete
- Service complete
- API routes complete
- Migration included
- Admin tools included
- Audit trail included
- Documentation complete

Ready to deploy immediately.

