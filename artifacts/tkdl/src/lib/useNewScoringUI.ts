import { useEffect, useState } from "react";

// Reads the `new_scoring_ui` feature flag's status for the current logged-in
// session from GET /api/feature-status/:name (see routes/settings.ts). While
// the flag's admin_test_mode is on and it isn't yet live for everyone, this
// resolves to `true` only for Graeme's own admin session — every other
// player keeps seeing the existing party-game scoring screens untouched.
// Flip it from /admin → Feature Flags → "New Scoring UI".
export function useNewScoringUI(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-status/new_scoring_ui", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((status: { available?: boolean } | null) => {
        if (!cancelled && status) setEnabled(!!status.available);
      })
      .catch(() => {
        // Fail closed — if the flag can't be checked, keep the existing UI.
      });
    return () => { cancelled = true; };
  }, []);

  return enabled;
}
