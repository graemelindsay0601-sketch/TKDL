---
name: Bot persona system
description: CPU opponent personas for Solo vs CPU practice mode — original fictional characters, 6 difficulty levels, and auto-play hooks in scorers.
---

## Architecture

- `artifacts/tkdl/src/lib/bot-engine.ts` — source of truth: BotLevel enum, BOT_LEVELS record, BotPersona type, BOT_PERSONAS array, visit functions
- `artifacts/tkdl/src/components/game-scorer.tsx` — accepts `botLevel?: BotLevel`, passes to supported scorers
- `artifacts/tkdl/src/pages/practice.tsx` — SetupData has `botPersona?: BotPersona`, persona picker UI, passes `persona.level` as botLevel

## BotLevel (6 levels)
beginner (26avg) → amateur (45avg) → club (62avg) → county (80avg) → pro (95avg) → elite (108avg)

## Bot hook pattern (in each scorer)
```typescript
const handleDartRef = useRef(handleDart);
useEffect(() => { handleDartRef.current = handleDart; });
const isBotTurn = !!botLevel && turn === 1;
useEffect(() => {
  if (!botLevel || turn !== 1) return;
  const [d1, d2, d3] = botX01Visit(...);
  const t1 = setTimeout(() => handleDartRef.current(d1), 700);
  const t2 = setTimeout(() => handleDartRef.current(d2), 1400);
  const t3 = setTimeout(() => handleDartRef.current(d3), 2100);
  return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
}, [turn, botLevel]); // eslint-disable-line
```
- DartInputBoard gets `disabled={isBotTurn}` so human can't interfere
- TurnBanner shows "CPU THROWING…" when bot's turn
- Scorers supported: X01, Cricket, Sequence, HalveIt, CountUp (Killer/Gotcha etc not supported — no botLevel prop)

## Personas (18 total, sorted hardest to easiest in UI)
Opponent names, nicknames, biographies, and character details must be original fiction. Do not use real players or thinly disguised versions of them.

**Why:** The user explicitly said they do not want real-life pros in the app.

**How to apply:** Keep stable internal IDs where needed for saved selections, but make every user-visible opponent identity and biography wholly fictional.

## Why ref pattern
Without `handleDartRef`, the setTimeout callback captures a stale closure of handleDart. The ref ensures each delayed dart call always uses the latest handler with fresh state. This is React's canonical solution to stale-closure-in-timeout.

## Dropdown fix (play.tsx, practice.tsx)
Native `<select>` popup uses OS light background. If option inherits white text, it's invisible.
Fix: `<option style={{ color: "#111" }}>` on every option element.
