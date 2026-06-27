# Favorites System - Implementation Guide

**Status:** Ready for integration  
**Complexity:** Medium  
**Components:** 5 files  
**Time to integrate:** 1-2 hours

---

## Overview

The Favorites system allows players to mark cards as their favorites, which will then appear at the top of collection views and equip screens. This helps players quickly find and select their preferred cards.

---

## Architecture

### Files Created

1. **Database Migration** (`artifacts/api-server/src/db/migrations/add_favorites.ts`)
   - Adds `is_favorite` boolean column to `player_cards` table
   - Default value: `false`

2. **Backend API** (`artifacts/api-server/src/routes/favorites.ts`)
   - `POST /api/cards/:cardId/favorite` - Toggle favorite
   - `GET /api/player/:playerId/cards/favorites` - Get all favorites
   - `PUT /api/cards/:cardId/favorite` - Set favorite explicitly

3. **Frontend Components** (`artifacts/tkdl/src/components/FavoriteButton.tsx`)
   - `FavoriteButton` - Interactive heart icon button
   - `FavoriteBadge` - Small indicator badge

4. **Custom Hook** (`artifacts/tkdl/src/hooks/useFavorites.ts`)
   - `useFavorites()` - Manage favorite state
   - `partitionByFavorite()` - Sort/filter by favorites

5. **Documentation** (this file)

---

## How It Works

### User Flow

1. Player clicks heart icon on a card
2. `FavoriteButton` sends POST to `/api/cards/:cardId/favorite`
3. Backend toggles `is_favorite` in database
4. Frontend updates local state
5. Card appears at top of sorted lists

### Data Flow

```
FavoriteButton (UI)
        ↓
  useFavorites (State)
        ↓
  /api/cards/:id/favorite (API)
        ↓
  player_cards table (DB)
        ↓
  CardEquipmentSelector (Sorted view)
  CardCollectionBook (Sorted view)
```

---

## Integration Steps

### Step 1: Run Database Migration

```bash
# In api-server directory
npm run migrate:latest

# This adds is_favorite column to player_cards
```

### Step 2: Register API Routes

In `artifacts/api-server/src/routes/index.ts`, add:

```typescript
import favoritesRouter from './favorites';

// Register after other routes
router.use(favoritesRouter);
```

### Step 3: Update CardEquipmentSelector

**Location:** `artifacts/tkdl/src/components/CardEquipmentSelector.tsx`

**Add to component:**

```typescript
import { useFavorites } from '@/hooks/useFavorites';

export function CardEquipmentSelector({ playerId, onCardSelect }) {
  const { sortedCards, isFavorite, toggleFavorite } = useFavorites(
    playerId,
    cardsToSelect
  );

  return (
    <div>
      {/* Show favorites section first */}
      <div>
        <h3>⭐ Favorites</h3>
        {sortedCards
          .filter(c => isFavorite(c.id))
          .map(card => (
            <CardItem
              key={card.id}
              card={card}
              isFavorite={true}
              onFavoriteToggle={() => toggleFavorite(card.id)}
            />
          ))}
      </div>

      {/* Show all other cards */}
      <div>
        <h3>All Cards</h3>
        {sortedCards
          .filter(c => !isFavorite(c.id))
          .map(card => (
            <CardItem
              key={card.id}
              card={card}
              isFavorite={false}
              onFavoriteToggle={() => toggleFavorite(card.id)}
            />
          ))}
      </div>
    </div>
  );
}

function CardItem({ card, isFavorite, onFavoriteToggle }) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div>{card.name}</div>
      <FavoriteButton
        cardId={card.id}
        playerId={playerId}
        isFavorite={isFavorite}
        onToggle={onFavoriteToggle}
      />
    </div>
  );
}
```

### Step 4: Update CardCollectionBook

**Location:** `artifacts/tkdl/src/components/CardCollectionBook.tsx`

**Add to component:**

```typescript
import { FavoriteButton, FavoriteBadge } from '@/components/FavoriteButton';
import { useFavorites } from '@/hooks/useFavorites';

export function CardCollectionBook({ playerId, cards }) {
  const { sortedCards, isFavorite, toggleFavorite } = useFavorites(
    playerId,
    cards
  );

  return (
    <div>
      {sortedCards.map(card => (
        <div key={card.id} style={{ position: 'relative' }}>
          <FavoriteBadge isFavorite={isFavorite(card.id)} />
          <CardDisplay card={card} />
          <FavoriteButton
            cardId={card.id}
            playerId={playerId}
            isFavorite={isFavorite(card.id)}
            onToggle={() => toggleFavorite(card.id)}
            size="medium"
          />
        </div>
      ))}
    </div>
  );
}
```

---

## API Reference

### POST /api/cards/:cardId/favorite

**Purpose:** Toggle favorite status for a card

**Request Body:**
```json
{
  "playerId": 16
}
```

**Response (Success):**
```json
{
  "success": true,
  "cardId": 123,
  "isFavorite": true,
  "message": "Card marked as favorite ⭐"
}
```

**Response (Error):**
```json
{
  "error": "Card not found"
}
```

---

### GET /api/player/:playerId/cards/favorites

**Purpose:** Get all favorite cards for a player

**Response:**
```json
{
  "favorites": [
    {
      "id": 123,
      "name": "Big Game Player",
      "category": "X01 GOOD",
      "rarity": "RARE",
      "is_favorite": true,
      ...
    }
  ],
  "count": 5
}
```

---

### PUT /api/cards/:cardId/favorite

**Purpose:** Set favorite status explicitly

**Request Body:**
```json
{
  "playerId": 16,
  "isFavorite": true
}
```

**Response:**
```json
{
  "success": true,
  "cardId": 123,
  "isFavorite": true,
  "message": "Favorite status set to true"
}
```

---

## Component Reference

### FavoriteButton

Interactive button to toggle favorite status

**Props:**
```typescript
interface FavoriteButtonProps {
  cardId: number;              // Card ID
  playerId: number;            // Player ID
  isFavorite: boolean;         // Current favorite status
  onToggle?: (isFav: boolean) => void;  // Callback when toggled
  size?: 'small' | 'medium' | 'large';  // Button size
  variant?: 'icon-only' | 'with-text';  // Show text label
}
```

**Example:**
```jsx
<FavoriteButton
  cardId={123}
  playerId={16}
  isFavorite={false}
  onToggle={(isFav) => console.log('Now favorite:', isFav)}
  size="medium"
/>
```

### FavoriteBadge

Small badge showing a card is favorited

**Props:**
```typescript
interface FavoriteBadgeProps {
  isFavorite: boolean;
}
```

**Example:**
```jsx
<FavoriteBadge isFavorite={true} />
{/* Shows: ❤️ FAVORITE */}
```

---

## Hook Reference

### useFavorites

Manage favorite card state and utilities

**Usage:**
```typescript
const {
  favorites,           // Set<number> of favorite card IDs
  isFavorite,          // (cardId) => boolean
  toggleFavorite,      // (cardId) => Promise<boolean>
  sortedCards,         // Cards array sorted with favorites first
  loading              // boolean - initial load state
} = useFavorites(playerId, cards);
```

**Example:**
```typescript
const { sortedCards, isFavorite, toggleFavorite } = useFavorites(16, allCards);

// Check if card is favorited
if (isFavorite(123)) {
  console.log('Card 123 is a favorite');
}

// Toggle favorite
await toggleFavorite(123);

// Use sorted cards (favorites first)
console.log(sortedCards);  // Shows all cards with favorites at top
```

---

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] Can toggle favorite on/off
- [ ] Favorites persist after page refresh
- [ ] Favorites appear at top of sorted lists
- [ ] Heart icon fills/unfills correctly
- [ ] FavoriteBadge shows only for favorited cards
- [ ] All players' favorites are independent
- [ ] API errors handled gracefully
- [ ] Loading state shows during API call
- [ ] useFavorites hook loads favorites on mount

---

## Future Enhancements

1. **Favorite Collections** - Create named groups of favorites
2. **Favorite Decks** - Save favorite equip combinations
3. **Sort Options** - Sort by rarity, category, etc. within favorites
4. **Bulk Favorite** - Mark multiple cards at once
5. **Favorite Sharing** - Share favorite cards with teammates

---

## Performance Notes

- Favorites are loaded once on component mount
- Set-based lookups are O(1) for checking if card is favorited
- Sorting adds ~O(n) operation but is fast for 100 cards
- All API calls are debounced by button loading state

---

## Troubleshooting

**Issue: Favorites not persisting**
- Check database migration ran: `SELECT * FROM player_cards LIMIT 1;`
- Verify API endpoint is registered in `routes/index.ts`
- Check browser console for fetch errors

**Issue: Favorites showing for wrong player**
- Ensure `playerId` parameter is correct
- Check that `useFavorites` is getting correct `playerId`

**Issue: Heart icon not updating**
- Check component is using `useFavorites` hook
- Verify `onToggle` callback is being called
- Check that state update is reaching parent component

---

## Rollback Instructions

If needed to rollback:

```bash
# Revert database migration
npm run migrate:rollback

# Remove routes from index.ts
# Remove imports of favoritesRouter
# Remove component integrations

# Commit rollback:
git revert <commit-hash>
```

---

## Summary

✅ Database schema ready  
✅ API endpoints complete  
✅ Frontend components built  
✅ Custom hook provided  
✅ Documentation complete  

**Next Step:** Integrate into CardEquipmentSelector and CardCollectionBook (1-2 hours)
