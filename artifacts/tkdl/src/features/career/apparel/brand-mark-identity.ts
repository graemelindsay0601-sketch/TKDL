function initials(name: string) {
  const words = name.replace(/&/g, " ").split(/[\s-]+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)?.[0]}` : name.slice(0, 2)).toUpperCase();
}

const emblems = [
  "M8 32 24 8l16 24H8zM14 32h20v8H14z",
  "M8 24h32M24 8v32M13 13l22 22M35 13 13 35",
  "M9 34 14 17l10 8 10-8 5 17zM15 39h18",
  "M7 24c6-16 28-16 34 0-6 16-28 16-34 0zM24 8v32",
  "M24 6l5 13 13 5-13 5-5 13-5-13-13-5 13-5z",
  "M7 33q8-18 17 0t17 0M7 23q8-18 17 0t17 0M7 13q8-18 17 0t17 0",
  "M24 6 42 17v14L24 42 6 31V17zM16 20h16v8H16z",
  "M9 34 24 8l15 26M13 29h22M16 23h16",
];

export function sponsorMarkIdentity(brandId: string, brandName: string) {
  let hash = 2166136261;
  for (const char of brandId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return { hue: hash % 360, emblem: emblems[hash % emblems.length]!, monogram: initials(brandName) };
}
