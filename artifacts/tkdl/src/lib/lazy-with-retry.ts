import { lazy, type ComponentType } from "react";

/**
 * Wraps a route's dynamic import so a failed chunk load doesn't leave the
 * user stuck on a dead "Something went wrong" screen.
 *
 * Root cause this exists for: the API server serves the built frontend with
 * a catch-all route that responds with index.html for anything it doesn't
 * recognise (needed so client-side routes survive a refresh). Render spins
 * free/starter services down after 15 idle minutes, so the very first
 * requests after a cold start can land mid-boot; if one of the several
 * chunk files a page lazy-loads (e.g. the dashboard route pulls in ~9
 * separate files) gets caught in that window, it comes back as the HTML
 * shell instead of real JavaScript — "Failed to load module script:
 * ... responded with a MIME type of text/html" — and the dynamic import
 * rejects.
 *
 * React.lazy() caches that rejected promise permanently, so re-rendering
 * (which is all the ErrorBoundary's "Try Again" button used to do) throws
 * the exact same cached error forever. Only a fresh network request for
 * the module — a real reload — actually recovers. This wrapper retries the
 * import once after a short delay (the server is very likely finished
 * booting half a second later), and if that still fails, reloads the page
 * a single time. The reload is guarded by sessionStorage per chunk so a
 * component that's genuinely broken reloads once and then lets the real
 * error surface, instead of looping.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retryKey: string,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      return await importer();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 600));
      try {
        return await importer();
      } catch (err2) {
        const storageKey = `chunk-reload:${retryKey}`;
        let alreadyReloaded = false;
        try {
          alreadyReloaded = sessionStorage.getItem(storageKey) === "1";
        } catch {
          // sessionStorage can throw in some private-browsing modes — fall
          // through and treat it as "not yet reloaded" for this attempt.
        }
        if (!alreadyReloaded) {
          try {
            sessionStorage.setItem(storageKey, "1");
          } catch {
            // Best-effort — if we can't remember we reloaded, worst case
            // we reload again instead of surfacing a stale error sooner.
          }
          window.location.reload();
          // The page is about to unload — never resolve so React doesn't
          // render an error state in the moment before that happens.
          return new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
