/**
 * Card Image Mapping System
 * 
 * Each grid image contains 20 cards in a 5x4 layout
 * This file maps card IDs to their grid position for efficient display
 * using CSS background positioning
 */

export type CardGridType = 'x01-good' | 'x01-bad' | 'cricket-good' | 'cricket-bad' | 'wildcard-good' | 'wildcard-bad';

interface CardGridPosition {
  grid: CardGridType;
  cardNumber: number; // 1-20 within the grid
  row: number; // 0-3
  col: number; // 0-4
}

// Grid dimensions: 5 columns, 4 rows = 20 cards per grid
const GRID_COLS = 5;
const GRID_ROWS = 4;
const CARD_WIDTH = 20; // percentage width
const CARD_HEIGHT = 25; // percentage height

// Map card IDs (1-100) to their grid positions
const cardGridMap: Record<number, CardGridPosition> = {};

// Helper to calculate row/col from card number (1-20)
function calculateGridPosition(cardNumber: number): { row: number; col: number } {
  const index = cardNumber - 1; // 0-based
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  return { row, col };
}

// X01 GOOD: Cards 1-20 (IDs 1-20)
for (let i = 1; i <= 20; i++) {
  const pos = calculateGridPosition(i);
  cardGridMap[i] = {
    grid: 'x01-good',
    cardNumber: i,
    row: pos.row,
    col: pos.col,
  };
}

// X01 BAD: Cards 21-40 (IDs 21-40)
for (let i = 21; i <= 40; i++) {
  const cardNum = i - 20;
  const pos = calculateGridPosition(cardNum);
  cardGridMap[i] = {
    grid: 'x01-bad',
    cardNumber: cardNum,
    row: pos.row,
    col: pos.col,
  };
}

// CRICKET GOOD: Cards 41-60 (IDs 41-60)
for (let i = 41; i <= 60; i++) {
  const cardNum = i - 40;
  const pos = calculateGridPosition(cardNum);
  cardGridMap[i] = {
    grid: 'cricket-good',
    cardNumber: cardNum,
    row: pos.row,
    col: pos.col,
  };
}

// CRICKET BAD: Cards 61-80 (IDs 61-80)
for (let i = 61; i <= 80; i++) {
  const cardNum = i - 60;
  const pos = calculateGridPosition(cardNum);
  cardGridMap[i] = {
    grid: 'cricket-bad',
    cardNumber: cardNum,
    row: pos.row,
    col: pos.col,
  };
}

// WILDCARD GOOD: Cards 81-90 (IDs 81-90)
for (let i = 81; i <= 90; i++) {
  const cardNum = i - 80;
  const pos = calculateGridPosition(cardNum);
  cardGridMap[i] = {
    grid: 'wildcard-good',
    cardNumber: cardNum,
    row: pos.row,
    col: pos.col,
  };
}

// WILDCARD BAD: Cards 91-100 (IDs 91-100)
for (let i = 91; i <= 100; i++) {
  const cardNum = i - 90;
  const pos = calculateGridPosition(cardNum);
  cardGridMap[i] = {
    grid: 'wildcard-bad',
    cardNumber: cardNum,
    row: pos.row,
    col: pos.col,
  };
}

export function getCardGridPosition(cardId: number): CardGridPosition | null {
  return cardGridMap[cardId] || null;
}

export function getCardImageUrl(gridType: CardGridType): string {
  return `/cards/${gridType}-grid.png`;
}

export function getCardBackgroundPosition(cardId: number): string | null {
  const position = getCardGridPosition(cardId);
  if (!position) return null;

  const x = position.col * CARD_WIDTH;
  const y = position.row * CARD_HEIGHT;
  return `${x}% ${y}%`;
}

export function getCardBackgroundSize(): string {
  return `${GRID_COLS * 100}% ${GRID_ROWS * 100}%`;
}

// Export mapping for reference
export { cardGridMap };
