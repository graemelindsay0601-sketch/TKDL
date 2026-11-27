/** Clubhouse room looks. "pub" is the default; the rest are CLUBHOUSE_ROOM cosmetics (iconKey = theme key). */
export type RoomTheme = {
  wallTop: string; wallBottom: string; stripe: string; wood: number; rail: number; floor: [number, number, number];
  ambient: number; warm: number; neon: string; neonGlow: number; spot: number;
};
export const ROOM_THEMES: Record<string, RoomTheme> = {
  pub:      { wallTop: "#3a0d1f", wallBottom: "#22060f", stripe: "rgba(255,255,255,.025)", wood: 0x3b2414, rail: 0xb8892f, floor: [44, 30, 12], ambient: 0xffe6cc, warm: 0xffb070, neon: "#ff2d7a", neonGlow: 0xff2d7a, spot: 0xfff1dc },
  midnight: { wallTop: "#0f1f44", wallBottom: "#070d22", stripe: "rgba(140,180,255,.04)", wood: 0x1d2333, rail: 0xc9a24a, floor: [34, 32, 40], ambient: 0xcfe0ff, warm: 0x8fb4ff, neon: "#2f9bff", neonGlow: 0x2f9bff, spot: 0xe8f0ff },
  baize:    { wallTop: "#0e3a24", wallBottom: "#071d12", stripe: "rgba(255,255,255,.02)", wood: 0x3a2412, rail: 0xd2a64a, floor: [46, 30, 14], ambient: 0xfff0d8, warm: 0xffc27a, neon: "#ffd24a", neonGlow: 0xffc23a, spot: 0xfff4dc },
  gold:     { wallTop: "#1b1610", wallBottom: "#0a0806", stripe: "rgba(255,210,74,.06)", wood: 0x0b0806, rail: 0xffc21a, floor: [4, 2, 6], ambient: 0xfff1d0, warm: 0xffc04a, neon: "#ff9d00", neonGlow: 0xffa000, spot: 0xfff2d6 },
  arcade:   { wallTop: "#1e0b3a", wallBottom: "#0b041c", stripe: "rgba(0,240,255,.05)", wood: 0x1a1030, rail: 0x19e3ff, floor: [30, 22, 44], ambient: 0xe6d8ff, warm: 0xc084fc, neon: "#19e3ff", neonGlow: 0x19e3ff, spot: 0xf2e8ff },
  stage:    { wallTop: "#06121c", wallBottom: "#020509", stripe: "rgba(25,195,200,.04)", wood: 0x0d141c, rail: 0x19c3c8, floor: [18, 20, 26], ambient: 0xd8f6ff, warm: 0x5fd8ff, neon: "#ffd24a", neonGlow: 0xffd24a, spot: 0xffffff },
};
export const themeFor = (key: string | null | undefined): RoomTheme => ROOM_THEMES[key ?? "pub"] ?? ROOM_THEMES.pub;
