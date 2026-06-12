---
name: iOS camera getUserMedia / play() quirk
description: On iOS Safari, calling video.play() after an awaited getUserMedia() silently fails — must rely on autoPlay attribute and wait for the 'playing' event instead.
---

## Rule
Never call `video.play()` explicitly after `await navigator.mediaDevices.getUserMedia()` on iOS Safari.

**Why:** iOS Safari breaks the user-gesture chain after any `await`. The `play()` call is silently refused (no error thrown, no camera shown).

**How to apply:**
1. Set `autoPlay playsInline muted` on the `<video>` element.
2. After `video.srcObject = stream`, wait for the `'playing'` event with a timeout fallback:
```ts
await new Promise<void>((resolve) => {
  const onPlaying = () => { video.removeEventListener('playing', onPlaying); resolve(); };
  video.addEventListener('playing', onPlaying);
  setTimeout(() => {
    video.removeEventListener('playing', onPlaying);
    video.play().catch(() => {});
    resolve();
  }, 1500);
});
```
3. Also try progressively simpler `getUserMedia` constraint sets (full HD → environment only → `{ video: true }`) because iOS rejects complex constraints.
