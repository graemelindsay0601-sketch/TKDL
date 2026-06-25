# TKDL Card Clash — Individual Card Files

  ## Structure

  ```
  tkdl-card-clash/
  ├── TKDLCard.tsx          ← shared base component (copy this first)
  ├── cards/
  │   ├── x01-good/         ← 20 cards
  │   ├── x01-bad/          ← 20 cards
  │   ├── cricket-good/     ← 20 cards
  │   ├── cricket-bad/      ← 20 cards
  │   ├── wildcard-good/    ← 10 cards
  │   └── wildcard-bad/     ← 10 cards
  └── public/
      ├── artwork/           ← 100 card artwork PNGs
      └── card-backs.png     ← TKDL 6-panel card back sheet
  ```

  ## How to import a card

  1. Copy `TKDLCard.tsx` into your project (e.g. `src/components/TKDLCard.tsx`)
  2. Copy the card PNG files into your `public/artwork/` folder
  3. Copy `card-backs.png` into your `public/` folder
  4. Copy individual card files next to TKDLCard.tsx, adjusting the import path

  Each card file exports a ready-to-use React component:

  ```tsx
  import BigGamePlayer from "./cards/x01-good/big-game-player";

  // Render at any size: "sm" | "md" | "lg"
  <BigGamePlayer size="lg" />
  ```

  You can also import just the raw data object:

  ```tsx
  import { cardData } from "./cards/x01-good/big-game-player";
  // cardData = { id, name, category, rarity, effect, flavourText, energyCost, artworkUrl }
  ```

  ## TKDLCard props

  ```tsx
  <TKDLCard
    card={cardData}   // CardData object
    size="lg"         // "sm" | "md" | "lg"
  />
  ```

  Click any card to flip it and see the category-specific TKDL card back.

  ## Card counts
  - X01 GOOD: 20 (8 Common, 10 Rare, 2 Legendary)
  - X01 BAD: 20 (8 Common, 10 Rare, 2 Legendary)
  - Cricket GOOD: 20 (8 Common, 10 Rare, 2 Legendary)
  - Cricket BAD: 20 (8 Common, 10 Rare, 2 Legendary)
  - Wildcard GOOD: 10 (4 Common, 4 Rare, 2 Legendary)
  - Wildcard BAD: 10 (4 Common, 4 Rare, 2 Legendary)
  Total: 100 cards

  ## Dependencies needed in your project
  - react
  - framer-motion (for flip animation) — or remove the animation from TKDLCard.tsx if not needed
  ```
  npm install framer-motion
  ```
  