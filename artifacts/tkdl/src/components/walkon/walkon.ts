import { useEffect, useState } from "react";

export type WalkOn = { playerId: number; nickname: string; colourA: string; colourB: string; style: WalkOnStyle };
export type WalkOnStyle = "spotlights" | "smoke" | "sparks" | "confetti";

export const WALKON_COLOURS: Record<string, { label: string; hex: string }> = {
  pink: { label: "Pink", hex: "#ff2d7a" }, blue: { label: "Blue", hex: "#2f7bff" }, gold: { label: "Gold", hex: "#ffd24a" },
  green: { label: "Green", hex: "#25c26e" }, red: { label: "Red", hex: "#e3263a" }, purple: { label: "Purple", hex: "#9b5cff" },
  orange: { label: "Orange", hex: "#ff8a1f" }, white: { label: "White", hex: "#f3f1f8" }, teal: { label: "Teal", hex: "#19c3c8" },
  black: { label: "Black", hex: "#22202a" },
};
export const WALKON_STYLES: { key: WalkOnStyle; label: string; blurb: string }[] = [
  { key: "spotlights", label: "Spotlights", blurb: "Sweeping beams in your colours" },
  { key: "smoke", label: "Smoke", blurb: "Low smoke rolling across the stage" },
  { key: "sparks", label: "Sparks", blurb: "Pyro sparks either side" },
  { key: "confetti", label: "Confetti", blurb: "Gold confetti drop" },
];
export const hexOf = (k: string | undefined, fallback = "#ff2d7a") => (k && WALKON_COLOURS[k]?.hex) || fallback;

export async function fetchWalkOns(ids: number[]): Promise<Record<number, WalkOn>> {
  const list = ids.filter(n => Number.isInteger(n) && n > 0);
  if (!list.length) return {};
  try { const r = await fetch(`/api/walkons?ids=${list.join(",")}`, { credentials: "include" }); return r.ok ? await r.json() : {}; } catch { return {}; }
}

export function useWalkOns(ids: number[]) {
  const key = ids.join(",");
  const [map, setMap] = useState<Record<number, WalkOn>>({});
  useEffect(() => { let live = true; void fetchWalkOns(ids).then(m => { if (live) setMap(m); }); return () => { live = false; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return map;
}

export async function saveWalkOn(w: Omit<WalkOn, "playerId">): Promise<WalkOn> {
  const r = await fetch("/api/walkons/me", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(w) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Couldn't save");
  return j as WalkOn;
}
