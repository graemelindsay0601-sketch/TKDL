---
name: Career runtime stability
description: User-reported Career crashes and scorer flicker, plus the state-update boundary that keeps live scoring stable.
---

The user reports that Career crashes frequently and score entry sometimes flickers. Another tester reportedly experienced repeated crashes/reloads but could resume; the user has not reproduced it on a tablet, so a phone-specific cause is possible but unconfirmed. Keep per-dart server checkpointing, but do not copy each successful intermediate response into parent React state that rerenders the active scorer. Only final match state or an actual error should update the visible page. A signed-in Career crash was not reproduced in the local preview; ask for the device/browser, exact page/game, steps, and visible error to diagnose remaining crashes.

**Why:** The user reported recurring Career crashes and noticed intermittent flicker while entering scores. A tester could resume after crashes, while tablet testing did not reproduce them, leaving device-specific behavior uncertain. The scorer's parent was reacting to routine per-dart acknowledgements, creating unnecessary work during active play.

**How to apply:** Preserve durable per-dart saves while isolating non-visual acknowledgement/stream refresh state from the live scorer render path. For crash reports, capture device/browser, route, steps, and error traces instead of guessing at a broad fix.
