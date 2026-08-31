/**
 * Small shared helpers for reading Express request data with the types
 * actually being useful, rather than sprinkling casts at every call site.
 */

/**
 * Route params type as `string | string[]` under Express 5 (path-to-regexp v6+
 * supports repeating path segments like `:id*`, which can produce arrays), but
 * none of this app's routes actually use repeating params — every `req.params.x`
 * here is always a single plain string at runtime. This normalizes the type for
 * callers like `parseInt()` that want a plain string, taking the first element
 * in the (never-actually-happens-here) array case rather than relying on
 * `Array.prototype.toString()` comma-joining to accidentally do the right thing.
 */
export function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
