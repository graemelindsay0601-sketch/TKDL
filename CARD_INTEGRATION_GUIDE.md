# TKDL Card System — Integration & Next Steps

**Date:** 2026-06-25  
**Status:** ✅ Card designs organized and integrated into project structure

## What Just Happened

### ✅ Completed
1. **Moved 99 card artwork images** from repo root → `/artifacts/tkdl/public/card-artwork/`
2. **Moved 99 card components** from repo root → `/artifacts/tkdl/src/components/cards/` (organized by category)
3. **Created TKDLCard base component** (`/artifacts/tkdl/src/components/cards/TKDLCard.tsx`)
   - 3D flip animation (click to reveal back)
   - Three size variants: sm (120×168), md (200×280), lg (280×392)
   - Rarity color borders (Silver=Common, Blue=Rare, Gold=Legendary)
   - Energy cost badge in top-right
4. **Created barrel export** (`/artifacts/tkdl/src/components/cards/index.ts`)
   - Import all 100 cards with: `import { BigGamePlayer } from '@/components/cards'`
5. **Created setup guide** (`/artifacts/tkdl/src/components/cards/SETUP.md`)
6. **Cleaned up repo root** — removed 200+ image files and empty "New card details" file

### File Structure

```
artifacts/tkdl/
├── src/components/cards/
│   ├── TKDLCard.tsx              ← Base component
│   ├── index.ts                  ← Barrel export (all 100 cards)
│   ├── SETUP.md                  ← Usage guide
│   ├── x01-good/                 ← 20 cards
│   ├── x01-bad/                  ← 20 cards
│   ├── cricket-good/             ← 20 cards
│   ├── cricket-bad/              ← 20 cards
│   ├── wildcard-good/            ← 10 cards
│   └── wildcard-bad/             ← 10 cards
│
└── public/
    ├── card-backs.jpg            ← 6-panel back (3×2 grid)
    └── card-artwork/             ← 99 card images
```

## How to Use Cards

### Simple Usage
```tsx
import { BigGamePlayer } from '@/components/cards';

export default function Demo() {
  return <BigGamePlayer size="lg" />;
}
```

### Render Card Data
```tsx
import { TKDLCard } from '@/components/cards';
import { cardData } from '@/components/cards/x01-good/big-game-player';

<TKDLCard card={cardData} size="md" />
```

### Display Multiple Cards
```tsx
import { BigGamePlayer, BullVoid, CoinFlip } from '@/components/cards';

export function CardHand() {
  return (
    <div className="hand">
      <BigGamePlayer size="md" />
      <BullVoid size="md" />
      <CoinFlip size="md" />
    </div>
  );
}
```

## Integration Points (Phase 2)

### 1. **Match Scoring Screen** (Card Clash)
**File:** `artifacts/tkdl/src/components/CardClashMatchScorer.tsx`

Display active card(s) during live match scoring:
```tsx
import { TKDLCard } from '@/components/cards';

function ScoringScreen({ activeCards }) {
  return (
    <div className="scoring-area">
      <div className="active-cards">
        {activeCards.map(card => (
          <TKDLCard key={card.id} card={card} size="md" />
        ))}
      </div>
      {/* Scoring input */}
    </div>
  );
}
```

### 2. **Card Selection Modal** (Before Match)
**File:** `artifacts/tkdl/src/components/CardClashMatchLauncher.tsx`

Let player select cards before starting:
```tsx
import { TKDLCard } from '@/components/cards';

function CardSelector({ playerCards, onSelect }) {
  return (
    <div className="card-selector">
      {playerCards.map(card => (
        <button key={card.id} onClick={() => onSelect(card)}>
          <TKDLCard card={card} size="sm" />
        </button>
      ))}
    </div>
  );
}
```

### 3. **Card Activation UI**
**File:** `artifacts/tkdl/src/components/CardActivationOverlay.tsx` (NEW)

Show when a card effect activates:
```tsx
function CardActivation({ card, effect }) {
  return (
    <div className="activation-overlay">
      <TKDLCard card={card} size="lg" />
      <div className="effect-label">{effect}</div>
      <div className="apply-animation">✨ ACTIVATED ✨</div>
    </div>
  );
}
```

### 4. **Card Collection Book** (Already Exists)
**File:** `artifacts/tkdl/src/components/CardCollectionBook.tsx`

Album view of all owned cards — can now use:
```tsx
import { TKDLCard } from '@/components/cards';

function CollectionBook({ playerCollection }) {
  return (
    <div className="card-grid">
      {playerCollection.map(card => (
        <TKDLCard key={card.id} card={card} size="sm" />
      ))}
    </div>
  );
}
```

### 5. **Card Shop** (Already Exists)
**File:** `artifacts/tkdl/src/components/CardShopUI.tsx`

Display pack contents:
```tsx
import { TKDLCard } from '@/components/cards';

function PackOpening({ packCards }) {
  return (
    <div className="pack-result">
      {packCards.map(card => (
        <TKDLCard key={card.id} card={card} size="md" />
      ))}
    </div>
  );
}
```

## Data Model Integration

Each card component exports `cardData` with structure:
```typescript
interface CardData {
  id: number;           // 1-99 (unique)
  name: string;         // Card title
  category: string;     // X01 GOOD | X01 BAD | CRICKET GOOD | CRICKET BAD | WILDCARD GOOD | WILDCARD BAD
  rarity: string;       // COMMON | RARE | LEGENDARY
  effect: string;       // Mechanical effect description
  flavourText: string;  // Lore/flavour text
  energyCost: number;   // 1 (can vary for custom cards)
  artworkUrl: string;   // /card-artwork/{name}.jpg
}
```

### To Fetch Card Data in Backend
Add route to return card data (for match replay/history):
```typescript
// GET /api/card-clash/cards/:cardId
// Returns: CardData object
```

### To Store Player's Cards
Existing table: `player_cards`
```sql
CREATE TABLE player_cards (
  id UUID PRIMARY KEY,
  player_id INT REFERENCES players(id),
  card_id INT,                    -- Link to card definition
  times_owned INT DEFAULT 1,      -- How many copies
  rarity_override TEXT,           -- Allow custom rarities
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Next Steps (Session 6+)

### Phase 2A: Scoring Integration ⚠️ **HIGH PRIORITY**
- [ ] Update `CardClashMatchScorer.tsx` to display active cards during scoring
- [ ] Wire card-clash-scorer.ts into gameplay (card effect activation)
- [ ] Add spinner/rotation animations during card activation
- [ ] Test: Play match with 2-3 cards, see them render correctly

### Phase 2B: Card Activation Logic
- [ ] Implement card effect activation (modify live scores)
- [ ] Update `card-clash-scorer.ts` to apply card bonuses/penalties
- [ ] Add animation for bonus/penalty application
- [ ] Test: Activate card, see score update in real-time

### Phase 2C: Match UI Polish
- [ ] Add card flip-in transition when card activates
- [ ] Smooth score updates (no jarring number changes)
- [ ] Card back reveal during matches (hand management)
- [ ] Test: Matches feel polished and responsive

### Phase 3: Backend Integration
- [ ] Add card definitions table seed (seed 99 cards into DB)
- [ ] Add player card inventory table
- [ ] Wire pack opening logic to CardShopUI
- [ ] Add match history with card data

## Testing Checklist

- [ ] Import card in dev: `import { BigGamePlayer } from '@/components/cards'`
- [ ] Card renders with artwork and details
- [ ] Click card to flip and see back
- [ ] Three sizes (sm, md, lg) display correctly
- [ ] Rarity colors show correctly
- [ ] All 99 cards import without errors
- [ ] CardData exports are accessible

## Known Issues

- **99 cards instead of 100**: One card slot empty for future/custom card
- **Card backs grid**: 6 panels (3×2) for 6 categories — layout should match CSS grid exactly
- **Artwork format**: All JPG — ensure Vite loads them correctly (`npm run build` test)

## File Sizes

- Card artwork: ~99 × 80KB = ~7.9MB total
- Card components: ~99 files × 1KB = ~100KB total
- TKDLCard base: ~5KB
- **Total impact**: ~8MB (manageable for production)

## Commit Hash

```
742894e ORGANIZE: Move card designs into proper structure
```

**Push status:** ✅ Pushed to origin/main

---

## Quick Reference: All 100 Cards

| Category | Count | Cards |
|----------|-------|-------|
| X01 GOOD | 20 | banking-strategy, big-game-player, century-maker, ... |
| X01 BAD | 20 | brick-wall, clutch-breaker, dead-zone, ... |
| Cricket GOOD | 20 | bull-multiplier, bullseye-rush, dominance, ... |
| Cricket BAD | 20 | aim-shift, bad-aim, bull-void, ... |
| Wildcard GOOD | 10 | coin-flip, comeback-leg, hot-hand, ... |
| Wildcard BAD | 10 | dark-cloud, hex, shutdown, ... |
| **TOTAL** | **100** | Ready for integration |

