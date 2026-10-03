import { createHash } from "node:crypto";

export type Random = () => number;
/** SHA-256 over unambiguous JSON tuples, then SFC32. Version/scopes isolate streams. */
export function scopedRandom(seed: string, version: number, ...scope: (string | number)[]): Random {
  if (!/^[a-f0-9]{64}$/.test(seed) || !Number.isInteger(version) || version < 1) throw new Error("Invalid Career random root");
  const digest = createHash("sha256").update(JSON.stringify([seed, version, ...scope])).digest();
  let a = digest.readUInt32LE(0), b = digest.readUInt32LE(4), c = digest.readUInt32LE(8), d = digest.readUInt32LE(12);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11));
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
export function stableUuid(seed: string, version: number, ...scope: (string | number)[]) {
  const b = createHash("sha256").update(JSON.stringify([seed, version, ...scope])).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80; // RFC 9562 custom/version-8 UUID; not a random UUID claim.
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const between = (rng: Random, min: number, max: number) => min + rng() * (max - min);
export const integer = (rng: Random, min: number, max: number) => Math.floor(between(rng, min, max + 1));
export const pick = <T>(rng: Random, values: readonly T[]) => values[Math.floor(rng() * values.length)];
export const normal = (rng: Random) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
export function weighted<T extends { weight: number }>(rng: Random, values: readonly T[]): T {
  let roll = rng() * values.reduce((sum, value) => sum + value.weight, 0);
  for (const value of values) { roll -= value.weight; if (roll < 0) return value; }
  return values[values.length - 1];
}
