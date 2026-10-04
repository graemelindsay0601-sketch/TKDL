import { useEffect, useState } from "react";

/** Server advertises the explicit opt-in. This value never authorizes requests. */
export function CareerBetaAccess() {
  const [status, setStatus] = useState<{ enabled: boolean; testAccount: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/career-beta/status", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null).then(setStatus).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!status?.enabled) return null;
  return <aside className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 my-3 text-sm text-amber-200" aria-label="Career Beta">
    <strong>Career Beta / Test Account</strong>
    {status.testAccount ? <p>Shared test saves. This is not your real TKDL account.</p>
      : <p><a className="underline" href="/api/auth/career-beta">Enter Career Beta as Test Account</a></p>}
  </aside>;
}
