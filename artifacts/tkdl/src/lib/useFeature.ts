import { useEffect, useState } from "react";

/** Whether a staged feature is on for this session (everyone, or admin preview). Fails closed. */
export function useFeature(name: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/feature-status/${name}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((s: { available?: boolean } | null) => { if (live && s) setOn(!!s.available); })
      .catch(() => {});
    return () => { live = false; };
  }, [name]);
  return on;
}
