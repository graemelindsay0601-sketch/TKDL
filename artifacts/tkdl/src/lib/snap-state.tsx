/**
 * Match resume for every game.
 *
 * Scorer components keep their game state in plain useState. Inside a
 * <SnapStateProvider>, useSnapState works exactly like useState but also
 * copies each value into a shared store, which the page saves to
 * localStorage. If the phone kills the app (another app opened, signal lost
 * and the page reloads, battery saver), the page can mount the same scorer
 * again with that store and every converted value picks up where it was.
 *
 * Only plain JSON values (numbers, strings, arrays, plain objects) are kept.
 * Sets, Maps, functions and the like are skipped and start fresh, which is
 * why each scorer's bigger engines (X01, Cricket) also keep their own,
 * stricter recovery in scorer-recovery.ts.
 *
 * Keys are "<Component>.<variable>", written by hand-free conversion, so two
 * scorers never share a key. Outside a provider useSnapState is just useState.
 */
import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type SnapValues = Record<string, unknown>;

type SnapStore = { values: SnapValues; changed: () => void };

const SnapCtx = createContext<SnapStore | null>(null);

function isPlain(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value as number);
  if (t !== "object") return false;
  if (Array.isArray(value)) return value.every(v => isPlain(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every(v => v === undefined || isPlain(v, depth + 1));
}

export function SnapStateProvider({ initial, onChange, children }: {
  /** Values from a saved snapshot to restore, or null for a fresh game. */
  initial: SnapValues | null;
  /** Called (debounced) with the full set of values whenever any changes. */
  onChange: (values: SnapValues) => void;
  children: ReactNode;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [store] = useState<SnapStore>(() => {
    const values: SnapValues = { ...(initial ?? {}) };
    let timer: number | null = null;
    const flush = () => { timer = null; onChangeRef.current({ ...values }); };
    return {
      values,
      changed: () => {
        if (timer !== null) return;
        timer = window.setTimeout(flush, 120);
      },
    };
  });
  // The phone can freeze the page right after it is hidden, so save at once.
  useEffect(() => {
    const now = () => onChangeRef.current({ ...store.values });
    const onHide = () => { if (document.visibilityState === "hidden") now(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", now);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", now); };
  }, [store]);
  return <SnapCtx.Provider value={store}>{children}</SnapCtx.Provider>;
}

export function useSnapState<T>(key: string, init?: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(SnapCtx);
  const [value, setValue] = useState<T>(() => {
    if (store && Object.prototype.hasOwnProperty.call(store.values, key)) return store.values[key] as T;
    return typeof init === "function" ? (init as () => T)() : (init as T);
  });
  useEffect(() => {
    if (!store) return;
    if (isPlain(value)) store.values[key] = value;
    else delete store.values[key];
    store.changed();
  }, [store, key, value]);
  return [value, setValue];
}





