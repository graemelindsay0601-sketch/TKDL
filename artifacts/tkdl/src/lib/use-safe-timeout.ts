import { useCallback, useEffect, useRef } from "react";

/**
 * Drop-in replacement for `setTimeout` inside React components.
 * Tracks every scheduled timeout and clears any still-pending ones on unmount,
 * preventing state updates (or bot-move callbacks) from firing after the
 * component using them has gone away.
 *
 * Usage: `const safeTimeout = useSafeTimeout(); safeTimeout(() => ..., 500);`
 * The returned id behaves like a normal timeout id and can still be passed to
 * `clearTimeout` manually if a caller needs to cancel it early.
 */
export function useSafeTimeout() {
  const idsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const ids = idsRef.current;
    return () => {
      ids.forEach(id => clearTimeout(id));
      ids.clear();
    };
  }, []);

  return useCallback((fn: () => void, delay?: number) => {
    const id = setTimeout(() => {
      idsRef.current.delete(id);
      fn();
    }, delay);
    idsRef.current.add(id);
    return id;
  }, []);
}
