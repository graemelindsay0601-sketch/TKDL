/**
 * Phones get in the way of short passwords: they capitalise the first letter
 * ("merry" -> "Merry") and can add a space after a word. So a password also
 * matches with surrounding spaces removed, or with its first letter's case
 * flipped. Everything else must match exactly.
 */
export function passwordVariants(pw: string): string[] {
  const out = [pw];
  const t = pw.trim();
  for (const base of t === pw ? [pw] : [pw, t]) {
    if (!out.includes(base)) out.push(base);
    const c = base.charAt(0);
    const flipped = c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
    if (flipped !== c) { const v = flipped + base.slice(1); if (!out.includes(v)) out.push(v); }
  }
  return out;
}
