---
name: Solo Play mode
description: How the Solo Play (no opponent) mode works in the Practice scorer
---

## Rule
`X01Scorer` accepts `soloMode?: boolean`. When true: single-player card rendered, turn never switches (always stays at P1 = index 0), checkout bar only for P1.

**Why:** Users wanted to practice X01 alone without a bot opponent — pure throwline reps with stats.

## How to apply
- `GameScorer` accepts `soloMode?: boolean` and passes it through to `X01Scorer`
- `practice.tsx` `SetupData` has `soloPlay?: boolean`; passed as `soloMode={setupData.soloPlay}`
- `mode` state in `SetupScreen` is `"2p" | "bot" | "solo"` — NOT a boolean
- When `mode === "solo"`, `buildSetupData()` returns `{ solo: true, soloPlay: true, botConfig: undefined }`
- Only X01 games are appropriate for solo mode (other scorers don't have soloMode prop)
- Summary screen shows "Practice Complete!" (not win/loss) and mode label "Solo Play"
