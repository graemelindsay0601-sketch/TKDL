#!/usr/bin/env node
/**
 * Workstream E2 — premium Career trophy artwork generator.
 *
 * Writes isolated, transparent-background SVG illustrations to
 * public/assets/career-trophies/. Every design shares one studio lighting rig
 * (key light upper-left, cool rim light right, contact shadow), one viewing
 * angle (slightly above, front three-quarter) and one plinth/engraving-plate
 * position so the renderer can overlay event inscriptions consistently.
 *
 *   node scripts/build-career-trophies.mjs
 *
 * Deterministic: no randomness, so regenerated files are byte-identical.
 * No sponsor marks are drawn on any trophy.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../public/assets/career-trophies");
const W = 240, H = 320;

// ---------------------------------------------------------------- materials
const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ""}/>`).join("");
const lin = (id, list, x1 = 0, y1 = 0, x2 = 1, y2 = 0) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const rad = (id, list, cx = .5, cy = .5, r = .5, fx = cx, fy = cy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops(list)}</radialGradient>`;
const MATERIALS = [
  // polished silver: dark edges, hot key highlight, soft secondary band, cool rim
  lin("silver", [[0, "#4c5560"], [.12, "#9aa6b1"], [.22, "#f4f7fa"], [.3, "#ffffff"], [.42, "#b9c3cc"], [.6, "#6e7984"], [.78, "#c9d2da"], [.9, "#e9eef3"], [1, "#7d8893"]]),
  lin("silverV", [[0, "#ffffff", .85], [.25, "#ffffff", 0], [.75, "#000000", 0], [1, "#000000", .35]], 0, 0, 0, 1),
  lin("silverDark", [[0, "#2e353d"], [.3, "#7c8792"], [.45, "#d9e0e6"], [.6, "#5e6873"], [1, "#2a3038"]]),
  lin("gold", [[0, "#6d4f16"], [.15, "#b98d34"], [.28, "#fff1b8"], [.38, "#f2cf6b"], [.6, "#9a7124"], [.8, "#e2bd5c"], [1, "#7a5a1c"]]),
  lin("copper", [[0, "#55291a"], [.2, "#a4562f"], [.32, "#ffc59c"], [.45, "#d98a56"], [.7, "#7c3e20"], [1, "#4a2414"]]),
  lin("gunmetal", [[0, "#1d2229"], [.2, "#4d5763"], [.32, "#aeb9c4"], [.45, "#5b6672"], [.7, "#2c333c"], [1, "#151a20"]]),
  lin("wood", [[0, "#2b170b"], [.2, "#5b3519"], [.45, "#8a5630"], [.6, "#6d401f"], [.85, "#4a2a12"], [1, "#2a160a"]]),
  lin("woodLight", [[0, "#5b3519"], [.4, "#a8703f"], [.6, "#8a5630"], [1, "#4a2a12"]], 0, 0, 0, 1),
  lin("crystal", [[0, "#a9d8f5", .55], [.2, "#e8f7ff", .35], [.32, "#ffffff", .85], [.4, "#cfeeff", .3], [.7, "#7fb8dd", .35], [1, "#d8f1ff", .55]]),
  lin("crystalDeep", [[0, "#6aa7cf", .5], [.5, "#d9f2ff", .18], [1, "#4f8fbd", .5]], 0, 0, 0, 1),
  lin("plinth", [[0, "#0d0f13"], [.3, "#22262d"], [.5, "#34393f"], [.7, "#1b1e23"], [1, "#0b0c0f"]]),
  lin("plinthTop", [[0, "#3c424a"], [1, "#16191d"]], 0, 0, 0, 1),
  lin("plate", [[0, "#8a6a2a"], [.3, "#f3d98e"], [.5, "#c9a24a"], [.75, "#f1d27c"], [1, "#7a5a1c"]]),
  lin("marble", [[0, "#e9ecef"], [.4, "#ffffff"], [.7, "#d3d8de"], [1, "#b8bec6"]]),
  lin("navyEnamel", [[0, "#0d1b33"], [.5, "#1d3d6e"], [1, "#0a1428"]]),
  lin("cyan", [[0, "#0b4f63"], [.5, "#3fd6ff"], [1, "#0b4f63"]]),
  rad("shadow", [[0, "#000000", .55], [.6, "#000000", .2], [1, "#000000", 0]]),
  rad("glint", [[0, "#ffffff", 1], [.35, "#ffffff", .5], [1, "#ffffff", 0]]),
  rad("globeSea", [[0, "#5fa8e0"], [.55, "#1f5d99"], [1, "#0b2547"]], .38, .32, .7),
  rad("bowlInside", [[0, "#ffffff", .9], [.4, "#c7d0d8"], [1, "#5b6570"]], .45, .4, .6),
].join("");

// ---------------------------------------------------------------- shared parts
const shadow = (w = 150) => `<ellipse cx="120" cy="309" rx="${w / 2}" ry="8" fill="url(#shadow)"/>`;
/** Two-tier ebony plinth with a brass engraving plate at a fixed position (x 84–156, y 280–298). */
const plinth = (w = 128, h = 40, top = 266) => {
  const x = 120 - w / 2;
  return `<g class="plinth">
    <path d="M${x - 6} ${top + 10} h${w + 12} v${h - 8} q0 6 -6 6 h${-w} q-6 0 -6 -6z" fill="url(#plinth)"/>
    <path d="M${x - 6} ${top + 10} h${w + 12} v3 h${-w - 12}z" fill="#ffffff" opacity=".12"/>
    <path d="M${x} ${top} h${w} l6 10 h${-w - 12}z" fill="url(#plinthTop)"/>
    <path d="M${x} ${top} h${w}" stroke="#ffffff" stroke-opacity=".28" stroke-width="1"/>
    <rect x="84" y="280" width="72" height="18" rx="2" fill="url(#plate)" stroke="#5a4214" stroke-width=".8"/>
    <rect x="86.5" y="282.5" width="67" height="13" rx="1.2" fill="none" stroke="#fff3c4" stroke-opacity=".55" stroke-width=".6"/>
  </g>`;
};
const glint = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glint)"/><path d="M${x - r * 2} ${y} H${x + r * 2} M${x} ${y - r * 2} V${y + r * 2}" stroke="#fff" stroke-width=".7" opacity=".8"/>`;
const rim = (d) => `<path d="${d}" fill="none" stroke="#e6f2ff" stroke-opacity=".55" stroke-width="1.1"/>`;
/** Symmetric lathe silhouette: points [[halfWidth, y]...] around x=120. */
const lathe = (pts, fill = "url(#silver)", extra = "") => {
  const right = pts.map(([w, y]) => `${120 + w} ${y}`), left = [...pts].reverse().map(([w, y]) => `${120 - w} ${y}`);
  return `<path d="M${right.join(" L")} L${left.join(" L")}Z" fill="${fill}" ${extra}/><path d="M${right.join(" L")} L${left.join(" L")}Z" fill="url(#silverV)" opacity=".45"/>`;
};
const smoothLathe = (d, fill = "url(#silver)") => `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#silverV)" opacity=".45"/>`;
const ring = (y, w, h = 4, fill = "url(#silverDark)") => `<ellipse cx="120" cy="${y}" rx="${w}" ry="${h}" fill="${fill}"/><ellipse cx="120" cy="${y - 1}" rx="${w - 1}" ry="${h - 1.5}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/>`;
const handle = (side, x0, y0, x1, y1, bulge, fill = "url(#silverDark)") => {
  const s = side === "L" ? -1 : 1;
  return `<path d="M${120 + s * x0} ${y0} C${120 + s * (x0 + bulge)} ${y0 - 6}, ${120 + s * (x1 + bulge)} ${y1 + 4}, ${120 + s * x1} ${y1}
    L${120 + s * (x1 - 3)} ${y1 - 5} C${120 + s * (x1 + bulge - 9)} ${y1 - 2}, ${120 + s * (x0 + bulge - 9)} ${y0 + 2}, ${120 + s * (x0 - 2)} ${y0 + 7}Z" fill="${fill}" stroke="#20262d" stroke-opacity=".35" stroke-width=".6"/>`;
};
const engraveBand = (y, w) => `<path d="M${120 - w} ${y} Q120 ${y + 5} ${120 + w} ${y}" stroke="#4b5560" stroke-width=".8" fill="none" opacity=".7"/><path d="M${120 - w} ${y + 3} Q120 ${y + 8} ${120 + w} ${y + 3}" stroke="#ffffff" stroke-width=".5" fill="none" opacity=".5"/>`;
const laurel = (cx, cy, s = 1, colour = "#6a7580") => {
  const leaf = (a, d) => `<ellipse cx="${cx + Math.cos(a) * d * s}" cy="${cy + Math.sin(a) * d * s}" rx="${3.2 * s}" ry="${1.4 * s}" transform="rotate(${(a * 180) / Math.PI + 90} ${cx + Math.cos(a) * d * s} ${cy + Math.sin(a) * d * s})" fill="${colour}" opacity=".75"/>`;
  return [...Array(7)].map((_, i) => leaf(Math.PI * (0.65 + i * 0.09), 12) + leaf(Math.PI * (0.35 - i * 0.09), 12)).join("");
};

// ---------------------------------------------------------------- designs
const D = {};

D["silver-cup"] = () => `${shadow(140)}${plinth(112)}
  ${lathe([[10, 266], [18, 262], [8, 252], [6, 236], [9, 226], [6, 214], [14, 208], [36, 196], [46, 170], [48, 140], [44, 126], [48, 120]])}
  ${handle("L", 44, 140, 44, 186, 26)}${handle("R", 44, 140, 44, 186, 26)}
  ${ring(120, 48, 6)}<ellipse cx="120" cy="120" rx="44" ry="4.5" fill="url(#bowlInside)"/>
  ${ring(226, 9, 3)}${ring(208, 14, 3)}${engraveBand(150, 44)}${engraveBand(178, 40)}
  ${rim("M163 126 C170 150 168 182 154 198")}${glint(97, 146, 5)}`;

D["championship-cup"] = () => `${shadow(170)}${plinth(130)}
  ${lathe([[12, 266], [22, 260], [9, 250], [7, 232], [12, 222], [8, 214], [22, 206], [62, 186], [72, 160], [68, 146]])}
  ${handle("L", 66, 150, 58, 192, 34)}${handle("R", 66, 150, 58, 192, 34)}
  ${ring(146, 68, 7)}<ellipse cx="120" cy="146" rx="62" ry="5" fill="url(#bowlInside)"/>
  <path d="M74 140 Q120 112 166 140 Q120 132 74 140Z" fill="url(#silver)"/>${ring(140, 46, 5)}
  ${lathe([[6, 128], [10, 118], [4, 108], [7, 100], [2, 92]])}<circle cx="120" cy="90" r="5" fill="url(#gold)"/>
  ${engraveBand(162, 66)}${laurel(120, 176, 1.2)}${ring(222, 12, 3)}
  ${rim("M182 152 C188 170 180 186 160 196")}${glint(92, 160, 6)}`;

D["tall-championship"] = () => `${shadow(130)}${plinth(104)}
  ${lathe([[10, 266], [20, 260], [8, 250], [6, 216], [10, 208], [6, 196], [14, 190], [30, 174], [36, 140], [32, 108], [24, 92], [27, 86]])}
  ${handle("L", 30, 110, 34, 160, 22)}${handle("R", 30, 110, 34, 160, 22)}
  ${ring(86, 27, 4)}${lathe([[24, 86], [22, 74], [10, 64], [8, 58]])}
  ${lathe([[5, 58], [7, 46], [3, 34], [5, 26], [1.5, 16]])}<circle cx="120" cy="14" r="4" fill="url(#gold)"/>
  ${engraveBand(128, 34)}${engraveBand(150, 34)}${ring(208, 10, 3)}${ring(190, 14, 3)}
  ${rim("M148 96 C158 124 158 160 146 178")}${glint(104, 118, 5)}`;

D["silver-bowl"] = () => `${shadow(180)}${plinth(120)}
  ${lathe([[16, 266], [26, 260], [12, 252], [10, 236], [26, 226], [72, 206], [86, 186], [88, 176]])}
  ${ring(176, 88, 12)}<ellipse cx="120" cy="176" rx="82" ry="9" fill="url(#bowlInside)"/>
  <path d="M42 178 Q120 196 198 178" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2" fill="none"/>
  ${[...Array(9)].map((_, i) => `<path d="M${52 + i * 17} 190 Q${60 + i * 17} 206 ${66 + i * 15} 214" stroke="#56606a" stroke-width=".9" fill="none" opacity=".55"/>`).join("")}
  ${ring(236, 12, 3)}${glint(78, 194, 6)}${rim("M196 186 C192 200 176 212 160 218")}`;

D["championship-plate"] = () => `${shadow(150)}${plinth(118)}
  <path d="M110 266 L114 236 L126 236 L130 266Z" fill="url(#silverDark)"/>
  <path d="M96 252 L120 238 L144 252" stroke="url(#silverDark)" stroke-width="6" fill="none"/>
  <circle cx="120" cy="150" r="88" fill="url(#silver)"/><circle cx="120" cy="150" r="88" fill="url(#silverV)" opacity=".4"/>
  <circle cx="120" cy="150" r="80" fill="none" stroke="#5a646e" stroke-width="1.5"/>
  <circle cx="120" cy="150" r="62" fill="url(#silverDark)" opacity=".55"/><circle cx="120" cy="150" r="60" fill="url(#silver)"/>
  ${[...Array(36)].map((_, i) => { const a = (i / 36) * Math.PI * 2; return `<circle cx="${(120 + Math.cos(a) * 71).toFixed(1)}" cy="${(150 + Math.sin(a) * 71).toFixed(1)}" r="2.2" fill="#e8eef3" stroke="#5a646e" stroke-width=".5"/>`; }).join("")}
  <circle cx="120" cy="150" r="30" fill="none" stroke="#56606a" stroke-width="1" stroke-dasharray="2 3"/>
  ${laurel(120, 160, 1.6)}<circle cx="120" cy="140" r="9" fill="url(#gold)"/>
  <path d="M60 104 A72 72 0 0 1 150 80" stroke="#ffffff" stroke-width="3" stroke-opacity=".7" fill="none"/>${glint(78, 112, 6)}`;

D["traditional-shield"] = () => `${shadow(160)}${plinth(124)}
  <path d="M120 40 L196 66 L192 160 C188 210 154 240 120 258 C86 240 52 210 48 160 L44 66Z" fill="url(#silverDark)"/>
  <path d="M120 48 L188 71 L184 160 C180 204 150 230 120 248 C90 230 60 204 56 160 L52 71Z" fill="url(#silver)"/>
  <path d="M120 48 L188 71 L184 160 C180 204 150 230 120 248 C90 230 60 204 56 160 L52 71Z" fill="url(#silverV)" opacity=".5"/>
  <path d="M120 70 L170 86 L167 158 C164 192 144 212 120 226 C96 212 76 192 73 158 L70 86Z" fill="url(#navyEnamel)" stroke="url(#gold)" stroke-width="3"/>
  <path d="M120 86 V214 M78 140 H162" stroke="url(#gold)" stroke-width="5"/>
  <circle cx="120" cy="140" r="17" fill="url(#gold)" stroke="#6d4f16" stroke-width="1"/><circle cx="120" cy="140" r="8" fill="url(#silver)"/>
  ${[[64, 92], [176, 92], [70, 196], [170, 196]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="url(#gold)"/>`).join("")}
  ${rim("M188 71 L184 160 C180 204 150 230 120 248")}${glint(84, 90, 6)}`;

D["wood-silver-shield"] = () => `${shadow(160)}${plinth(124)}
  <path d="M120 34 L200 58 L196 156 C192 210 158 242 120 262 C82 242 48 210 44 156 L40 58Z" fill="url(#wood)"/>
  ${[...Array(12)].map((_, i) => `<path d="M${52 + i * 12} 60 C${48 + i * 12} 120 ${60 + i * 12} 180 ${54 + i * 12} ${230 - Math.abs(i - 5.5) * 8}" stroke="#2b170b" stroke-opacity=".35" stroke-width=".9" fill="none"/>`).join("")}
  <path d="M120 34 L200 58 L196 156 C192 210 158 242 120 262" fill="none" stroke="#c88a52" stroke-opacity=".5" stroke-width="1.4"/>
  <path d="M120 46 L188 66 L185 154 C181 200 152 228 120 246 C88 228 59 200 55 154 L52 66Z" fill="none" stroke="url(#silver)" stroke-width="4"/>
  <path d="M120 74 L160 86 L158 140 C156 166 142 180 120 190 C98 180 84 166 82 140 L80 86Z" fill="url(#silver)" stroke="#4c5560" stroke-width="1"/>
  <circle cx="120" cy="128" r="22" fill="none" stroke="#56606a" stroke-width="1.2"/><circle cx="120" cy="128" r="14" fill="none" stroke="#56606a" stroke-width="1"/>
  <circle cx="120" cy="128" r="4" fill="#9a2b2b"/>
  ${[...Array(3)].flatMap((_, r) => [...Array(2)].map((_, c) => `<rect x="${72 + c * 58}" y="${200 + r * 0}" width="38" height="9" rx="1" fill="url(#silver)" stroke="#4c5560" stroke-width=".5" opacity="${r ? 0 : 1}"/>`)).join("")}
  ${[[66, 72], [174, 72], [120, 216]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="url(#silver)" stroke="#2b170b" stroke-width=".6"/>`).join("")}
  ${glint(96, 92, 5)}`;

D["crystal-column"] = () => `${shadow(120)}${plinth(100)}
  <path d="M96 262 L100 76 L120 52 L140 76 L144 262Z" fill="url(#crystal)" stroke="#e8f7ff" stroke-opacity=".7" stroke-width="1"/>
  <path d="M100 76 L120 98 L140 76 M120 98 V262" stroke="#ffffff" stroke-opacity=".55" stroke-width=".8" fill="none"/>
  <path d="M100 76 L120 98 L120 262 L96 262Z" fill="url(#crystalDeep)" opacity=".55"/>
  <path d="M104 90 L108 250" stroke="#ffffff" stroke-width="3" stroke-opacity=".75" stroke-linecap="round"/>
  <path d="M132 110 L134 240" stroke="#ffffff" stroke-width="1.2" stroke-opacity=".5"/>
  ${[130, 170, 210].map(y => `<path d="M97 ${y} L120 ${y + 10} L143 ${y}" stroke="#d8f1ff" stroke-opacity=".45" fill="none"/>`).join("")}
  <path d="M112 196 L128 196 M114 202 L126 202" stroke="#ffffff" stroke-opacity=".5"/>
  ${lathe([[22, 266], [26, 262], [24, 256]], "url(#silver)")}${glint(108, 70, 6)}${glint(136, 150, 3)}`;

D["cut-glass"] = () => `${shadow(150)}${plinth(116)}
  <path d="M100 266 L104 236 Q120 230 136 236 L140 266Z" fill="url(#crystal)" stroke="#e8f7ff" stroke-opacity=".6"/>
  <path d="M110 236 L114 214 Q120 210 126 214 L130 236Z" fill="url(#crystal)" stroke="#e8f7ff" stroke-opacity=".6"/>
  <path d="M62 92 Q120 78 178 92 L166 170 Q154 210 120 214 Q86 210 74 170Z" fill="url(#crystal)" stroke="#f2fbff" stroke-opacity=".8" stroke-width="1.2"/>
  <path d="M62 92 Q120 106 178 92" stroke="#ffffff" stroke-opacity=".8" fill="none" stroke-width="1.4"/>
  <clipPath id="cg"><path d="M62 92 Q120 78 178 92 L166 170 Q154 210 120 214 Q86 210 74 170Z"/></clipPath>
  <g clip-path="url(#cg)" stroke="#ffffff" stroke-opacity=".42" stroke-width=".9" fill="none">
    ${[...Array(9)].map((_, i) => `<path d="M${40 + i * 20} 90 L${100 + i * 20} 220"/><path d="M${200 - i * 20} 90 L${140 - i * 20} 220"/>`).join("")}
    ${[...Array(5)].map((_, i) => `<path d="M60 ${120 + i * 20} H180" stroke-opacity=".2"/>`).join("")}
  </g>
  <g clip-path="url(#cg)">${[...Array(4)].flatMap((_, r) => [...Array(6)].map((_, c) => `<path d="M${76 + c * 18 + (r % 2) * 9} ${118 + r * 22} l6 -8 l6 8 l-6 8z" fill="#ffffff" opacity=".22"/>`)).join("")}</g>
  <path d="M74 104 Q78 150 90 190" stroke="#ffffff" stroke-width="4" stroke-opacity=".7" fill="none" stroke-linecap="round"/>
  ${glint(150, 112, 5)}${glint(92, 100, 3)}`;

D["metal-sculpture"] = () => `${shadow(140)}${plinth(110)}
  <path d="M112 266 C80 230 70 196 96 168 C122 140 156 140 150 108 C146 82 120 70 128 44 C150 70 174 92 166 128 C158 164 120 170 110 196 C102 218 116 244 130 266Z" fill="url(#gunmetal)"/>
  <path d="M128 44 C150 70 174 92 166 128 C158 164 120 170 110 196 C102 218 116 244 130 266" fill="none" stroke="#e1e9f0" stroke-opacity=".75" stroke-width="1.4"/>
  <path d="M122 266 C104 236 100 206 124 186 C146 168 186 162 180 128 C176 104 160 92 168 66 C188 92 202 118 192 150 C182 186 140 192 136 222 C134 240 140 254 146 266Z" fill="url(#silver)"/>
  <path d="M168 66 C188 92 202 118 192 150 C182 186 140 192 136 222" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.2"/>
  ${[...Array(10)].map((_, i) => `<path d="M${142 + i * 4} ${180 - i * 10} l14 -2" stroke="#ffffff" stroke-opacity=".18"/>`).join("")}
  ${glint(176, 96, 5)}`;

D["dart-sculpture"] = () => `${shadow(140)}${plinth(112)}
  <path d="M82 266 C82 236 98 214 120 214 C142 214 158 236 158 266Z" fill="url(#gunmetal)"/>
  <path d="M90 262 C92 240 104 224 120 224" stroke="#ffffff" stroke-opacity=".35" fill="none"/>
  <path d="M60 250 C52 170 96 96 176 70 C120 110 92 170 96 250Z" fill="url(#silver)"/>
  <path d="M60 250 C52 170 96 96 176 70" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.2" fill="none"/>
  <path d="M96 250 C92 170 120 110 176 70 C150 120 128 180 120 250Z" fill="url(#silverDark)" opacity=".8"/>
  <g transform="rotate(14 120 160)">
    <path d="M119 222 L120 182 L121 222Z" fill="url(#silverDark)"/>
    <path d="M115 184 L115 118 Q120 110 125 118 L125 184 Q120 190 115 184Z" fill="url(#gold)"/>
    ${[...Array(12)].map((_, i) => `<path d="M115 ${124 + i * 5} H125" stroke="#6d4f16" stroke-width="1.2" opacity=".8"/>`).join("")}
    <path d="M117 118 L118 82 L122 82 L123 118Z" fill="url(#gunmetal)"/>
    <path d="M120 86 L98 44 L118 56Z" fill="url(#silver)"/><path d="M120 86 L142 44 L122 56Z" fill="url(#silver)"/>
    <path d="M120 86 V36" stroke="url(#silverDark)" stroke-width="3"/>
  </g>
  <circle cx="120" cy="214" r="3" fill="#ffd0a8"/>${glint(128, 126, 5)}${glint(150, 92, 3)}`;

D["international-globe"] = () => `${shadow(150)}${plinth(118)}
  ${lathe([[14, 266], [22, 260], [10, 250], [8, 220]])}
  <path d="M120 222 C150 216 176 196 184 166" stroke="url(#silver)" stroke-width="7" fill="none"/>
  <path d="M120 222 C90 216 64 196 56 166" stroke="url(#silver)" stroke-width="7" fill="none"/>
  <circle cx="120" cy="140" r="62" fill="url(#globeSea)"/>
  <path d="M86 108 C96 98 112 100 118 110 C122 118 112 124 104 128 C96 132 98 146 90 150 C80 146 76 122 86 108Z M132 92 C146 90 160 98 166 110 C158 116 150 112 142 116 C136 108 128 104 132 92Z M126 150 C138 146 156 152 162 166 C156 180 142 186 132 178 C126 170 120 160 126 150Z" fill="url(#gold)" opacity=".9"/>
  <g fill="none" stroke="#d9e6f2" stroke-opacity=".55" stroke-width=".9">
    <ellipse cx="120" cy="140" rx="62" ry="20"/><ellipse cx="120" cy="140" rx="62" ry="42"/><ellipse cx="120" cy="140" rx="22" ry="62"/><ellipse cx="120" cy="140" rx="44" ry="62"/><path d="M58 140 H182 M120 78 V202"/></g>
  <ellipse cx="120" cy="140" rx="70" ry="70" fill="none" stroke="url(#silver)" stroke-width="5" transform="rotate(-23 120 140)"/>
  <circle cx="100" cy="114" r="20" fill="#ffffff" opacity=".18"/>${glint(96, 108, 6)}`;

D["regional-craft"] = () => `${shadow(150)}${plinth(116)}
  <path d="M96 266 L100 196 C100 184 108 178 120 178 C132 178 140 184 140 196 L144 266Z" fill="url(#wood)"/>
  ${[...Array(6)].map((_, i) => `<path d="M${102 + i * 7} 196 C${101 + i * 7} 220 ${104 + i * 7} 244 ${101 + i * 7} 266" stroke="#2b170b" stroke-opacity=".4" stroke-width=".8" fill="none"/>`).join("")}
  <path d="M100 212 H140 M99 236 H141" stroke="url(#copper)" stroke-width="3"/>
  <path d="M104 182 L92 170 M136 182 L148 170" stroke="url(#woodLight)" stroke-width="7" stroke-linecap="round"/>
  <circle cx="120" cy="116" r="58" fill="url(#woodLight)"/><circle cx="120" cy="116" r="58" fill="none" stroke="url(#copper)" stroke-width="6"/>
  <circle cx="120" cy="116" r="46" fill="#1f1a14"/>
  ${[...Array(20)].map((_, i) => { const a1 = (i / 20) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 1) / 20) * Math.PI * 2 - Math.PI / 2, f = (r) => `${(120 + Math.cos(a1) * r).toFixed(1)} ${(116 + Math.sin(a1) * r).toFixed(1)}`, g = (r) => `${(120 + Math.cos(a2) * r).toFixed(1)} ${(116 + Math.sin(a2) * r).toFixed(1)}`;
    return `<path d="M120 116 L${f(44)} A44 44 0 0 1 ${g(44)}Z" fill="${i % 2 ? "#e8d9b5" : "#2a2420"}"/><path d="M${f(44)} A44 44 0 0 1 ${g(44)} L${g(38)} A38 38 0 0 0 ${f(38)}Z" fill="${i % 2 ? "#3f7a4a" : "#a33a32"}"/><path d="M${f(28)} A28 28 0 0 1 ${g(28)} L${g(24)} A24 24 0 0 0 ${f(24)}Z" fill="${i % 2 ? "#3f7a4a" : "#a33a32"}"/>`; }).join("")}
  <circle cx="120" cy="116" r="6" fill="#3f7a4a"/><circle cx="120" cy="116" r="3" fill="#a33a32"/>
  <path d="M120 116 m-44 0 a44 44 0 1 0 88 0 a44 44 0 1 0 -88 0" fill="none" stroke="url(#copper)" stroke-width="1.5"/>
  ${[...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(120 + Math.cos(a) * 52).toFixed(1)}" cy="${(116 + Math.sin(a) * 52).toFixed(1)}" r="1.6" fill="#ffd0a8"/>`; }).join("")}
  <path d="M76 84 A58 58 0 0 1 120 58" stroke="#ffffff" stroke-opacity=".35" stroke-width="3" fill="none"/>`;

D["vault-geometric"] = () => `${shadow(150)}${plinth(118)}
  <path d="M120 266 L84 246 L84 222 L120 242 L156 222 L156 246Z" fill="url(#gunmetal)"/>
  <path d="M84 222 L120 202 L156 222 L120 242Z" fill="url(#silverDark)"/>
  <g transform="translate(0 -8)">
    <path d="M120 60 L176 92 L176 172 L120 204 L64 172 L64 92Z" fill="url(#gunmetal)" stroke="#9fb0bf" stroke-width="1.2"/>
    <path d="M120 60 L176 92 L120 124 L64 92Z" fill="url(#silverDark)"/>
    <path d="M120 124 L176 92 L176 172 L120 204Z" fill="url(#gunmetal)" opacity=".85"/>
    <path d="M120 74 L162 98 L162 166 L120 190 L78 166 L78 98Z" fill="none" stroke="url(#cyan)" stroke-width="1.6"/>
    <circle cx="120" cy="140" r="26" fill="#11161c" stroke="url(#silver)" stroke-width="4"/>
    ${[...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2; return `<rect x="${(120 + Math.cos(a) * 30 - 3).toFixed(1)}" y="${(140 + Math.sin(a) * 30 - 3).toFixed(1)}" width="6" height="6" fill="url(#silverDark)" transform="rotate(${i * 30} ${(120 + Math.cos(a) * 30).toFixed(1)} ${(140 + Math.sin(a) * 30).toFixed(1)})"/>`; }).join("")}
    <path d="M120 120 V160 M100 140 H140" stroke="url(#cyan)" stroke-width="3"/><circle cx="120" cy="140" r="6" fill="#3fd6ff"/>
    <circle cx="120" cy="140" r="12" fill="none" stroke="#3fd6ff" stroke-opacity=".4"/>
    ${[[80, 104], [160, 104], [80, 160], [160, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#3fd6ff" opacity=".9"/>`).join("")}
    <path d="M64 92 L120 60 L176 92" stroke="#ffffff" stroke-opacity=".6" fill="none"/>
  </g>
  ${glint(96, 74, 5)}`;

D["youth-rising-star"] = () => `${shadow(130)}${plinth(104)}
  ${lathe([[10, 266], [18, 260], [8, 250], [6, 214]], "url(#silver)")}
  <path d="M120 214 C96 196 88 166 104 138 C112 124 124 118 132 106" stroke="url(#silver)" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M120 214 C142 200 152 178 146 154" stroke="url(#gold)" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M138 34 L150 66 L184 68 L157 88 L167 120 L138 101 L109 120 L119 88 L92 68 L126 66Z" fill="url(#gold)" stroke="#6d4f16" stroke-width="1"/>
  <path d="M138 34 L150 66 L184 68 L157 88 L138 78Z" fill="#fff3c4" opacity=".45"/>
  <path d="M138 52 L144 70 L163 71 L148 82 L153 100 L138 90 L123 100 L128 82 L113 71 L132 70Z" fill="none" stroke="#fff3c4" stroke-opacity=".7"/>
  ${[[86, 92, 3], [190, 52, 2.5], [100, 46, 2], [178, 112, 2]].map(([x, y, r]) => glint(x, y, r)).join("")}`;

D["double-crown"] = () => `${shadow(170)}${plinth(132)}
  <path d="M70 266 C70 246 76 232 86 226 H154 C164 232 170 246 170 266Z" fill="url(#navyEnamel)"/>
  <path d="M86 226 H154" stroke="url(#gold)" stroke-width="3"/><path d="M74 252 H166" stroke="url(#gold)" stroke-width="1.5" opacity=".8"/>
  ${ring(222, 50, 5)}
  <path d="M76 218 C74 120 88 70 104 70 C120 70 118 120 116 218" fill="none" stroke="url(#silver)" stroke-width="14"/>
  <path d="M124 218 C122 120 120 70 136 70 C152 70 166 120 164 218" fill="none" stroke="url(#silver)" stroke-width="14"/>
  <path d="M71 210 C71 120 84 64 104 64 M127 210 C127 120 124 64 136 64" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="2"/>
  <path d="M100 150 C110 138 130 138 140 150" stroke="url(#gold)" stroke-width="5" fill="none"/>
  <circle cx="104" cy="62" r="7" fill="url(#gold)"/><circle cx="136" cy="62" r="7" fill="url(#gold)"/>
  <path d="M84 196 H108 M132 196 H156" stroke="url(#gold)" stroke-width="3"/>
  ${glint(80, 120, 5)}${glint(150, 100, 4)}`;

D["open-masters-heritage"] = () => `${shadow(150)}${plinth(118)}
  ${lathe([[12, 266], [24, 260], [10, 250], [8, 236], [14, 230], [36, 216], [44, 186], [42, 150], [30, 120], [20, 104], [22, 94], [28, 86]])}
  <path d="M148 86 C170 80 184 72 196 58 L192 74 C182 88 166 96 146 100Z" fill="url(#silver)"/>
  <path d="M90 104 C60 100 50 130 58 160 C64 182 80 196 90 200 L94 192 C84 184 72 170 68 154 C64 132 72 116 92 118Z" fill="url(#silverDark)"/>
  <path d="M60 140 C56 132 58 124 64 120" stroke="url(#gold)" stroke-width="3" fill="none"/>
  ${ring(86, 28, 4)}${lathe([[24, 86], [18, 76], [8, 70], [9, 62], [3, 54]])}<circle cx="120" cy="52" r="5" fill="url(#gold)"/>
  ${engraveBand(150, 42)}${engraveBand(196, 42)}
  ${[...Array(6)].map((_, i) => `<path d="M${96 + i * 10} 158 c3 6 3 12 0 18 c-3 6 -3 12 0 18" stroke="#56606a" stroke-width=".8" fill="none" opacity=".6"/>`).join("")}
  ${laurel(120, 174, 1, "#8a6a2a")}${ring(230, 14, 3, "url(#gold)")}
  ${rim("M160 120 C166 150 166 190 154 214")}${glint(100, 130, 5)}`;

D["sovereign"] = () => `${shadow(130)}${plinth(108)}
  <path d="M100 266 L104 236 L136 236 L140 266Z" fill="url(#silverDark)"/>
  <path d="M104 236 C98 196 92 150 104 104 C110 78 116 46 120 18 C126 50 134 82 140 108 C150 150 144 196 136 236Z" fill="url(#silver)"/>
  <path d="M104 236 C98 196 92 150 104 104 C110 78 116 46 120 18 C126 50 134 82 140 108 C150 150 144 196 136 236Z" fill="url(#silverV)" opacity=".4"/>
  <path d="M120 18 C118 70 112 130 116 236" stroke="#ffffff" stroke-opacity=".85" stroke-width="2.2" fill="none"/>
  <path d="M120 18 C130 80 140 150 132 236" stroke="#4c5560" stroke-opacity=".7" stroke-width="1.2" fill="none"/>
  <path d="M104 104 C118 116 132 112 140 108 M98 150 C114 162 136 160 146 150 M100 196 C116 206 132 204 142 196" stroke="#5f6a75" stroke-width="1" fill="none" opacity=".75"/>
  <path d="M106 128 C114 120 126 120 134 128 L130 156 C124 160 116 160 110 156Z" fill="url(#silverDark)" opacity=".55"/>
  <path d="M92 236 C80 200 84 170 96 150" stroke="url(#silver)" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M148 236 C160 200 156 170 144 150" stroke="url(#silver)" stroke-width="4" fill="none" stroke-linecap="round"/>
  ${glint(120, 22, 6)}${glint(110, 120, 4)}`;

// ---------------------------------------------------------------- non-trophy recognitions
D["recognition-plaque"] = () => `${shadow(150)}
  <rect x="50" y="70" width="140" height="190" rx="10" fill="url(#wood)"/>
  ${[...Array(9)].map((_, i) => `<path d="M${58 + i * 15} 76 C${56 + i * 15} 140 ${62 + i * 15} 200 ${58 + i * 15} 254" stroke="#2b170b" stroke-opacity=".35" fill="none"/>`).join("")}
  <rect x="50" y="70" width="140" height="190" rx="10" fill="none" stroke="#c88a52" stroke-opacity=".45" stroke-width="1.5"/>
  <rect x="66" y="92" width="108" height="120" rx="4" fill="url(#plate)" stroke="#5a4214"/>
  <rect x="72" y="98" width="96" height="108" rx="2" fill="none" stroke="#fff3c4" stroke-opacity=".6"/>
  <circle cx="120" cy="140" r="22" fill="none" stroke="#5a4214" stroke-width="1.2"/><circle cx="120" cy="140" r="14" fill="none" stroke="#5a4214"/><circle cx="120" cy="140" r="4" fill="#5a4214"/>
  <rect x="84" y="280" width="72" height="18" rx="2" fill="url(#plate)" opacity="0"/>
  ${[[60, 80], [180, 80], [60, 250], [180, 250]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="url(#silver)"/>`).join("")}`;

D["recognition-medal"] = () => `${shadow(110)}
  <path d="M92 40 L120 128 L148 40Z" fill="#1d3d6e"/><path d="M104 40 L120 100 L136 40Z" fill="#e9c77a"/>
  <path d="M80 40 L106 128 M160 40 L134 128" stroke="#0d1b33" stroke-width="10"/>
  <circle cx="120" cy="180" r="56" fill="url(#gold)"/><circle cx="120" cy="180" r="46" fill="none" stroke="#6d4f16" stroke-width="1.5"/>
  ${laurel(120, 194, 1.6, "#6d4f16")}<path d="M120 152 l7 14 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2z" fill="#fff3c4" opacity=".85"/>
  <path d="M78 156 A46 46 0 0 1 120 134" stroke="#ffffff" stroke-opacity=".6" stroke-width="3" fill="none"/>`;

// ---------------------------------------------------------------- write
mkdirSync(OUT, { recursive: true });
const ids = Object.keys(D);
for (const id of ids) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${id}">
<!-- TKDL Career premium trophy artwork · ${id} · generated by scripts/build-career-trophies.mjs -->
<defs>${MATERIALS}</defs>
${D[id]().replace(/\n\s+/g, "\n")}
</svg>
`;
  writeFileSync(path.join(OUT, `${id}.svg`), svg);
}
console.log(`wrote ${ids.length} trophy artworks to ${path.relative(process.cwd(), OUT)}`);
