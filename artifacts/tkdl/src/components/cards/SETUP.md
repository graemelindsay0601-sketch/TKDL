# TKDL Card System

## File Structure

```
artifacts/tkdl/
├── src/components/cards/
│   ├── TKDLCard.tsx              ← Base component (handles flip, styling)
│   ├── index.ts                  ← Barrel export for all 100 cards
│   ├── x01-good/                 ← 20 X01 positive effect cards
│   ├── x01-bad/                  ← 20 X01 negative effect cards
│   ├── cricket-good/             ← 20 Cricket positive effect cards
│   ├── cricket-bad/              ← 20 Cricket negative effect cards
│   ├── wildcard-good/            ← 10 Wildcard positive effect cards
│   └── wildcard-bad/             ← 10 Wildcard negative effect cards
│
└── public/
    ├── card-backs.jpg            ← 6-panel card back (3×2 grid)
    └── card-artwork/             ← 100 individual card artwork images
        ├── banking-strategy.jpg
        ├── big-game-player.jpg
        └── ... (98 more)
```

## Quick Start

### Option 1: Import a single card
```tsx
import BigGamePlayer from '@/components/cards/x01-good/big-game-player';

export default function CardDemo() {
  return <BigGamePlayer size="lg" />;
}
```

### Option 2: Import from barrel (simpler)
```tsx
import { BigGamePlayer } from '@/components/cards';

export default function CardDemo() {
  return <BigGamePlayer size="lg" />;
}
```

### Option 3: Use card data directly
```tsx
import { BigGamePlayer, cardData } from '@/components/cards/x01-good/big-game-player';
import { TKDLCard } from '@/components/cards/TKDLCard';

export default function CardDemo() {
  // Render card with data
  return <TKDLCard card={cardData} size="md" />;
}
```

## Card Component Props

```tsx
<TKDLCard
  card={CardData}        // Required: card data object
  size="lg"              // Optional: "sm" | "md" | "lg" (default: "lg")
/>
```

## Card Data Structure

Each card exports a `CardData` object:

```typescript
interface CardData {
  id: number;            // 1-100 (unique card ID)
  name: string;          // Card name (e.g., "Big Game Player")
  category: string;      // "X01 GOOD" | "X01 BAD" | "CRICKET GOOD" | "CRICKET BAD" | "WILDCARD GOOD" | "WILDCARD BAD"
  rarity: string;        // "COMMON" | "RARE" | "LEGENDARY"
  effect: string;        // Card effect description
  flavourText: string;   // Flavour/lore text
  energyCost: number;    // Energy/coin cost (typically 1)
  artworkUrl: string;    // Path to artwork image (e.g., "/card-artwork/big-game-player.jpg")
}
```

## Card Sizes

- **sm**: 120×168px (small, for lists/inventory)
- **md**: 200×280px (medium, for displays)
- **lg**: 280×392px (large, for detail view)

## Features

✅ **3D Flip Animation** — Click any card to flip and see the category-specific back
✅ **Responsive Sizing** — Three size variants for different layouts
✅ **Rarity Indicators** — Color-coded borders and energy badge (Common=Silver, Rare=Blue, Legendary=Gold)
✅ **Full Card Details** — Name, effect, flavour text, and energy cost on front
✅ **Category Backs** — Each card category has a unique back design

## Integrating with Card Clash

### Display cards during match selection
```tsx
import { BigGamePlayer, BullVoid } from '@/components/cards';

export function CardSelector() {
  const selectedCards = [
    <BigGamePlayer size="md" />,
    <BullVoid size="md" />,
  ];
  
  return <div className="card-grid">{selectedCards}</div>;
}
```

### Display card in scoring/activation UI
```tsx
import { TKDLCard } from '@/components/cards/TKDLCard';

export function CardActivationOverlay({ activeCard }) {
  return (
    <div className="overlay">
      <TKDLCard card={activeCard} size="lg" />
      <button>Apply Effect</button>
    </div>
  );
}
```

## All 100 Cards

### X01 GOOD (20)
banking-strategy, big-game-player, century-maker, checkout-confidence, close-control, exact-finish, finishing-bonus, high-pressure, high-roller, iron-will, perfect-rhythm, power-surge-50, precision-strike, safety-boost, safety-net, scoring-arsenal, steady-hand, treble-boost, treble-hunter

### X01 BAD (20)
brick-wall, clutch-breaker, dead-zone, doubles-don-t-count, fatigue, finish-delay, jinx, leg-reset, lockdown, low-blow, mental-block, mercy-killer, off-target, pressure-zone, rust-hands-40, shackled, trapped, treble-curse, turn-enforcer, wild-throw

### CRICKET GOOD (20)
bull-multiplier, bullseye-rush, closing-protection, comeback-marks, dominance, double-strike, early-closer, high-scorer, instant-mark, mark-accelerator, mark-flood, mark-multiplier, momentum-arsenal, number-resurrection, perfect-form, perfect-round, quick-close, scoring-momentum, scoring-surge, sniper-lock

### CRICKET BAD (20)
aim-shift, bad-aim, bull-void, closing-blocker, cricket-prison, distraction, hesitation, mark-drain, mark-erasure, mark-killer, momentum-killer, number-hex, number-prison, out-of-position, penalty-zone, pressure, re-opening-block, score-halve, sluggish-marks, streak-breaker

### WILDCARD GOOD (10)
coin-flip, comeback-leg, finishing-edge, hot-hand, invincible, lucky-streak, match-point, momentum-surge, perfect-game, underdog

### WILDCARD BAD (10)
dark-cloud, hex, match-pressure, momentum-killer, shutdown, total-annihilation, underdog-curse, unlucky-night, win-bonus-removed, wipeout

## Styling Customization

To modify card appearance, edit `TKDLCard.tsx`:

- **RARITY_COLORS** — Change border/badge colors
- **CARD_BACK_COORDS** — Adjust back panel grid positions
- **CARD_SIZES** — Modify sm/md/lg dimensions
- Card styling (fonts, shadows, padding) in the JSX

## Notes

- Images must be in `/public/card-artwork/` for paths to resolve
- Card backs PNG expects a 3×2 grid (3 columns, 2 rows)
- Each card is self-contained and can be used independently
- No external animation library required (uses native CSS transforms)
