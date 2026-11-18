/**
 * Per-save change counter (this process only). Every write transaction bumps it when it locks the save (lockRoot
 * FOR UPDATE), and every non-GET Career request bumps it again when it finishes, so anything computed before a
 * change is never served after it. Reads never bump. The read cache (read-cache.ts) tags each answer with it.
 */
const versions = new Map<string, { version: number; changedAt: number }>();

export function saveVersion(saveId: string) {
  return versions.get(saveId) ?? { version: 0, changedAt: 0 };
}
export function bumpSaveVersion(saveId: string) {
  const v = versions.get(saveId)?.version ?? 0;
  versions.set(saveId, { version: v + 1, changedAt: Date.now() });
}
