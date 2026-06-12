---
name: Auto-scorer system
description: Camera-based dart detection system — architecture, key files, and integration notes
---

## Architecture

Phone camera pointed at dartboard. Frame differencing detects motion → dart landing → settle → score read. No ML model for MVP.

## Key files
- `artifacts/tkdl/src/hooks/useAutoScorer.ts` — main hook: camera lifecycle, frame diff (320×240 canvas), dart centroid detection, board mapping, SSE broadcast
- `artifacts/tkdl/src/components/auto-scorer/CameraOverlay.tsx` — visual overlay on video: board circle, dart markers, score chips. `videoRef` prop is `RefObject<HTMLVideoElement | null>` (React 19 nullable)
- `artifacts/tkdl/src/pages/scorer-camera.tsx` — standalone fullscreen X01 scorer at `/scorer/camera`; setup → game → win; manual numpad fallback; session code for display device
- `artifacts/tkdl/src/pages/scorer-join.tsx` — 4-digit PIN entry for display device
- `artifacts/tkdl/src/pages/scorer-display.tsx` — fullscreen SSE client for second screen
- `artifacts/api-server/src/routes/scorer.ts` — in-memory session store, 4-digit codes, 30-min expiry, SSE fan-out; camera device POSTs events, display device SSE-connects

## Settings (DB, seeded at startup)
- `auto_scorer_enabled` — global on/off toggle
- `auto_scorer_test_only` — if true, only show to admin user (Graeme)
- Admin toggles in `artifacts/tkdl/src/pages/admin.tsx` FeatureFlags section

## Detection parameters
- Analysis canvas: 320×240 (¼ resolution for speed)
- Motion threshold: 12 mean pixel diff; dart diff threshold: 25
- Settle delay: 700ms after last motion
- Board angle: `Math.atan2(dx, -dy)` (0=top, CW positive)
- Ring boundaries as fraction of board radius: bull<0.037, outer_bull<0.094, triple 0.582–0.63, double 0.953–1.0
- Radius fraction stored in localStorage (`auto_scorer_radius`)

**Why:** Calibration radius persists across sessions so Graeme doesn't re-calibrate every time.

## Routes registered
- `/scorer/camera`, `/scorer/join`, `/scorer/display/:code` — all outside Layout (same pattern as `/broadcast`)

## Integration status
- Phase 1 complete: backend relay + standalone camera scorer page
- Not yet integrated into existing GameScorer/practice scorer (requires GameScorer refactor to accept external score injection)
