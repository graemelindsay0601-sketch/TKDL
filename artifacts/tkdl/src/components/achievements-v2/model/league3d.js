/**
 * Achievements v2, League art: one award piece per track, each built at the detail level of the Career trophies
 * (multi-material, ornament, engraved plinth) and made in five finishes. The finish changes materials, trim and plinth,
 * not just colour: Bronze on walnut, Silver on ebony, Gold on ebony with red enamel, Platinum on navy enamel with set
 * stones, Diamond in crystal and platinum with a lit core.
 */
import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { woodTexture, brushedRoughness, dartboardTexture } from "./trophies3d.js";

const V = (x, y) => new THREE.Vector2(x, y);
const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const smooth = (pts, mat, seg = 192, div = 160) => new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([x, y]) => V(x, y))).getPoints(div), seg), mat);
const ring = (R, r, mat, y = 0) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 24, 192), mat); m.rotation.x = Math.PI / 2; m.position.y = y; return m; };
const tube = (pts, r, mat, seg = 240) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 24, false), mat);
const ball = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat);
const extrude = (shape, depth, mat, bevel = 0.012) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 48 }); g.translate(0, 0, -depth / 2); return new THREE.Mesh(g, mat); };
/** A row of beads round a circle. */
const beads = (g, R, r, y, n, mat) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.add(at(ball(r, mat), Math.cos(a) * R, y, Math.sin(a) * R)); } };
/** A lathe whose radius is modulated by flutes between t0 and t1 of its height (gadrooning, fluting, twisted ribs). */
function fluted(pts, flutes, depth, mat, { t0 = 0, t1 = 1, twist = 0, seg = 256, div = 200 } = {}) {
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([x, y]) => V(x, y))).getPoints(div), seg), pos = geo.attributes.position;
  const y0 = pts[0][1], y1 = pts.at(-1)[1];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z); if (r < 1e-5) continue;
    const t = (pos.getY(i) - y0) / (y1 - y0); if (t < t0 || t > t1) continue;
    const env = Math.sin(Math.PI * (t - t0) / (t1 - t0)), a = Math.atan2(z, x);
    const k = 1 + depth * env * (Math.abs(Math.cos((flutes / 2) * (a + twist * t))) * 2 - 1);
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals(); return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------- engraving (bump maps drawn on canvas, wrapped round lathes)
const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
/** Scrolling filigree: S-curves with leaf tips between two fine border lines, repeated round the piece. */
export const filigree = (rep = 8) => canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); g.lineCap = "round";
  const line = (col, lw, fn) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); fn(); g.stroke(); };
  for (const [c, lw] of [["#2a2a2a", 9], ["#d8d8d8", 3]]) {
    line(c, lw, () => { g.moveTo(0, h / 2); g.bezierCurveTo(w * .25, h * .05, w * .25, h * .95, w * .5, h / 2); g.bezierCurveTo(w * .75, h * .05, w * .75, h * .95, w, h / 2); });
    for (const [x, y, d] of [[w * .18, h * .3, -1], [w * .32, h * .7, 1], [w * .68, h * .3, -1], [w * .82, h * .7, 1]]) {
      line(c, lw * .8, () => { g.moveTo(x, y); g.quadraticCurveTo(x + 40, y + d * 40, x + 10, y + d * 70); });
      line(c, lw * .8, () => { g.moveTo(x, y); g.quadraticCurveTo(x - 30, y + d * 30, x - 5, y + d * 60); }); }
    line(c, lw * .6, () => { g.moveTo(0, h * .06); g.lineTo(w, h * .06); g.moveTo(0, h * .94); g.lineTo(w, h * .94); });
  }
  for (let x = 0; x < w; x += 16) { g.fillStyle = "#3a3a3a"; g.beginPath(); g.arc(x + 8, h * .06, 3, 0, 7); g.fill(); g.beginPath(); g.arc(x + 8, h * .94, 3, 0, 7); g.fill(); }
}, [rep, 1]);
/** Fine hammered texture for bronze and for the peak (catches light like hand-finished metal). */
export const hammered = (seed = 9) => { const r = rng(seed); return canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, rad = 6 + r() * 14, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(40,40,40,.35)"); gr.addColorStop(.7, "rgba(200,200,200,.18)"); gr.addColorStop(1, "rgba(128,128,128,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } }, [3, 3]); };
/** Concentric guilloché rings with sunburst rays: the backplate of the board piece and the plaques. */
export const sunburst = () => canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const c = w / 2;
  for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2; g.strokeStyle = i % 2 ? "#a8a8a8" : "#5a5a5a"; g.lineWidth = 3; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 1.5, c + Math.sin(a) * c * 1.5); g.stroke(); } });
export const guilloche = () => canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const c = w / 2;
  g.strokeStyle = "#c8c8c8"; g.lineWidth = 2; for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 1.5, c + Math.sin(a) * c * 1.5); g.stroke(); }
  g.strokeStyle = "#404040"; g.lineWidth = 3; for (let r = 30; r < c * 1.4; r += 22) { g.beginPath(); for (let k = 0; k <= 360; k++) { const a = k / 360 * Math.PI * 2, rr = r + Math.sin(a * 24) * 5; k ? g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr) : g.moveTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.stroke(); } });
const engrave = (mat, tex, scale = 1.6) => { const m = mat.clone(); m.bumpMap = tex; m.bumpScale = scale; return m; };

// ---------------------------------------------------------------- the five finishes
export const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
export function kit(tier) {
  const brush = brushedRoughness(5);
  const metal = (color, rough, extra = {}) => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, clearcoat: 0.35, clearcoatRoughness: 0.05, ...extra });
  const enamel = (color) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.05, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 });
  const gem = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0, clearcoat: 1, envMapIntensity: 4.5, iridescence: 0.8, iridescenceIOR: 2.0, flatShading: true });
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xd8f6ff, metalness: 0.1, roughness: 0, transparent: true, opacity: 0.7, envMapIntensity: 5, clearcoat: 1,
    iridescence: 0.9, iridescenceIOR: 1.7, flatShading: true, side: THREE.DoubleSide });
  const ebony = new THREE.MeshPhysicalMaterial({ color: 0x07080a, metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
  const walnut = new THREE.MeshPhysicalMaterial({ map: woodTexture(17, "#4a2812", "#7d4a26", "#241206"), roughness: 0.4, clearcoat: 0.85, clearcoatRoughness: 0.08 });
  const silver = metal(0xe7eaee, 0.06), gold = metal(0xf2c25a, 0.09);
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xf6d896, metalness: 1, roughness: 0.38, roughnessMap: brush, anisotropy: 0.4, envMapIntensity: 2.6 });
  const ink = new THREE.MeshPhysicalMaterial({ color: 0x1a1208, metalness: 0.6, roughness: 0.5 });
  switch (tier) {
    case "BRONZE": { const main = metal(0xc98552, 0.22, { bumpMap: hammered(9), bumpScale: 0.5 }); const accent = metal(0x9a5a30, 0.3);
      return { tier, main, accent, bright: metal(0xe0a070, 0.12), enamel: enamel(0x1f3b2a), plinth: walnut, plinthTop: walnut, trim: accent, plate: brass, ink, gem: null, crystal: null, glow: null }; }
    case "SILVER": return { tier, main: silver, accent: metal(0xc9ced6, 0.22, { roughnessMap: brush }), bright: silver, enamel: enamel(0x15284a), plinth: ebony, plinthTop: ebony, trim: silver, plate: brass, ink, gem: null, crystal: null, glow: null };
    case "GOLD": return { tier, main: gold, accent: metal(0xe0b04d, 0.3, { roughnessMap: brush }), bright: metal(0xffd877, 0.06), enamel: enamel(0x8a1820), plinth: ebony, plinthTop: ebony, trim: gold, plate: gold, ink, gem: null, crystal: null, glow: null };
    case "PLATINUM": { const plat = metal(0xe3edf6, 0.05, { clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.25, iridescenceIOR: 1.4 });
      return { tier, main: plat, accent: metal(0xb9c7d6, 0.2, { roughnessMap: brush }), bright: plat, enamel: enamel(0x122b5e), plinth: enamel(0x0d1f45), plinthTop: ebony, trim: plat, plate: plat, ink, gem, crystal: null, glow: null }; }
    case "DIAMOND": { const plat = metal(0xeef6ff, 0.04, { clearcoat: 1, clearcoatRoughness: 0.01, iridescence: 0.5, iridescenceIOR: 1.6 });
      const glow = new THREE.MeshStandardMaterial({ color: 0x07303c, emissive: 0x6fe9ff, emissiveIntensity: 6 });
      const ice = new THREE.MeshPhysicalMaterial({ color: 0xcff4ff, metalness: 0.55, roughness: 0.0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 3.6,
        iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 600], flatShading: true });
      return { tier, main: ice, accent: plat, bright: plat, enamel: enamel(0x0b2d66), plinth: enamel(0x081a3a), plinthTop: crystal, trim: plat, plate: plat, ink, gem, crystal, glow }; }
    case "SHOWPIECE": { const g = kit("GOLD"); g.tier = tier; g.gem = gem; g.enamel = enamel(0x5a1020); g.plinth = enamel(0x0d1f45); g.glow = new THREE.MeshStandardMaterial({ color: 0x302000, emissive: 0xffc04a, emissiveIntensity: 4 }); return g; }
  }
  throw new Error("tier " + tier);
}

// ---------------------------------------------------------------- plinth with an engraved plate
/** Stepped plinth, top surface at y = 0. The engraved name sits on the front plate. */
export function plinth(K, font, name, w = 1.75, d = 1.2) {
  const g = new THREE.Group();
  const satin = K.plinth.clone(); satin.envMapIntensity = (K.plinth.envMapIntensity ?? 1) * 0.3; satin.clearcoatRoughness = 0.35; satin.roughness = Math.max(0.4, K.plinth.roughness ?? 0.4);
  const box = (bw, bh, bd, mat, y, r = 0.04) => g.add(at(new THREE.Mesh(new RoundedBoxGeometry(bw, bh, bd, 6, r), mat), 0, y, 0));
  // moulded base: foot, cove, bead, body, bead, cap
  box(w * 1.08, 0.06, d * 1.08, satin, -0.53, 0.02);
  box(w * 1.03, 0.04, d * 1.03, K.trim, -0.485, 0.015);
  box(w, 0.36, d, satin, -0.29, 0.03);
  box(w * 1.015, 0.025, d * 1.015, K.trim, -0.105, 0.01);
  box(w * 0.92, 0.09, d * 0.9, K.plinthTop === K.crystal ? satin : K.plinthTop, -0.045, 0.03);
  box(w * 0.86, 0.02, d * 0.84, K.trim, 0.0, 0.008);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(ball(0.035, K.trim), sx * w * 0.5, -0.54, sz * d * 0.5));
  if (K.glow) { box(w * 1.035, 0.012, d * 1.035, K.glow, -0.46, 0.005); if (K.crystal) box(w * 0.88, 0.075, d * 0.86, K.crystal, -0.045, 0.03); }
  // cartouche: a framed plate with a guilloché field and a raised rope edge
  const pw = 1.12, ph = 0.2, pz = d / 2 + 0.006;
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(pw + 0.06, ph + 0.06, 0.02, 4, 0.02), K.trim), 0, -0.29, pz));
  const field = engrave(K.plate, guilloche(), 0.25); field.bumpMap.repeat.set(1, 0.2);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(pw, ph, 0.03, 4, 0.01), field), 0, -0.29, pz + 0.006));
  const edge = []; for (let i = 0; i <= 80; i++) { const t = i / 80 * Math.PI * 2; edge.push([Math.sign(Math.cos(t)) * Math.min(1, Math.abs(Math.cos(t)) * 1.6) * (pw / 2 + 0.012), Math.sign(Math.sin(t)) * Math.min(1, Math.abs(Math.sin(t)) * 1.6) * (ph / 2 + 0.012) - 0.29, pz + 0.024]); }
  g.add(tube(edge, 0.006, K.bright, 200));
  for (const sx of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), K.gem ?? K.bright), sx * (pw / 2 - 0.04), -0.29, pz + 0.03));
  if (font && name) {
    const tg = new TextGeometry(name.toUpperCase(), { font, size: 0.068, depth: 0.008, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2 });
    tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
    const sx = Math.min(1, 0.9 / (bb.max.x - bb.min.x));
    const txt = new THREE.Mesh(tg, K.ink); txt.scale.set(sx, 1, 1); txt.position.set(0, -0.29, pz + 0.022); g.add(txt);
  }
  if (K.gem) for (let i = 0; i < 11; i++) { const x = -w * 0.4 + (i / 10) * w * 0.8; const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem); st.scale.y = 0.6; st.position.set(x, -0.045, d * 0.45 + 0.01); st.rotation.x = Math.PI / 2; g.add(st); }
  return g;
}

/** A thin engraved band laid over a lathe between two heights (r0 at y0, r1 at y1). */
const band = (r0, y0, r1, y1, mat, rep = 8, k = 1.8) => { const m = engrave(mat, filigree(rep), k);
  return new THREE.Mesh(new THREE.LatheGeometry([V(r0, y0), V((r0 + r1) / 2 + 0.002, (y0 + y1) / 2), V(r1, y1)], 256), m); };

// ---------------------------------------------------------------- darts (shared)
export function dart(K, flightMat) {
  const g = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd6dadf, metalness: 1, roughness: 0.25 });
  g.add(smooth([[0, 0], [0.006, 0.01], [0.012, 0.2], [0.016, 0.24], [0, 0.245]], steel, 48, 40));
  g.add(fluted([[0, 0.24], [0.034, 0.25], [0.045, 0.3], [0.048, 0.52], [0.04, 0.62], [0.022, 0.65], [0, 0.66]], 36, 0.08, K.bright, { t0: 0.12, t1: 0.85, seg: 96, div: 80 }));
  for (const y of [0.32, 0.36, 0.5, 0.54]) g.add(ring(0.049, 0.004, K.accent, y));
  g.add(smooth([[0, 0.64], [0.016, 0.65], [0.014, 0.9], [0.02, 0.93], [0, 0.94]], new THREE.MeshPhysicalMaterial({ color: 0x15181c, metalness: 0.4, roughness: 0.25, clearcoat: 1 }), 48, 40));
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(0.13, 0.1); fs.quadraticCurveTo(0.15, 0.2, 0.13, 0.27); fs.lineTo(0, 0.22);
  for (let i = 0; i < 4; i++) { const f = extrude(fs.clone(), 0.004, flightMat, 0.002); const h = new THREE.Group(); f.position.set(0.012, 0.73, 0); h.add(f); h.rotation.y = i * Math.PI / 2; g.add(h); }
  return g;
}

// ---------------------------------------------------------------- pieces
export const PIECES = {};

/** League wins: a lidded victory cup with gadrooned foot, fluted bowl, laurel garland, scroll handles and a dart-flight finial. */
PIECES["league-wins"] = { name: "League wins", build(K) {
  const g = new THREE.Group();
  g.add(fluted([[0, 0], [0.5, 0], [0.52, 0.03], [0.5, 0.07], [0.4, 0.14], [0.28, 0.2], [0.18, 0.24], [0, 0.25]], 32, 0.07, K.main, { t0: 0.25, t1: 0.95 }));
  g.add(ring(0.51, 0.016, K.trim, 0.035)); beads(g, 0.465, 0.014, 0.085, 56, K.bright);
  g.add(smooth([[0, 0.24], [0.12, 0.25], [0.07, 0.32], [0.06, 0.42], [0.11, 0.48], [0.13, 0.52], [0.11, 0.56], [0.06, 0.62], [0.08, 0.7], [0, 0.72]], K.main));
  g.add(ring(0.132, 0.012, K.trim, 0.52)); g.add(ring(0.075, 0.01, K.trim, 0.62));
  // bowl: fluted lower half, plain upper band carrying the garland and a medallion
  const bowl = [[0.08, 0.7], [0.22, 0.74], [0.42, 0.84], [0.56, 0.98], [0.62, 1.14], [0.63, 1.34], [0.66, 1.44], [0.68, 1.47]];
  g.add(fluted(bowl, 28, 0.06, K.main, { t0: 0.0, t1: 0.42 }));
  g.add(smooth([[0.64, 1.47], [0.6, 1.4], [0.58, 1.1], [0.35, 0.85], [0, 0.8]], K.main));
  g.add(ring(0.675, 0.018, K.trim, 1.46)); g.add(ring(0.6, 0.012, K.trim, 1.02)); beads(g, 0.632, 0.011, 1.38, 72, K.bright);
  g.add(band(0.6305, 1.27, 0.6325, 1.36, K.main, 10, 2.2));                 // engraved scroll band above the garland
  g.add(band(0.575, 1.05, 0.6, 1.13, K.main, 12, 1.6));                     // and a finer one below it
  g.add(band(0.46, 0.06, 0.33, 0.13, K.main, 10, 1.4));                     // and round the foot
  // laurel garland: paired leaves round the upper bowl, tied at the front
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.03, 0.035, 0.085, 0); ls.quadraticCurveTo(0.03, -0.035, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 16 });
  g.add(ring(0.633, 0.006, K.accent, 1.2));
  for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, side = i % 2 ? 1 : -1;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue; // leave room for the medallion
    const l = new THREE.Mesh(leafGeo, K.accent); const h = new THREE.Group(); l.rotation.z = side * 0.6; h.add(l);
    h.position.set(Math.cos(a) * 0.64, 1.2, Math.sin(a) * 0.64); h.rotation.y = -a + Math.PI / 2; g.add(h); }
  // front medallion: enamel roundel with a raised dart and a fine rope edge
  const med = new THREE.Group();
  med.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 64).rotateX(Math.PI / 2), K.accent));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.125, 96), new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.6, clearcoat: 0.6 })); face.position.z = 0.017; med.add(face);
  med.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 16, 96), K.trim), 0, 0, 0.012));
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; med.add(at(ball(0.006, K.bright), Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.03)); }
  med.position.set(0, 1.2, 0.64); med.rotation.x = -0.05; g.add(med);
  // scroll handles with curled terminals
  for (const s of [-1, 1]) {
    g.add(tube([[s * 0.6, 1.36, 0], [s * 0.86, 1.4, 0], [s * 0.96, 1.22, 0], [s * 0.86, 1.0, 0], [s * 0.66, 0.92, 0]], 0.032, K.main));
    g.add(tube([[s * 0.86, 1.4, 0], [s * 0.97, 1.5, 0], [s * 1.04, 1.44, 0], [s * 1.0, 1.36, 0], [s * 0.94, 1.39, 0]], 0.02, K.trim));
    g.add(at(ball(0.035, K.trim), s * 0.66, 0.92, 0));
    // cast acanthus beads running down the outer curve of each handle
    const hc = new THREE.CatmullRomCurve3([[s * 0.6, 1.36, 0], [s * 0.86, 1.4, 0], [s * 0.96, 1.22, 0], [s * 0.86, 1.0, 0], [s * 0.66, 0.92, 0]].map(p => new THREE.Vector3(...p)));
    for (let i = 1; i < 14; i++) { const p = hc.getPoint(i / 14), n = new THREE.Vector3(p.x, 0, 0).normalize().multiplyScalar(0.03); const b = ball(0.016, K.bright); b.position.copy(p).add(n); g.add(b); }
  }
  // domed lid, bead edge, knop and a four-flight finial
  g.add(fluted([[0, 1.47], [0.66, 1.47], [0.65, 1.52], [0.5, 1.62], [0.3, 1.72], [0.12, 1.78], [0, 1.79]], 24, 0.05, K.main, { t0: 0.35, t1: 0.95 }));
  beads(g, 0.6, 0.013, 1.51, 64, K.bright); g.add(ring(0.31, 0.012, K.trim, 1.71));
  g.add(smooth([[0, 1.78], [0.06, 1.8], [0.04, 1.86], [0.08, 1.92], [0.03, 1.98], [0, 1.99]], K.trim));
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.lineTo(0.14, 0.12); fl.quadraticCurveTo(0.16, 0.24, 0.12, 0.3); fl.lineTo(0, 0.26);
  for (let i = 0; i < 4; i++) { const f = extrude(fl.clone(), 0.012, K.enamel, 0.006); const h = new THREE.Group(); f.position.set(0.02, 1.98, 0); h.add(f); h.rotation.y = i * Math.PI / 2 + Math.PI / 4; g.add(h); }
  if (K.gem) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem); s.position.set(Math.cos(a) * 0.12, 0.52, Math.sin(a) * 0.12); g.add(s); }
    g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 1.2, 0.81)); }
  if (K.glow) g.add(ring(0.6, 0.012, K.glow, 1.02));
  return g; } };

/** 180s: an upright section of a regulation board round the 20, wired in the tier metal, with three darts in the treble 20. */
PIECES["league-180s"] = { name: "Maximums", ry: -0.12, build(K, font) {
  const g = new THREE.Group();
  const R = 1.25, cx = 0, cy = 0.12;                    // board centre sits just above the plinth; we show the top wedge
  const SPAN = (18 * 3 / 180) * Math.PI;               // 5, 20, 1
  const rings = [0, 0.1, 0.58, 0.63, 0.95, 1.0]; // bull, outer bull, single, treble, single, double
  const tex = dartboardTexture();
  // the face: a sector cut from the textured board disc (regulation colours, not tinted)
  const face = new THREE.Mesh(new THREE.CircleGeometry(R, 256, Math.PI / 2 - SPAN / 2, SPAN), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.82, sheen: 0.4 }));
  const uv = face.geometry.attributes.uv, pos = face.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (pos.getX(i) / R) * 0.48, 0.5 + (pos.getY(i) / R) * 0.48);
  face.position.set(cx, cy, 0.084); g.add(face);
  // body: a thick metal-backed wedge so it reads as a sculpture, not a sticker
  const wedge = new THREE.Shape(); wedge.moveTo(0, 0); wedge.absarc(0, 0, R + 0.08, Math.PI / 2 + SPAN / 2 + 0.03, Math.PI / 2 - SPAN / 2 - 0.03, true); wedge.lineTo(0, 0);
  const body = extrude(wedge, 0.12, K.main, 0.02); body.position.set(cx, cy, 0); g.add(body);
  // sunburst backplate behind the wedge, engine-turned
  const back = new THREE.Shape(); back.moveTo(0, 0); back.absarc(0, 0, R + 0.32, Math.PI / 2 + SPAN / 2 + 0.28, Math.PI / 2 - SPAN / 2 - 0.28, true); back.lineTo(0, 0);
  const bp = extrude(back, 0.04, engrave(K.accent, sunburst(), 0.4), 0.015);
  { const uvb = bp.geometry.attributes.uv, pb = bp.geometry.attributes.position; for (let i = 0; i < uvb.count; i++) uvb.setXY(i, 0.5 + pb.getX(i) / (2 * (R + 0.4)), 0.5 + pb.getY(i) / (2 * (R + 0.4))); }
  bp.position.set(cx, cy, -0.09); g.add(bp);
  const brim = []; for (let i = 0; i <= 120; i++) { const a = Math.PI / 2 - SPAN / 2 - 0.28 + (i / 120) * (SPAN + 0.56); brim.push([cx + Math.cos(a) * (R + 0.32), cy + Math.sin(a) * (R + 0.32), -0.07]); }
  g.add(tube(brim, 0.022, K.trim, 200));
  for (let i = 0; i <= 18; i++) { const a = Math.PI / 2 - SPAN / 2 - 0.28 + (i / 18) * (SPAN + 0.56); g.add(at(ball(0.02, K.bright), cx + Math.cos(a) * (R + 0.26), cy + Math.sin(a) * (R + 0.26), -0.04)); }
  // ribbon banner across the foot carrying 180
  const rib = new THREE.Shape(); rib.moveTo(-0.5, -0.07); rib.lineTo(0.5, -0.07); rib.lineTo(0.58, 0); rib.lineTo(0.5, 0.07); rib.lineTo(-0.5, 0.07); rib.lineTo(-0.58, 0); rib.lineTo(-0.5, -0.07);
  const banner = extrude(rib, 0.03, K.enamel, 0.01); banner.position.set(cx, cy + 0.26, 0.12); g.add(banner);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.012, 0.035, 2, 0.005), K.trim), cx, cy + 0.33, 0.12)); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.012, 0.035, 2, 0.005), K.trim), cx, cy + 0.19, 0.12));
  if (font) { const tg = new TextGeometry("180", { font, size: 0.09, depth: 0.02, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3 });
    tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0); g.add(at(new THREE.Mesh(tg, K.bright), cx, cy + 0.26, 0.14)); }
  // spider wire: rings and radials in the tier's bright metal
  for (const r of rings.slice(1)) { const arc = []; for (let i = 0; i <= 64; i++) { const a = Math.PI / 2 - SPAN / 2 + (i / 64) * SPAN; arc.push([cx + Math.cos(a) * r * R, cy + Math.sin(a) * r * R, 0.09]); } g.add(tube(arc, 0.007, K.bright, 96)); }
  for (let k = 0; k <= 3; k++) { const a = Math.PI / 2 - SPAN / 2 + k * (SPAN / 3); g.add(tube([[cx + Math.cos(a) * 0.1 * R, cy + Math.sin(a) * 0.1 * R, 0.09], [cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98, 0.09]], 0.007, K.bright, 8)); }
  // number ring: 5, 20, 1 raised in the tier metal on the rim
  if (font) ["5", "20", "1"].forEach((n, i) => { const a = Math.PI / 2 + SPAN / 3 - i * (SPAN / 3);
    const tg = new TextGeometry(n, { font, size: 0.09, depth: 0.025, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 3 });
    tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
    const m = new THREE.Mesh(tg, K.bright); m.position.set(cx + Math.cos(a) * R * 0.975, cy + Math.sin(a) * R * 0.975, 0.09); m.rotation.z = a - Math.PI / 2; g.add(m); });
  // outer rim and a bead band
  const rim = []; for (let i = 0; i <= 96; i++) { const a = Math.PI / 2 - SPAN / 2 - 0.03 + (i / 96) * (SPAN + 0.06); rim.push([cx + Math.cos(a) * (R + 0.08), cy + Math.sin(a) * (R + 0.08), 0.06]); }
  g.add(tube(rim, 0.03, K.trim, 160));
  // three darts grouped tight in the treble 20
  const flight = K.enamel;
  [[-0.05, 0.005, 0.05, -0.12], [0.05, 0.012, -0.04, 0.12], [0.0, -0.02, 0.0, 0.0]].forEach(([dx, dy, tilt, roll]) => {
    const d = dart(K, flight); d.scale.setScalar(1.0);
    d.rotation.set(Math.PI / 2 - 0.5 + tilt, 0, -roll); d.position.set(cx + dx * R, cy + 0.605 * R + dy * R, 0.075); g.add(d); });
  // collar where the sculpture meets the plinth
  g.add(smooth([[0, 0], [0.34, 0], [0.36, 0.03], [0.3, 0.08], [0.22, 0.14], [0, 0.15]], K.accent)); g.add(ring(0.35, 0.014, K.trim, 0.03));
  if (K.gem) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem); s.position.set(cx, cy + R + 0.14, 0.04); g.add(s); }
  if (K.glow) { const arc = []; for (let i = 0; i <= 96; i++) { const a = Math.PI / 2 - SPAN / 2 + (i / 96) * SPAN; arc.push([cx + Math.cos(a) * (R + 0.04), cy + Math.sin(a) * (R + 0.04), 0.02]); } g.add(tube(arc, 0.012, K.glow, 128)); }
  g.position.y = 0; return g; } };

/** Winning run: a ceremonial torch — spiral-ribbed grip, banded collar with five studs for a run, and a sculpted flame. */
PIECES["winning-run"] = { name: "Winning run", build(K) {
  const g = new THREE.Group();
  g.add(smooth([[0, 0], [0.36, 0], [0.38, 0.03], [0.3, 0.1], [0.14, 0.18], [0, 0.19]], K.accent)); g.add(ring(0.37, 0.014, K.trim, 0.03));
  g.add(fluted([[0.06, 0.18], [0.075, 0.24], [0.09, 0.6], [0.11, 0.95], [0.14, 1.06], [0, 1.07]], 10, 0.14, K.main, { t0: 0.05, t1: 0.88, twist: 5 }));
  for (const y of [0.22, 0.62]) g.add(ring(0.095, 0.014, K.trim, y));
  // collar and cup
  g.add(smooth([[0, 1.02], [0.16, 1.03], [0.2, 1.08], [0.18, 1.14], [0.3, 1.28], [0.36, 1.38], [0.34, 1.42], [0.24, 1.36], [0, 1.34]], K.main));
  g.add(ring(0.19, 0.016, K.trim, 1.09)); beads(g, 0.345, 0.012, 1.4, 48, K.bright);
  g.add(band(0.2, 1.15, 0.33, 1.34, K.main, 8, 2.0));
  const wrap = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * Math.PI * 6; wrap.push([Math.cos(a) * (0.1 + t * 0.03), 0.28 + t * 0.7, Math.sin(a) * (0.1 + t * 0.03)]); }
  g.add(tube(wrap, 0.012, K.trim, 320));
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.42; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem ?? K.bright), Math.cos(a) * 0.2, 1.165, -Math.sin(a) * 0.2)); }
  // flame: a glowing core with pointed tongues licking up and out of the cup
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x2a0a00, emissive: K.glow ? 0x6fe9ff : K.tier === "BRONZE" ? 0xff5a10 : 0xff8a1a, emissiveIntensity: K.glow ? 2.2 : 2.6 });
  g.add(fluted([[0, 1.34], [0.12, 1.42], [0.14, 1.6], [0.1, 1.82], [0.04, 2.0], [0, 2.05]], 6, 0.3, coreMat, { twist: 2.5, seg: 96, div: 80 }));
  const tongueMat = K.crystal ?? K.bright;
  const tongue = (h, w, lean, rot, twist) => { const m = fluted([[0, 0], [w, 0.12 * h], [w * 1.05, 0.38 * h], [w * 0.7, 0.66 * h], [w * 0.25, 0.9 * h], [0, h]], 4, 0.35, tongueMat, { twist, seg: 64, div: 80 });
    const pivot = new THREE.Group(); m.rotation.z = lean; pivot.add(m); pivot.rotation.y = rot; pivot.position.y = 1.36; return pivot; };
  [[1.05, 0.11, 0.0, 0, 2.6], [0.82, 0.1, 0.3, 0.3, 3], [0.78, 0.1, 0.32, 2.4, -3], [0.7, 0.09, 0.36, 4.4, 3], [0.6, 0.085, 0.44, 1.4, -2.6], [0.56, 0.08, 0.46, 3.4, 2.8], [0.52, 0.075, 0.5, 5.4, -3], [0.44, 0.07, 0.6, 0.9, 2], [0.42, 0.07, 0.62, 3.0, -2], [0.4, 0.065, 0.64, 5.0, 2]]
    .forEach(([h, w, lean, rot, tw]) => g.add(tongue(h, w, lean, rot, tw)));
  return g; } };

/** Peak Elo: a faceted summit ringed by a rising ribbon, a flag at the top and a star finial. */
PIECES["peak-elo"] = { name: "Peak Elo", build(K) {
  const g = new THREE.Group();
  let geo = new THREE.ConeGeometry(0.78, 1.7, 9, 6, false); geo.deleteAttribute('uv'); geo.deleteAttribute('normal'); geo = mergeVertices(geo); const p = geo.attributes.position, r = rng(42);
  const seen = new Map();
  for (let i = 0; i < p.count; i++) { const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [(r() - 0.5) * 0.12, (r() - 0.5) * 0.08, (r() - 0.5) * 0.12]);
    const [dx, dy, dz] = seen.get(key), top = p.getY(i) > 0.84; if (!top && p.getY(i) > -0.84) { p.setX(i, p.getX(i) + dx); p.setY(i, p.getY(i) + dy); p.setZ(i, p.getZ(i) + dz); } }
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  const peak = new THREE.Mesh(geo, engrave(K.main, hammered(4), 0.5)); peak.material.flatShading = true; peak.position.y = 0.95; g.add(peak);
  // snow-line cap in the bright finish
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 9, 1), K.bright.clone()); cap.material.flatShading = true; cap.position.y = 1.56; g.add(cap);
  // rising ribbon spiralling round the mountain
  const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200, a = t * Math.PI * 4.2 + 0.4, rr = 0.8 - t * 0.62, y = 0.22 + t * 1.3; pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr]); }
  const rib = tube(pts, 0.022, K.trim, 400); g.add(rib);
  const tip = pts.at(-1); const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 24), K.trim); arrow.position.set(tip[0], tip[1] + 0.03, tip[2]); arrow.rotation.z = -0.6; g.add(arrow);
  // flag pole, pennant and star
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.62, 16), K.trim), 0, 2.08, 0));
  const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.quadraticCurveTo(0.2, 0.04, 0.38, -0.07); pen.quadraticCurveTo(0.2, -0.1, 0, -0.2);
  const flag = extrude(pen, 0.008, K.enamel, 0.004); flag.position.set(0.012, 2.34, 0); g.add(flag);
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.035 : 0.08; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.add(at(extrude(star, 0.025, K.bright, 0.008), 0, 2.45, 0));
  // boulders round the foot and a snow-line ring
  { const rr = rng(7); for (let i = 0; i < 16; i++) { const a = rr() * Math.PI * 2, d = 0.62 + rr() * 0.2, sz = 0.05 + rr() * 0.07;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0), K.accent); b.position.set(Math.cos(a) * d, 0.13 + sz * 0.4, Math.sin(a) * d); b.rotation.set(rr() * 3, rr() * 3, 0); g.add(b); } }
  // rocky footing
  g.add(smooth([[0, 0], [0.86, 0], [0.88, 0.04], [0.82, 0.12], [0, 0.13]], K.accent)); g.add(ring(0.87, 0.016, K.trim, 0.04));
  if (K.gem) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem); s.position.set(Math.cos(a) * 0.84, 0.14, Math.sin(a) * 0.84); g.add(s); }
  if (K.glow) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), K.glow), 0, 0.95, 0));
  return g; } };

/** The full award: piece on its plinth, sized so every piece frames the same. */
export function award(id, tier, font) {
  const [pid, icon] = id.split("~"), P = PIECES[pid], K = kit(tier), g = new THREE.Group(); g.userData.ry = P.ry ?? (P.noPlinth ? -0.18 : undefined); g.userData.fit = P.fit ?? 1;
  if (!P.noPlinth) g.add(plinth(K, font, P.name));
  const piece = P.build(K, font, icon); g.add(piece);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ================================================================ the rest of League
const cyl = (rt, rb, h, mat, seg = 64) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const textMesh = (font, str, size, depth, mat) => { const tg = new TextGeometry(str, { font, size, depth, curveSegments: 10, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: size * 0.03, bevelSegments: 3 });
  tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0); return new THREE.Mesh(tg, mat); };
const turnedFoot = (K, r = 0.4) => { const g = new THREE.Group(); g.add(smooth([[0, 0], [r, 0], [r + 0.02, 0.03], [r * 0.85, 0.09], [r * 0.5, 0.14], [0, 0.15]], K.accent)); g.add(ring(r + 0.01, 0.014, K.trim, 0.03)); beads(g, r * 0.88, 0.011, 0.075, 40, K.bright); return g; };
const starShape = (ro, ri, n = 5) => { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; };
const sand = (K) => new THREE.MeshPhysicalMaterial({ color: K.tier === "DIAMOND" ? 0xbff3ff : K.tier === "BRONZE" ? 0xc8915a : K.tier === "GOLD" ? 0xf0cf70 : 0xe8ecf2, roughness: 0.9, sheen: 0.5, emissive: K.glow ? 0x3fbfd8 : 0x000000, emissiveIntensity: K.glow ? 0.6 : 0 });
const glass = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.05, ior: 1.5, transparent: true, opacity: 0.35, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false });

/** Matches played: an hourglass — turned caps, four twisted columns, glass bulbs and sand in the tier colour. */
PIECES["league-matches"] = { name: "Matches played", build(K) {
  const g = new THREE.Group(), cap = (y, flip) => { const c = smooth([[0, 0], [0.5, 0], [0.52, 0.04], [0.46, 0.09], [0.44, 0.12], [0, 0.13]], K.main); c.position.y = y; if (flip) { c.scale.y = -1; } return c; };
  g.add(cap(0, false)); g.add(cap(1.55, true)); g.add(ring(0.51, 0.016, K.trim, 0.04)); g.add(ring(0.51, 0.016, K.trim, 1.51));
  g.add(band(0.46, 0.06, 0.44, 0.115, K.main, 8, 1.5)); beads(g, 0.47, 0.012, 1.47, 48, K.bright);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 0.36, z = Math.sin(a) * 0.36;
    const col = fluted([[0.035, 0.13], [0.045, 0.2], [0.04, 0.78], [0.05, 0.8], [0.04, 0.82], [0.04, 1.35], [0.045, 1.42]], 6, 0.25, K.main, { twist: 14, seg: 48, div: 80 });
    col.position.set(x, 0, z); g.add(col); g.add(at(ball(0.04, K.trim), x, 0.8, z)); }
  const bulb = [[0.02, 0.78], [0.08, 0.84], [0.25, 1.0], [0.3, 1.18], [0.24, 1.36], [0.1, 1.42]];
  const top = smooth(bulb, glass()), bot = smooth(bulb, glass()); bot.scale.y = -1; bot.position.y = 1.56; g.add(top); g.add(bot);
  const s = sand(K);
  g.add(smooth([[0.0, 0.14], [0.27, 0.18], [0.24, 0.42], [0.12, 0.55], [0, 0.58]], s));               // the pile below
  g.add(smooth([[0.0, 1.06], [0.2, 1.1], [0.26, 1.18], [0.24, 1.3], [0, 1.3]], s));                    // what's left above
  g.add(at(cyl(0.006, 0.006, 0.48, s, 12), 0, 0.82, 0));                                               // the falling stream
  g.add(at(cyl(0.05, 0.05, 0.05, K.trim, 32), 0, 0.78, 0));
  if (K.gem) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), Math.cos(a) * 0.48, 0.07, Math.sin(a) * 0.48)); }
  return g; } };

/** Different players beaten: an upright laurel wreath with crossed darts through the middle. */
PIECES["players-beaten"] = { name: "Players beaten", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.36)); g.add(at(cyl(0.05, 0.08, 0.35, K.main), 0, 0.3, 0));
  const R = 0.62, cy = 1.1;
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.05, 0.05, 0.15, 0); ls.quadraticCurveTo(0.05, -0.05, 0, 0);
  const leaf = new THREE.ExtrudeGeometry(ls, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 16 });
  for (const side of [-1, 1]) for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + side * (0.18 + i * 0.165), x = Math.cos(a) * R, y = cy + Math.sin(a) * R;
    for (const off of [-1, 1]) { const l = new THREE.Mesh(leaf, K.main); l.position.set(x, y, off * 0.02); l.rotation.z = a + side * Math.PI / 2 + off * 0.5 * side + (side > 0 ? 0 : Math.PI); g.add(l); }
    if (i % 3 === 1) g.add(at(ball(0.022, K.bright), x * 0.93, cy + (y - cy) * 0.93, 0.03)); }
  const stem = []; for (let i = 0; i <= 60; i++) { const a = -Math.PI / 2 + (i / 60 - 0.5) * 5.6; stem.push([Math.cos(a) * R, cy + Math.sin(a) * R, 0]); } g.add(tube(stem, 0.014, K.accent, 160));
  // ribbon bow at the foot of the wreath
  const bow = new THREE.Shape(); bow.moveTo(0, 0); bow.bezierCurveTo(0.15, 0.12, 0.25, 0.02, 0.2, -0.08); bow.bezierCurveTo(0.12, -0.03, 0.05, -0.02, 0, 0);
  for (const s of [-1, 1]) { const b = extrude(bow, 0.02, K.enamel, 0.008); b.scale.x = s; b.position.set(0, cy - R, 0.04); g.add(b); }
  g.add(at(ball(0.04, K.trim), 0, cy - R, 0.05));
  for (const s of [-1, 1]) { const d = dart(K, K.enamel); d.scale.setScalar(0.85); d.rotation.z = s * 0.62; d.position.set(s * 0.3, cy - 0.38, 0.06); g.add(d); }
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), K.gem), 0, cy + R + 0.04, 0));
  return g; } };

/** Points won from stakes: a leaning tower of enamelled chips topped with a struck dart coin. */
PIECES["stake-points"] = { name: "Stake points", build(K, font) {
  const g = new THREE.Group(); const cols = [K.enamel, K.main, K.enamel, K.accent];
  const chip = (mat, y, x, z, ry) => { const c = new THREE.Group(); c.add(cyl(0.3, 0.3, 0.07, mat, 96)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.072, 0.03, 2, 0.01), K.bright), Math.cos(a) * 0.285, 0, Math.sin(a) * 0.285)).children.at(-1).rotation.y = -a; }
    c.add(ring(0.2, 0.008, K.trim, 0.036)); c.position.set(x, y, z); c.rotation.y = ry; return c; };
  const r = rng(3); for (let i = 0; i < 12; i++) g.add(chip(cols[i % 4], 0.04 + i * 0.075, (r() - 0.5) * 0.04 + i * 0.006, (r() - 0.5) * 0.03, r() * 3));
  const r2 = rng(5); for (let i = 0; i < 6; i++) g.add(chip(cols[(i + 1) % 4], 0.04 + i * 0.075, 0.55 + (r2() - 0.5) * 0.03, -0.12, r2() * 3));
  for (let i = 0; i < 3; i++) g.add(chip(cols[(i + 2) % 4], 0.04 + i * 0.075, -0.5, 0.1, i));
  // the coin: standing on edge on top of the tall stack, a dart struck in relief
  const coin = new THREE.Group(); coin.add(cyl(0.34, 0.34, 0.05, K.bright, 128).rotateX(Math.PI / 2)); coin.add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.022, 16, 128), K.trim));
  const relief = dart(K, K.bright); relief.scale.setScalar(0.36); relief.rotation.z = -Math.PI / 4; relief.position.set(0.12, -0.12, 0.03); coin.add(relief);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; coin.add(at(ball(0.008, K.trim), Math.cos(a) * 0.285, Math.sin(a) * 0.285, 0.028)); }
  coin.position.set(0.07, 0.04 + 12 * 0.075 + 0.3, 0); coin.rotation.y = 0.25; g.add(coin);
  if (K.gem) coin.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), 0, 0.27, 0.04));
  return g; } };

/** Seasons played: an armillary sphere — meridian and ecliptic rings round a dartboard globe, on a turned stand. */
PIECES["seasons-played"] = { name: "Seasons played", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.42));
  g.add(smooth([[0, 0.14], [0.08, 0.15], [0.05, 0.3], [0.09, 0.4], [0.05, 0.5], [0.07, 0.62], [0, 0.63]], K.main)); g.add(ring(0.085, 0.012, K.trim, 0.4));
  const c = new THREE.Group(); c.position.y = 1.2; g.add(c);
  const rg = (R, r, mat, rx, rz) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 200), mat); m.rotation.set(rx, 0, rz); c.add(m); return m; };
  rg(0.58, 0.03, K.main, 0, 0); rg(0.58, 0.02, K.accent, Math.PI / 2, 0); rg(0.52, 0.022, K.trim, Math.PI / 2 + 0.41, 0.2); rg(0.52, 0.018, K.trim, 0.3, Math.PI / 2);
  // ecliptic band with twelve season marks
  const ecl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.07, 160, 1, true), engrave(K.main, filigree(12), 1.4)); ecl.rotation.set(0.41, 0, 0.2); c.add(ecl);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, m = at(ball(0.022, K.bright), Math.cos(a) * 0.61, 0, Math.sin(a) * 0.61); const h = new THREE.Group(); h.add(m); h.rotation.set(0.41, 0, 0.2); c.add(h); }
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 64, 48), new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.6, clearcoat: 0.5 })); globe.rotation.y = -Math.PI / 2; c.add(globe);
  c.add(at(cyl(0.012, 0.012, 1.4, K.trim, 16), 0, 0, 0)).children.at(-1).rotation.z = 0.2;
  c.add(at(ball(0.04, K.trim), Math.sin(0.2) * 0.7, Math.cos(0.2) * 0.7, 0));
  c.add(at(cyl(0.04, 0.06, 0.12, K.main), 0, -0.62, 0));
  if (K.gem) c.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 0.64, 0));
  if (K.glow) rg(0.6, 0.008, K.glow, 0.41, 0.2);
  return g; } };

/** Wins on a big stake: a balance scale weighed down by a stack of chips against a single dart. */
PIECES["big-stake-wins"] = { name: "Big stake wins", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.42));
  g.add(fluted([[0.06, 0.14], [0.07, 0.2], [0.05, 1.5], [0.07, 1.55], [0, 1.56]], 12, 0.12, K.main, { seg: 64 }));
  g.add(ring(0.075, 0.014, K.trim, 0.2)); g.add(at(ball(0.07, K.trim), 0, 1.6, 0)); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 24), K.bright), 0, 1.74, 0));
  const tilt = 0.14, beam = new THREE.Group(); beam.position.y = 1.5; beam.rotation.z = tilt; g.add(beam);
  beam.add(tube([[-0.72, 0, 0], [-0.4, 0.04, 0], [0, 0.06, 0], [0.4, 0.04, 0], [0.72, 0, 0]], 0.022, K.main));
  for (const s of [-1, 1]) beam.add(at(ball(0.035, K.trim), s * 0.73, 0, 0));
  const pan = (s, contents) => { const p = new THREE.Group(); const x = s * 0.72, drop = 0.62 + s * tilt * 0.72 * -1;
    p.position.set(Math.cos(tilt) * x, 1.5 + Math.sin(tilt) * x - 0.62, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; p.add(tube([[0, 0.62, 0], [Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2]], 0.005, K.trim, 8)); }
    p.add(smooth([[0, 0], [0.24, 0.02], [0.26, 0.06], [0.22, 0.04], [0, 0.02]], K.main)); p.add(ring(0.25, 0.01, K.trim, 0.05)); contents(p); g.add(p); };
  pan(1, p => { for (let i = 0; i < 5; i++) { const c = cyl(0.12, 0.12, 0.035, i % 2 ? K.enamel : K.bright, 48); c.position.set(0.01 * i, 0.06 + i * 0.037, 0); p.add(c); } });
  pan(-1, p => { const d = dart(K, K.enamel); d.scale.setScalar(0.42); d.rotation.z = Math.PI / 2; d.position.set(0.16, 0.08, 0); p.add(d); });
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), K.gem), 0, 1.6, 0.07));
  return g; } };

/** Players eliminated: a knockout gong in an arched frame, with its mallet. */
PIECES["eliminations"] = { name: "Eliminations", build(K, font) {
  const g = new THREE.Group();
  const arch = []; for (let i = 0; i <= 80; i++) { const t = i / 80, a = Math.PI * t; arch.push([Math.cos(a) * 0.62, 1.25 + Math.sin(a) * 0.55, 0]); }
  for (const s of [-1, 1]) { g.add(at(fluted([[0.05, 0], [0.06, 0.06], [0.045, 1.2], [0.06, 1.25], [0, 1.26]], 8, 0.15, K.main, { seg: 48 }), s * 0.62, 0, 0)); g.add(at(smooth([[0, 0], [0.13, 0], [0.12, 0.08], [0.06, 0.12], [0, 0.13]], K.accent), s * 0.62, 0, 0)); g.add(at(ball(0.05, K.trim), s * 0.62, 1.25, 0)); }
  g.add(tube(arch, 0.04, K.main, 200)); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 24), K.trim), 0, 1.86, 0)); g.add(at(ball(0.04, K.bright), 0, 1.8, 0));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.06, 0.1, 3, 0.02), K.main), 0, 0.15, 0));
  // gong: hammered disc with a raised boss and concentric rings, hung on two chains
  const gong = new THREE.Group(); gong.position.set(0, 1.0, 0);
  const disc = smooth([[0, 0.02], [0.12, 0.03], [0.16, 0.0], [0.44, -0.01], [0.48, 0.02], [0.47, -0.03], [0, -0.03]], engrave(K.bright, hammered(11), 1.0)); disc.rotation.x = Math.PI / 2; gong.add(disc);
  for (const r of [0.22, 0.32, 0.4]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 12, 160), K.accent); t.position.z = 0.015; gong.add(t); }
  if (font) { const ko = textMesh(font, "KO", 0.12, 0.02, K.enamel); ko.position.z = 0.035; gong.add(ko); }
  g.add(gong);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 24), K.trim); l.position.set(s * (0.3 - i * 0.012), 1.42 + 0.05 - i * 0.055 + 0.2, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
  // mallet resting against the frame
  const m = new THREE.Group(); m.add(at(cyl(0.015, 0.015, 0.7, K.accent, 16), 0, 0.35, 0)); m.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 20), K.enamel), 0, 0.72, 0));
  m.position.set(0.5, 0.18, 0.25); m.rotation.z = 0.35; g.add(m);
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 1.0, 0.06));
  if (K.glow) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.008, 12, 160), K.glow); t.position.set(0, 1.0, -0.02); g.add(t); }
  return g; } };

/** Formats won in: a faceted gem held in a four-claw setting, each face a format. */
PIECES["formats-won"] = { name: "Formats won", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.4));
  g.add(smooth([[0, 0.14], [0.1, 0.15], [0.06, 0.3], [0.05, 0.6], [0.09, 0.66], [0.12, 0.7], [0, 0.71]], K.main)); g.add(ring(0.1, 0.012, K.trim, 0.66));
  const gemMat = K.crystal ? K.gem : new THREE.MeshPhysicalMaterial({ color: ({ BRONZE: 0xb8501e, SILVER: 0x2a5bd7, GOLD: 0xc0182a, PLATINUM: 0x1b3fa0 })[K.tier], metalness: 0.1, roughness: 0.02, clearcoat: 1, envMapIntensity: 3, flatShading: true, transmission: 0.3, thickness: 0.5, ior: 1.7 });
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), gemMat); stone.position.y = 1.12; stone.rotation.set(0.3, 0.4, 0); g.add(stone);
  const gw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.362, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 })); gw.position.copy(stone.position); gw.rotation.copy(stone.rotation); g.add(gw);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(tube([[Math.cos(a) * 0.1, 0.7, Math.sin(a) * 0.1], [Math.cos(a) * 0.3, 0.86, Math.sin(a) * 0.3], [Math.cos(a) * 0.33, 1.1, Math.sin(a) * 0.33], [Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2]], 0.026, K.main));
    g.add(at(ball(0.03, K.trim), Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2)); }
  g.add(ring(0.25, 0.015, K.trim, 0.85)); beads(g, 0.25, 0.012, 0.82, 32, K.bright);
  return g; } };

/** Wins against your most-beaten opponent: two oversized darts crossed like duelling swords over a shield. */
PIECES["rival-wins"] = { name: "Rivalry", build(K, font) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.36));
  const sh = new THREE.Shape(); sh.moveTo(0, -0.42); sh.bezierCurveTo(0.3, -0.3, 0.38, -0.05, 0.38, 0.3); sh.lineTo(-0.38, 0.3); sh.bezierCurveTo(-0.38, -0.05, -0.3, -0.3, 0, -0.42);
  const shield = extrude(sh, 0.06, K.enamel, 0.02); shield.position.set(0, 0.95, 0); g.add(shield);
  const rim = []; for (const p of sh.getPoints(80)) rim.push([p.x, 0.95 + p.y, 0.05]); g.add(tube(rim, 0.022, K.trim, 240));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.04, 0.04, 3, 0.015), K.bright), 0, 1.0, 0.07));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.6, 0.04, 3, 0.015), K.bright), 0, 0.92, 0.07));
  if (font) { const vs = textMesh(font, "VS", 0.13, 0.03, K.bright); vs.position.set(0, 0.74, 0.08); g.add(vs); }
  for (const s of [-1, 1]) { const d = dart(K, s > 0 ? K.enamel : K.accent); d.scale.setScalar(1.45); d.rotation.z = s * 0.62; d.position.set(s * 0.5, 0.42, -0.06); g.add(d); }
  g.add(at(cyl(0.05, 0.07, 0.2, K.main), 0, 0.24, 0));
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 1.0, 0.1));
  return g; } };

/** Top-3 finishes: a podium in three tiers with small cups on each step. */
PIECES["top-three"] = { name: "Top three", build(K, font) {
  const g = new THREE.Group(); const steps = [[0, 0.7, "1"], [-0.42, 0.48, "2"], [0.42, 0.34, "3"]];
  for (const [x, h, n] of steps) { g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.4, h, 0.5, 4, 0.03), K.main), x, h / 2, 0));
    g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.03, 0.52, 3, 0.01), K.trim), x, h, 0));
    if (font) { const t = textMesh(font, n, 0.16, 0.03, n === "1" ? K.bright : K.enamel); t.position.set(x, h * 0.55, 0.26); g.add(t); }
    const cup = new THREE.Group(), s = n === "1" ? 1 : 0.75;
    cup.add(smooth([[0, 0], [0.09, 0], [0.04, 0.04], [0.025, 0.12], [0.05, 0.15], [0.12, 0.22], [0.13, 0.32], [0.12, 0.33], [0, 0.2]], K.bright));
    for (const sx of [-1, 1]) cup.add(tube([[sx * 0.12, 0.3, 0], [sx * 0.19, 0.29, 0], [sx * 0.18, 0.2, 0], [sx * 0.08, 0.18, 0]], 0.012, K.bright, 40));
    cup.scale.setScalar(s * 1.3); cup.position.set(x, h + 0.015, 0); g.add(cup); }
  if (K.gem) for (const [x, h] of steps) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, h * 0.25, 0.26));
  return g; } };

/** League titles: a crown on a tasselled cushion. */
PIECES["titles"] = { name: "League titles", build(K) {
  const g = new THREE.Group();
  const cushionMat = new THREE.MeshPhysicalMaterial({ color: K.enamel.color, roughness: 0.75, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.4 });
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.28, 0.9, 10, 0.13), cushionMat); cushion.position.y = 0.14; g.add(cushion);
  for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]]) { g.add(at(ball(0.035, K.trim), x, 0.18, z)); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 16), K.trim), x, 0.08, z)); }
  const cr = new THREE.Group(); cr.position.y = 0.3; g.add(cr);
  cr.add(smooth([[0.4, 0], [0.42, 0.02], [0.42, 0.12], [0.4, 0.14]], K.main, 192, 20)); cr.add(ring(0.42, 0.02, K.trim, 0.02)); cr.add(ring(0.42, 0.02, K.trim, 0.13));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const st = new THREE.Mesh(new THREE.OctahedronGeometry(i % 2 ? 0.025 : 0.035, 0), i % 2 ? K.bright : (K.gem ?? K.enamel)); st.position.set(Math.cos(a) * 0.43, 0.075, Math.sin(a) * 0.43); cr.add(st); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 0.4, z = Math.sin(a) * 0.4;
    const pt = i % 2 ? [[x, 0.14, z], [x * 0.98, 0.3, z * 0.98], [x * 0.95, 0.38, z * 0.95]] : [[x, 0.14, z], [x * 1.02, 0.34, z * 1.02], [x * 0.98, 0.5, z * 0.98]];
    cr.add(tube(pt, 0.03, K.main, 24)); cr.add(at(ball(i % 2 ? 0.035 : 0.045, K.bright), ...pt[2])); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; cr.add(tube([[Math.cos(a) * 0.4, 0.14, Math.sin(a) * 0.4], [Math.cos(a) * 0.32, 0.5, Math.sin(a) * 0.32], [Math.cos(a) * 0.08, 0.66, Math.sin(a) * 0.08], [0, 0.68, 0]], 0.022, K.main, 60)); }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.37, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), cushionMat); cap.position.y = 0.14; cap.scale.y = 1.25; cr.add(cap);
  cr.add(at(ball(0.07, K.main), 0, 0.72, 0)); const cross = new THREE.Group(); cross.add(new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.2, 0.04, 2, 0.01), K.bright)); cross.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.04, 0.04, 2, 0.01), K.bright), 0, 0.03, 0)); cross.position.y = 0.86; cr.add(cross);
  if (K.glow) cr.add(ring(0.43, 0.008, K.glow, 0.075));
  return g; } };

/** League 140+ visits: an engraved salver standing on a display easel, 140 in the centre. */
PIECES["league-140s"] = { name: "140s", build(K, font) {
  const g = new THREE.Group();
  for (const [x, z, rz] of [[-0.32, 0.15, -0.12], [0.32, 0.15, 0.12]]) { const l = at(cyl(0.022, 0.03, 1.5, K.main, 16), x, 0.72, z); l.rotation.set(-0.12, 0, rz); g.add(l); }
  const back = at(cyl(0.022, 0.03, 1.5, K.main, 16), 0, 0.7, -0.3); back.rotation.x = 0.35; g.add(back);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.05, 0.12, 3, 0.02), K.main), 0, 0.38, 0.2));
  const plate = new THREE.Group(); plate.position.set(0, 1.0, 0.12); plate.rotation.x = -0.12; g.add(plate);
  const salver = smooth([[0, 0], [0.48, 0.0], [0.55, 0.04], [0.6, 0.06], [0.62, 0.04], [0.6, 0.02], [0, 0.015]], engrave(K.main, guilloche(), 0.35)); salver.rotation.x = Math.PI / 2; plate.add(salver);
  const rope = []; for (let i = 0; i <= 240; i++) { const a = i / 240 * Math.PI * 2, rr = 0.6 + Math.sin(a * 60) * 0.008; rope.push([Math.cos(a) * rr, Math.sin(a) * rr, 0.06]); } plate.add(tube(rope, 0.016, K.trim, 480));
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.01, 12, 160), K.bright); inner.position.z = 0.03; plate.add(inner);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; plate.add(at(ball(0.012, K.bright), Math.cos(a) * 0.51, Math.sin(a) * 0.51, 0.04)); }
  if (font) { const t = textMesh(font, "140", 0.24, 0.04, K.bright); t.position.z = 0.04; plate.add(t); const p = textMesh(font, "+", 0.12, 0.03, K.enamel); p.position.set(0.32, 0.1, 0.04); plate.add(p); }
  if (K.gem) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; plate.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), Math.cos(a) * 0.51, Math.sin(a) * 0.51, 0.05)); }
  if (K.glow) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.008, 12, 160), K.glow); t.position.z = 0.035; plate.add(t); }
  return g; } };

/** League tons: a lidded pub tankard with a thumb-lift, banded body and 100 on its front. */
PIECES["league-tons"] = { name: "Tons", build(K, font) {
  const g = new THREE.Group();
  g.add(smooth([[0, 0], [0.42, 0], [0.44, 0.03], [0.4, 0.08], [0.36, 0.12], [0.35, 0.95], [0.38, 1.0], [0.36, 1.02], [0, 1.02]], K.main));
  for (const y of [0.16, 0.86]) { g.add(ring(0.36, 0.022, K.trim, y)); beads(g, 0.37, 0.01, y + 0.04, 48, K.bright); beads(g, 0.37, 0.01, y - 0.04, 48, K.bright); }
  g.add(band(0.352, 0.24, 0.352, 0.78, K.main, 6, 1.6));
  // lid with a dome and finial, hinged at the handle
  const lid = new THREE.Group(); lid.position.y = 1.02; lid.add(smooth([[0, 0], [0.4, 0], [0.4, 0.03], [0.3, 0.08], [0.15, 0.13], [0, 0.14]], K.main)); lid.add(at(smooth([[0, 0], [0.05, 0.02], [0.03, 0.08], [0.05, 0.12], [0, 0.15]], K.trim), 0, 0.13, 0)); g.add(lid);
  const hx = -1; g.add(tube([[hx * 0.34, 0.85, 0], [hx * 0.6, 0.86, 0], [hx * 0.68, 0.6, 0], [hx * 0.6, 0.3, 0], [hx * 0.34, 0.22, 0]], 0.045, K.main));
  g.add(tube([[hx * 0.38, 1.04, 0], [hx * 0.5, 1.12, 0], [hx * 0.56, 1.22, 0]], 0.03, K.trim, 40)); g.add(at(ball(0.045, K.trim), hx * 0.56, 1.23, 0));
  // front cartouche with 100
  const fr = new THREE.Group(); fr.position.set(0, 0.52, 0.355); g.add(fr);
  fr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 64).rotateX(Math.PI / 2), K.enamel)); fr.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 12, 96), K.trim));
  if (font) { const t = textMesh(font, "100", 0.12, 0.025, K.bright); t.position.z = 0.02; fr.add(t); }
  if (K.gem) for (const y of [0.16, 0.86]) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), Math.cos(a) * 0.385, y, Math.sin(a) * 0.385)); }
  if (K.glow) g.add(ring(0.38, 0.01, K.glow, 1.0));
  return g; } };

/** League checkouts: the double ring as an upright hoop with a dart in double top. */
PIECES["league-checkouts"] = { name: "Checkouts", build(K, font) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.36)); g.add(at(cyl(0.06, 0.09, 0.3, K.main), 0, 0.28, 0));
  const R = 0.66, cy = 1.1, ringG = new THREE.Group(); ringG.position.y = cy; g.add(ringG);
  // the double band: twenty alternating red and green enamel segments between two metal wires
  for (let i = 0; i < 20; i++) { const a0 = Math.PI / 2 - Math.PI / 20 + i * Math.PI / 10; const sh = new THREE.Shape(); sh.absarc(0, 0, R, a0, a0 + Math.PI / 10, false); sh.absarc(0, 0, R - 0.08, a0 + Math.PI / 10, a0, true);
    ringG.add(extrude(sh, 0.05, new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0x0d7a3b : 0xc8102e, roughness: 0.3, clearcoat: 1 }), 0.004)); }
  for (const r of [R + 0.015, R - 0.095]) ringG.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 16, 200), K.main));
  for (let i = 0; i < 20; i++) { const a = Math.PI / 2 - Math.PI / 20 + i * Math.PI / 10; ringG.add(tube([[Math.cos(a) * (R - 0.095), Math.sin(a) * (R - 0.095), 0.03], [Math.cos(a) * (R + 0.015), Math.sin(a) * (R + 0.015), 0.03]], 0.006, K.bright, 4)); }
  const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  if (font) nums.forEach((n, i) => { const a = Math.PI / 2 - i * Math.PI / 10; const t = textMesh(font, String(n), 0.06, 0.015, K.bright); t.position.set(Math.cos(a) * (R + 0.09), Math.sin(a) * (R + 0.09), 0.01); t.rotation.z = a - Math.PI / 2; ringG.add(t); });
  ringG.add(new THREE.Mesh(new THREE.TorusGeometry(R + 0.16, 0.025, 16, 200), K.trim));
  const d = dart(K, K.enamel); d.scale.setScalar(0.9); d.rotation.set(Math.PI / 2 - 0.5, 0, 0); d.position.set(0, R - 0.04, 0.03); ringG.add(d);
  if (K.gem) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; ringG.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), Math.cos(a) * (R + 0.16), Math.sin(a) * (R + 0.16), 0.03)); }
  if (K.glow) ringG.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.04, 0.01, 12, 200), K.glow));
  return g; } };

/** League checkout rate: a precision gauge — engine-turned dial, percentage ticks and a needle, in a domed bezel. */
PIECES["league-checkout-rate"] = { name: "Checkout rate", build(K, font) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.36));
  g.add(smooth([[0, 0.14], [0.12, 0.15], [0.07, 0.3], [0.1, 0.38], [0, 0.4]], K.main));
  const dial = new THREE.Group(); dial.position.set(0, 0.95, 0); g.add(dial);
  dial.add(smooth([[0, -0.06], [0.52, -0.06], [0.56, -0.02], [0.56, 0.03], [0.52, 0.05], [0, 0.04]], K.main).rotateX(Math.PI / 2));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.48, 128), engrave(new THREE.MeshPhysicalMaterial({ color: K.tier === "GOLD" || K.tier === "BRONZE" ? 0xf3ead6 : 0xe9eef4, roughness: 0.35, clearcoat: 0.5 }), guilloche(), 0.3)); face.position.z = 0.045; dial.add(face);
  for (let i = 0; i <= 50; i++) { const a = Math.PI * 1.25 - i / 50 * Math.PI * 1.5, big = i % 5 === 0; const tk = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.012 : 0.006, big ? 0.07 : 0.035, 0.006), i > 35 ? K.enamel : K.ink); tk.position.set(Math.cos(a) * (0.42 - (big ? 0.035 : 0.018)), Math.sin(a) * (0.42 - (big ? 0.035 : 0.018)), 0.05); tk.rotation.z = a - Math.PI / 2; dial.add(tk); }
  if (font) [0, 20, 40, 60, 80, 100].forEach((n, i) => { const a = Math.PI * 1.25 - i / 5 * Math.PI * 1.5; const t = textMesh(font, String(n), 0.045, 0.006, K.ink); t.position.set(Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.05); dial.add(t); });
  if (font) { const t = textMesh(font, "%", 0.07, 0.008, K.ink); t.position.set(0, -0.2, 0.05); dial.add(t); }
  const needle = new THREE.Shape(); needle.moveTo(-0.012, 0); needle.lineTo(0, 0.38); needle.lineTo(0.012, 0); needle.lineTo(0, -0.08);
  const nd = extrude(needle, 0.008, K.enamel, 0.002); nd.position.z = 0.065; nd.rotation.z = -(Math.PI * 1.5) * 0.72 + Math.PI * 0.75; dial.add(nd);
  dial.add(at(ball(0.03, K.bright), 0, 0, 0.07));
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 20, 160), K.trim); bezel.position.z = 0.05; dial.add(bezel);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 48, 16, 0, Math.PI * 2, 0, 0.9), glass()); dome.rotation.x = Math.PI / 2; dome.position.z = -0.33; dome.scale.set(0.83, 0.83, 0.5); dial.add(dome);
  dial.add(at(ball(0.045, K.trim), 0, 0.6, 0)); dial.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 12, 48), K.trim), 0, 0.68, 0));
  if (K.gem) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; dial.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), K.gem), Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0.06)); }
  if (K.glow) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.006, 12, 160), K.glow); t.position.z = 0.055; dial.add(t); }
  return g; } };

/** Matches played on the scorer: a framed slate scoreboard chalked up mid-game. */
PIECES["scorer-matches"] = { name: "On the scorer", build(K, font) {
  const g = new THREE.Group();
  const slate = new THREE.MeshPhysicalMaterial({ map: canvasTex(512, 640, (c, w, h) => { c.fillStyle = "#1d2422"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = "rgba(240,240,230,.85)"; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w / 2, h - 30); c.moveTo(30, 70); c.lineTo(w - 30, 70); c.stroke();
    c.fillStyle = "rgba(245,245,235,.92)"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.fillText("HOME", w / 4, 55); c.fillText("AWAY", w * 3 / 4, 55);
    c.font = "38px sans-serif"; const L = ["501", "441", "301", "201", "121", "40"], R = ["501", "401", "315", "245", "165"];
    L.forEach((v, i) => { c.fillText(v, w / 4, 130 + i * 78); if (i < L.length - 1) { c.fillRect(w / 4 - 40, 140 + i * 78, 80, 3); } });
    R.forEach((v, i) => { c.fillText(v, w * 3 / 4, 130 + i * 78); if (i < R.length - 1) c.fillRect(w * 3 / 4 - 40, 140 + i * 78, 80, 3); });
    c.font = "bold 34px sans-serif"; c.fillStyle = "rgba(255,210,74,.9)"; c.fillText("D20", w / 4, h - 40); }), roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), slate); board.position.set(0, 1.0, 0.02); g.add(board);
  const frame = new THREE.Shape(); frame.moveTo(-0.6, -0.72); frame.lineTo(0.6, -0.72); frame.lineTo(0.6, 0.72); frame.lineTo(-0.6, 0.72); frame.lineTo(-0.6, -0.72);
  const hole = new THREE.Path(); hole.moveTo(-0.5, -0.625); hole.lineTo(0.5, -0.625); hole.lineTo(0.5, 0.625); hole.lineTo(-0.5, 0.625); hole.lineTo(-0.5, -0.625); frame.holes.push(hole);
  const fr = extrude(frame, 0.08, K.main, 0.025); fr.position.set(0, 1.0, 0.02); g.add(fr);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.03, 0.05, 2, 0.01), K.trim), 0, 0.33, 0.07));
  for (const [x, y] of [[-0.6, 0.28], [0.6, 0.28], [-0.6, 1.72], [0.6, 1.72]]) g.add(at(ball(0.045, K.trim), x, y, 0.06));
  // crest on top and a chalk tray with a stick of chalk and a dart
  const crest = smooth([[0, 0], [0.18, 0], [0.16, 0.05], [0.08, 0.1], [0, 0.12]], K.main); crest.position.y = 1.72; g.add(crest);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.05, 0.16, 3, 0.02), K.main), 0, 0.27, 0.1));
  g.add(at(cyl(0.02, 0.02, 0.16, new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 1 }), 16), -0.2, 0.32, 0.12)).children.at(-1).rotation.z = Math.PI / 2;
  const d = dart(K, K.enamel); d.scale.setScalar(0.45); d.rotation.z = -Math.PI / 2; d.position.set(0.05, 0.32, 0.12); g.add(d);
  for (const x of [-0.42, 0.42]) { const leg = at(cyl(0.025, 0.035, 0.3, K.main, 16), x, 0.13, 0); g.add(leg); }
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 1.86, 0.03));
  if (K.glow) { const t = []; for (const [x, y] of [[-0.55, 0.32], [0.55, 0.32], [0.55, 1.68], [-0.55, 1.68], [-0.55, 0.32]]) t.push([x, y, 0.07]); g.add(tube(t, 0.01, K.glow, 40)); }
  return g; } };

// ================================================================ feat seals (one finish; the icon changes per feat)
/** Draws a feat's relief icon on a canvas (white = raised). */
const poly = (c, w, pts) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)); c.closePath(); c.fill(); };
const txt = (str, size = 0.42) => (c, w) => { c.font = `bold ${size * w}px Arial, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(str, w / 2, w * 0.53); };
const ICONS = {
  gem: (c, w) => { poly(c, w, [[.3, .22], [.7, .22], [.86, .4], [.5, .86], [.14, .4]]); c.fillStyle = "#000"; c.lineWidth = .02 * w; c.strokeStyle = "#000"; c.beginPath(); c.moveTo(.14 * w, .4 * w); c.lineTo(.86 * w, .4 * w); c.moveTo(.3 * w, .22 * w); c.lineTo(.4 * w, .4 * w); c.lineTo(.5 * w, .86 * w); c.lineTo(.6 * w, .4 * w); c.lineTo(.7 * w, .22 * w); c.stroke(); },
  pulse: (c, w) => { c.lineWidth = .06 * w; c.strokeStyle = "#fff"; c.lineJoin = "round"; c.beginPath(); [[.1, .55], [.32, .55], [.4, .3], [.5, .78], [.58, .42], [.64, .55], [.9, .55]].forEach(([x, y], i) => i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)); c.stroke(); },
  broom: (c, w) => { c.save(); c.translate(.5 * w, .5 * w); c.rotate(-0.6); c.fillRect(-.03 * w, -.42 * w, .06 * w, .5 * w); poly(c, w, [[-.15, .1], [.15, .1], [.24, .42], [-.24, .42]].map(([x, y]) => [x + 0, y + 0])); c.restore(); },
  rocket: (c, w) => { c.beginPath(); c.moveTo(.5 * w, .1 * w); c.quadraticCurveTo(.7 * w, .3 * w, .62 * w, .66 * w); c.lineTo(.38 * w, .66 * w); c.quadraticCurveTo(.3 * w, .3 * w, .5 * w, .1 * w); c.fill(); poly(c, w, [[.38, .5], [.26, .74], [.4, .66]]); poly(c, w, [[.62, .5], [.74, .74], [.6, .66]]); poly(c, w, [[.44, .7], [.56, .7], [.5, .9]]); c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .38 * w, .06 * w, 0, 7); c.fill(); },
  stairs: (c, w) => { poly(c, w, [[.14, .84], [.14, .68], [.34, .68], [.34, .52], [.54, .52], [.54, .36], [.74, .36], [.74, .2], [.88, .2], [.88, .84]]); },
  stopwatch: (c, w) => { c.beginPath(); c.arc(.5 * w, .56 * w, .3 * w, 0, 7); c.fill(); c.fillRect(.44 * w, .14 * w, .12 * w, .1 * w); c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .56 * w, .23 * w, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(.5 * w, .56 * w); c.arc(.5 * w, .56 * w, .2 * w, -Math.PI / 2, 0.4); c.fill(); },
  yinyang: (c, w) => { c.beginPath(); c.arc(.5 * w, .5 * w, .34 * w, -Math.PI / 2, Math.PI / 2); c.arc(.5 * w, .67 * w, .17 * w, Math.PI / 2, -Math.PI / 2, true); c.arc(.5 * w, .33 * w, .17 * w, Math.PI / 2, -Math.PI / 2); c.fill(); c.lineWidth = .03 * w; c.strokeStyle = "#fff"; c.beginPath(); c.arc(.5 * w, .5 * w, .34 * w, 0, 7); c.stroke(); c.beginPath(); c.arc(.5 * w, .67 * w, .05 * w, 0, 7); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .33 * w, .05 * w, 0, 7); c.fill(); },
  first: txt("1st", .32),
  flagpeak: (c, w) => { poly(c, w, [[.1, .86], [.42, .36], [.56, .54], [.68, .44], [.9, .86]]); c.fillRect(.41 * w, .12 * w, .03 * w, .26 * w); poly(c, w, [[.44, .12], [.62, .17], [.44, .23]]); },
  crownskull: (c, w) => { poly(c, w, [[.28, .3], [.28, .12], [.38, .22], [.5, .08], [.62, .22], [.72, .12], [.72, .3]]); c.beginPath(); c.arc(.5 * w, .52 * w, .2 * w, 0, 7); c.fill(); c.fillRect(.4 * w, .64 * w, .2 * w, .16 * w); c.fillStyle = "#000"; for (const x of [.42, .58]) { c.beginPath(); c.arc(x * w, .52 * w, .05 * w, 0, 7); c.fill(); } },
  bird: (c, w) => { c.beginPath(); c.ellipse(.48 * w, .56 * w, .22 * w, .15 * w, -0.2, 0, 7); c.fill(); c.beginPath(); c.arc(.68 * w, .4 * w, .1 * w, 0, 7); c.fill(); poly(c, w, [[.76, .38], [.9, .42], [.76, .45]]); poly(c, w, [[.3, .5], [.1, .38], [.22, .62]]); c.fillStyle = "#000"; c.beginPath(); c.arc(.7 * w, .38 * w, .02 * w, 0, 7); c.fill(); },
  candle: (c, w) => { c.fillRect(.4 * w, .42 * w, .2 * w, .42 * w); c.beginPath(); c.moveTo(.5 * w, .14 * w); c.quadraticCurveTo(.62 * w, .3 * w, .5 * w, .38 * w); c.quadraticCurveTo(.38 * w, .3 * w, .5 * w, .14 * w); c.fill(); c.fillRect(.3 * w, .84 * w, .4 * w, .05 * w); },
  weekend: txt("S S", .3), tonup: txt("3×180", .2),
  shapes: (c, w) => { c.beginPath(); c.arc(.32 * w, .34 * w, .12 * w, 0, 7); c.fill(); c.fillRect(.56 * w, .22 * w, .24 * w, .24 * w); poly(c, w, [[.32, .56], [.46, .8], [.18, .8]]); ICONS.star && (() => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .05 : .13; c.lineTo(.68 * w + Math.cos(a) * r * w, .68 * w + Math.sin(a) * r * w); } c.fill(); })(); },
  hourglass: (c, w) => { c.fillRect(.28 * w, .14 * w, .44 * w, .06 * w); c.fillRect(.28 * w, .8 * w, .44 * w, .06 * w); poly(c, w, [[.32, .2], [.68, .2], [.52, .5], [.68, .8], [.32, .8], [.48, .5]]); },
  fireworks: (c, w) => { c.lineWidth = .04 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; for (const [x, y, r] of [[.38, .4, .2], [.68, .62, .14]]) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; c.beginPath(); c.moveTo(x * w + Math.cos(a) * r * .35 * w, y * w + Math.sin(a) * r * .35 * w); c.lineTo(x * w + Math.cos(a) * r * w, y * w + Math.sin(a) * r * w); c.stroke(); } },
  mask: (c, w) => { c.beginPath(); c.moveTo(.12 * w, .42 * w); c.quadraticCurveTo(.5 * w, .24 * w, .88 * w, .42 * w); c.quadraticCurveTo(.84 * w, .66 * w, .64 * w, .66 * w); c.quadraticCurveTo(.5 * w, .56 * w, .36 * w, .66 * w); c.quadraticCurveTo(.16 * w, .66 * w, .12 * w, .42 * w); c.fill();
    c.fillStyle = "#000"; for (const x of [.34, .66]) { c.beginPath(); c.ellipse(x * w, .47 * w, .08 * w, .05 * w, 0, 0, 7); c.fill(); } },
  trio: (c, w) => { for (const [x, y, r] of [[.3, .42, .09], [.7, .42, .09], [.5, .34, .11]]) { c.beginPath(); c.arc(x * w, y * w, r * w, 0, 7); c.fill(); c.beginPath(); c.ellipse(x * w, (y + .32) * w, r * 1.5 * w, r * 1.8 * w, 0, Math.PI, 0); c.fill(); } },
  chain: (c, w) => { c.lineWidth = .07 * w; c.strokeStyle = "#fff"; for (const [x, a] of [[.36, -.5], [.64, .5]]) { c.save(); c.translate(x * w, .5 * w); c.rotate(a); c.beginPath(); c.ellipse(0, 0, .2 * w, .12 * w, 0, 0, 7); c.stroke(); c.restore(); } },
  pint: (c, w) => { poly(c, w, [[.3, .25], [.66, .25], [.62, .86], [.34, .86]]); c.lineWidth = .06 * w; c.strokeStyle = "#fff"; c.beginPath(); c.arc(.68 * w, .52 * w, .13 * w, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(.4 * w, .22 * w, .09 * w, 0, 7); c.arc(.56 * w, .2 * w, .1 * w, 0, 7); c.fill(); },
  rota: (c, w) => { for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { c.fillRect((.2 + k * .16) * w, (.22 + r * .15) * w, .12 * w, .11 * w); } },
  wolf: (c, w) => poly(c, w, [[.2, .18], [.38, .38], [.62, .38], [.8, .18], [.78, .5], [.62, .72], [.5, .86], [.38, .72], [.22, .5]]),
  pair: (c, w) => { for (const x of [.36, .64]) { c.beginPath(); c.arc(x * w, .34 * w, .11 * w, 0, 7); c.fill(); c.beginPath(); c.ellipse(x * w, .7 * w, .17 * w, .2 * w, 0, Math.PI, 0); c.fill(); c.fillRect((x - .17) * w, .7 * w, .34 * w, .1 * w); } },
  sync: (c, w) => { c.lineWidth = .08 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; c.beginPath(); c.moveTo(.18 * w, .38 * w); c.lineTo(.72 * w, .38 * w); c.moveTo(.82 * w, .62 * w); c.lineTo(.28 * w, .62 * w); c.stroke(); poly(c, w, [[.86, .38], [.68, .24], [.68, .52]]); poly(c, w, [[.14, .62], [.32, .48], [.32, .76]]); },
  twostar: (c, w) => { for (const [x, y, r] of [[.34, .44, .2], [.68, .58, .16]]) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; c.lineTo(x * w + Math.cos(a) * rr * w, y * w + Math.sin(a) * rr * w); } c.fill(); } },
  podium: (c, w) => { c.fillRect(.38 * w, .3 * w, .24 * w, .55 * w); c.fillRect(.14 * w, .48 * w, .24 * w, .37 * w); c.fillRect(.62 * w, .58 * w, .24 * w, .27 * w); c.fillStyle = "#000"; c.font = `bold ${.16 * w}px Arial`; c.textAlign = "center"; c.fillText("1", .5 * w, .48 * w); },
  card: (c, w) => { c.fillRect(.28 * w, .14 * w, .44 * w, .72 * w); c.fillStyle = "#000"; for (let i = 0; i < 5; i++) c.fillRect(.34 * w, (.26 + i * .11) * w, (i % 2 ? .2 : .3) * w, .04 * w); },
  plusclock: (c, w) => { ICONS.clock(c, w); c.fillStyle = "#fff"; c.fillRect(.66 * w, .12 * w, .2 * w, .06 * w); c.fillRect(.73 * w, .05 * w, .06 * w, .2 * w); },
  chips: (c, w) => { for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(.5 * w, (.74 - i * .14) * w, .28 * w, .09 * w, 0, 0, 7); c.fill(); c.fillStyle = i % 2 ? "#fff" : "#000"; c.fillRect(.44 * w, (.72 - i * .14) * w, .12 * w, .03 * w); c.fillStyle = "#fff"; } },
  moonstar: (c, w) => { ICONS.moon(c, w); c.fillStyle = "#fff"; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .04 : .1; c.lineTo(.74 * w + Math.cos(a) * rr * w, .66 * w + Math.sin(a) * rr * w); } c.fill(); },
  rosette: (c, w) => { c.beginPath(); for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, r = .3 + Math.sin(a * 12) * .03; c.lineTo(.5 * w + Math.cos(a) * r * w, .42 * w + Math.sin(a) * r * w); } c.fill(); poly(c, w, [[.38, .66], [.3, .92], [.42, .84], [.48, .94], [.5, .7]]); poly(c, w, [[.62, .66], [.7, .92], [.58, .84], [.52, .94], [.5, .7]]);
    c.fillStyle = "#000"; c.font = `bold ${.2 * w}px Arial`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("1", .5 * w, .43 * w); },
  up: (c, w) => poly(c, w, [[.5, .12], [.82, .48], [.62, .48], [.62, .86], [.38, .86], [.38, .48], [.18, .48]]),
  spade: (c, w) => { c.beginPath(); c.moveTo(.5 * w, .12 * w); c.bezierCurveTo(.95 * w, .45 * w, .78 * w, .82 * w, .52 * w, .62 * w); c.lineTo(.6 * w, .88 * w); c.lineTo(.4 * w, .88 * w); c.lineTo(.48 * w, .62 * w); c.bezierCurveTo(.22 * w, .82 * w, .05 * w, .45 * w, .5 * w, .12 * w); c.fill(); },
  dice: (c, w) => { c.fillRect(.2 * w, .2 * w, .6 * w, .6 * w); c.fillStyle = "#000"; for (const [x, y] of [[.33, .33], [.67, .33], [.5, .5], [.33, .67], [.67, .67]]) { c.beginPath(); c.arc(x * w, y * w, .055 * w, 0, 7); c.fill(); } },
  swords: (c, w) => { c.lineWidth = .08 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; c.beginPath(); c.moveTo(.2 * w, .2 * w); c.lineTo(.8 * w, .8 * w); c.moveTo(.8 * w, .2 * w); c.lineTo(.2 * w, .8 * w); c.stroke(); c.lineWidth = .05 * w; c.beginPath(); c.moveTo(.6 * w, .82 * w); c.lineTo(.82 * w, .6 * w); c.moveTo(.18 * w, .6 * w); c.lineTo(.4 * w, .82 * w); c.stroke(); },
  bounce: (c, w) => { c.lineWidth = .09 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; c.beginPath(); c.moveTo(.25 * w, .25 * w); c.lineTo(.25 * w, .55 * w); c.arc(.5 * w, .55 * w, .25 * w, Math.PI, 0, true); c.lineTo(.75 * w, .32 * w); c.stroke(); poly(c, w, [[.75, .14], [.9, .36], [.6, .36]]); },
  calendar: (c, w) => { c.fillRect(.2 * w, .22 * w, .6 * w, .6 * w); c.fillStyle = "#000"; c.fillRect(.24 * w, .36 * w, .52 * w, .42 * w); c.fillStyle = "#fff"; c.lineWidth = .07 * w; c.strokeStyle = "#fff"; c.beginPath(); c.moveTo(.32 * w, .56 * w); c.lineTo(.45 * w, .69 * w); c.lineTo(.68 * w, .44 * w); c.stroke(); },
  house: (c, w) => { poly(c, w, [[.5, .15], [.85, .48], [.75, .48], [.75, .85], [.25, .85], [.25, .48], [.15, .48]]); c.fillStyle = "#000"; c.fillRect(.43 * w, .6 * w, .14 * w, .25 * w); },
  shield: (c, w) => { c.beginPath(); c.moveTo(.5 * w, .88 * w); c.bezierCurveTo(.15 * w, .7 * w, .2 * w, .4 * w, .2 * w, .2 * w); c.lineTo(.8 * w, .2 * w); c.bezierCurveTo(.8 * w, .4 * w, .85 * w, .7 * w, .5 * w, .88 * w); c.fill(); },
  heart: (c, w) => { c.beginPath(); c.moveTo(.5 * w, .85 * w); c.bezierCurveTo(.05 * w, .55 * w, .2 * w, .12 * w, .5 * w, .32 * w); c.bezierCurveTo(.8 * w, .12 * w, .95 * w, .55 * w, .5 * w, .85 * w); c.fill(); },
  vs: txt("VS", .36), eye: (c, w) => { c.beginPath(); c.ellipse(.5 * w, .5 * w, .36 * w, .2 * w, 0, 0, 7); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .5 * w, .13 * w, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(.5 * w, .5 * w, .05 * w, 0, 7); c.fill(); },
  king: (c, w) => { c.fillRect(.46 * w, .1 * w, .08 * w, .2 * w); c.fillRect(.4 * w, .16 * w, .2 * w, .07 * w); poly(c, w, [[.32, .32], [.68, .32], [.6, .66], [.4, .66]]); c.fillRect(.28 * w, .7 * w, .44 * w, .14 * w); },
  anvil: (c, w) => { poly(c, w, [[.12, .32], [.82, .32], [.88, .4], [.7, .45], [.62, .62], [.72, .82], [.28, .82], [.38, .62], [.3, .45]]); },
  one: txt("1", .55), max: txt("180", .3), hat: txt("×3", .4), x2: txt("×2", .4), hundred: txt("100", .3), seven: txt("7", .55), bang: txt("!", .6),
  snow: (c, w) => { c.lineWidth = .06 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(.5 * w, .5 * w); c.lineTo(.5 * w + Math.cos(a) * .36 * w, .5 * w + Math.sin(a) * .36 * w); c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(.5 * w + Math.cos(a) * .22 * w, .5 * w + Math.sin(a) * .22 * w); c.lineTo(.5 * w + Math.cos(a + s * .5) * .3 * w, .5 * w + Math.sin(a + s * .5) * .3 * w); c.stroke(); } } },
  bubble: (c, w) => { c.beginPath(); c.ellipse(.5 * w, .45 * w, .34 * w, .25 * w, 0, 0, 7); c.fill(); poly(c, w, [[.3, .62], [.22, .86], [.46, .68]]); },
  key: (c, w) => { c.beginPath(); c.arc(.32 * w, .4 * w, .16 * w, 0, 7); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(.32 * w, .4 * w, .07 * w, 0, 7); c.fill(); c.fillStyle = "#fff"; c.save(); c.translate(.32 * w, .4 * w); c.rotate(Math.PI / 4); c.fillRect(.12 * w, -.04 * w, .48 * w, .08 * w); c.fillRect(.42 * w, .04 * w, .06 * w, .1 * w); c.fillRect(.52 * w, .04 * w, .06 * w, .14 * w); c.restore(); },
  moon: (c, w) => { c.beginPath(); c.arc(.5 * w, .5 * w, .34 * w, 0, 7); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(.64 * w, .4 * w, .3 * w, 0, 7); c.fill(); },
  sun: (c, w) => { c.beginPath(); c.arc(.5 * w, .5 * w, .18 * w, 0, 7); c.fill(); c.lineWidth = .06 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(.5 * w + Math.cos(a) * .26 * w, .5 * w + Math.sin(a) * .26 * w); c.lineTo(.5 * w + Math.cos(a) * .38 * w, .5 * w + Math.sin(a) * .38 * w); c.stroke(); } },
  clock: (c, w) => { c.beginPath(); c.arc(.5 * w, .5 * w, .36 * w, 0, 7); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .5 * w, .29 * w, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = .06 * w; c.lineCap = "round"; c.beginPath(); c.moveTo(.5 * w, .5 * w); c.lineTo(.5 * w, .3 * w); c.moveTo(.5 * w, .5 * w); c.lineTo(.65 * w, .58 * w); c.stroke(); },
  repeat: (c, w) => { c.lineWidth = .08 * w; c.strokeStyle = "#fff"; c.beginPath(); c.arc(.5 * w, .5 * w, .26 * w, 0.4, Math.PI - 0.2); c.stroke(); c.beginPath(); c.arc(.5 * w, .5 * w, .26 * w, Math.PI + 0.4, -0.2); c.stroke(); poly(c, w, [[.2, .38], [.32, .58], [.1, .58]]); poly(c, w, [[.8, .62], [.68, .42], [.9, .42]]); },
  tree: (c, w) => { poly(c, w, [[.5, .1], [.72, .4], [.62, .4], [.8, .64], [.2, .64], [.38, .4], [.28, .4]]); c.fillRect(.44 * w, .64 * w, .12 * w, .18 * w); },
  cat: (c, w) => { c.beginPath(); c.ellipse(.5 * w, .62 * w, .24 * w, .22 * w, 0, 0, 7); c.fill(); c.beginPath(); c.arc(.5 * w, .34 * w, .15 * w, 0, 7); c.fill(); poly(c, w, [[.37, .3], [.38, .12], [.48, .24]]); poly(c, w, [[.63, .3], [.62, .12], [.52, .24]]);
    c.lineWidth = .05 * w; c.strokeStyle = "#fff"; c.lineCap = "round"; c.beginPath(); c.moveTo(.72 * w, .74 * w); c.quadraticCurveTo(.92 * w, .7 * w, .86 * w, .48 * w); c.stroke(); },
  star: (c, w) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * .16 : w * .38; c.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } c.fill(); },
  bolt: (c, w) => { c.beginPath(); [[.58, .1], [.28, .55], [.48, .55], [.4, .9], [.74, .42], [.53, .42], [.64, .1]].forEach(([x, y], i) => i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)); c.fill(); },
  crown: (c, w) => { c.beginPath(); [[.18, .72], [.18, .32], [.34, .5], [.5, .22], [.66, .5], [.82, .32], [.82, .72]].forEach(([x, y], i) => i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)); c.fill(); c.fillRect(.18 * w, .76 * w, .64 * w, .08 * w); },
  target: (c, w) => { for (const [r, f] of [[.38, 1], [.29, 0], [.2, 1], [.11, 0], [.05, 1]]) { c.fillStyle = f ? "#fff" : "#000"; c.beginPath(); c.arc(w / 2, w / 2, r * w, 0, 7); c.fill(); } },
  flame: (c, w) => { c.beginPath(); c.moveTo(.5 * w, .1 * w); c.bezierCurveTo(.85 * w, .45 * w, .78 * w, .9 * w, .5 * w, .9 * w); c.bezierCurveTo(.2 * w, .9 * w, .15 * w, .5 * w, .38 * w, .32 * w); c.bezierCurveTo(.38 * w, .5 * w, .46 * w, .55 * w, .5 * w, .1 * w); c.fill(); },
  skull: (c, w) => { c.beginPath(); c.arc(.5 * w, .44 * w, .26 * w, 0, 7); c.fill(); c.fillRect(.36 * w, .6 * w, .28 * w, .2 * w); c.fillStyle = "#000"; for (const x of [.4, .6]) { c.beginPath(); c.arc(x * w, .45 * w, .07 * w, 0, 7); c.fill(); } },
};
PIECES["feat-seal"] = { name: "", noPlinth: true, build(K, font, icon = "star") {
  const g = new THREE.Group(); g.position.y = -0.2;
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c25a, metalness: 1, roughness: 0.1, clearcoat: 0.4 });
  // ribbon tails behind the seal
  const rib = new THREE.Shape(); rib.moveTo(-0.14, 0); rib.lineTo(0.14, 0); rib.lineTo(0.14, -0.8); rib.lineTo(0, -0.66); rib.lineTo(-0.14, -0.8); rib.lineTo(-0.14, 0);
  for (const s of [-1, 1]) { const r = extrude(rib, 0.015, K.enamel, 0.006); r.position.set(s * 0.17, 1.0, -0.08); r.rotation.z = s * 0.28; g.add(r); }
  const seal = new THREE.Group(); seal.position.y = 1.15; g.add(seal);
  // scalloped rosette rim, rope edge, enamel field and the relief icon
  const ros = new THREE.Shape(); for (let i = 0; i <= 240; i++) { const a = i / 240 * Math.PI * 2, r = 0.55 + Math.sin(a * 24) * 0.025; i ? ros.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ros.moveTo(r, 0); }
  seal.add(extrude(ros, 0.05, engrave(gold, sunburst(), 0.5), 0.015));
  const rope = []; for (let i = 0; i <= 240; i++) { const a = i / 240 * Math.PI * 2, r = 0.44 + Math.sin(a * 50) * 0.006; rope.push([Math.cos(a) * r, Math.sin(a) * r, 0.045]); } seal.add(tube(rope, 0.018, gold, 480));
  const tex = canvasTex(512, 512, (c, w) => { c.fillStyle = "#000"; c.fillRect(0, 0, w, w); c.fillStyle = "#fff"; (ICONS[icon] ?? ICONS.star)(c, w); });
  const FIELD = { gem: 0x123a7a, pulse: 0x8a1020, broom: 0x0e4a2a, rocket: 0x3d1466, stairs: 0x6a3a10, stopwatch: 0x0f3f66, yinyang: 0x3d1466, first: 0x5a1020, flagpeak: 0x0e4a2a, crownskull: 0x111114, bird: 0x8a4a08, candle: 0x0b1840, weekend: 0x3d1466, tonup: 0x0e4a2a, shapes: 0x123a7a, hourglass: 0x6a3a10, fireworks: 0x111114, mask: 0x111114, trio: 0x0e4a2a, chain: 0x5a1020, pint: 0x6a3a10, rota: 0x123a7a, wolf: 0x222226, pair: 0x123a7a, sync: 0x3d1466, twostar: 0x5a1020, podium: 0x0e4a2a, card: 0x6a3a10, plusclock: 0x222226, chips: 0x111114, moonstar: 0x0b1840, rosette: 0x8a1020, skull: 0x1a1a1f, crown: 0x5a1020, up: 0x0e4a2a, spade: 0x111114, dice: 0x123a7a, swords: 0x5a1020, bounce: 0x0e4a2a, calendar: 0x123a7a, bolt: 0x3d1466, house: 0x6a3a10, shield: 0x123a7a, heart: 0x8a1020, vs: 0x5a1020, eye: 0x2a0a3a, king: 0x111114, flame: 0x7a2a08, anvil: 0x222226, one: 0x5a1020, max: 0x0e4a2a, hat: 0x3d1466, snow: 0x0f3f66, bubble: 0x123a7a, star: 0x5a1020, hundred: 0x0e4a2a, key: 0x6a3a10, seven: 0x3d1466, moon: 0x0b1840, sun: 0x8a4a08, clock: 0x222226, repeat: 0x0e4a2a, up2: 0x0e4a2a, tree: 0x0a4020, cat: 0x0a0a0c, bang: 0x8a1020, target: 0x5a1020, ticket: 0x0e4a2a, loop: 0x123a7a, trophy: 0x5a1020, rings: 0x3d1466, ton: 0x0e4a2a, fish: 0x0f3f66, ten: 0x7a2a08, torch: 0x7a2a08, nine: 0x111114, pillar: 0x123a7a, watch: 0x6a3a10 };
  const fieldMat = K.enamel.clone(); if (FIELD[icon] !== undefined) fieldMat.color.setHex(FIELD[icon]); const field = new THREE.Mesh(new THREE.CircleGeometry(0.42, 128), fieldMat); field.position.z = 0.04; seal.add(field);
  const relief = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62, 256, 256), new THREE.MeshPhysicalMaterial({ color: 0xf2c25a, metalness: 1, roughness: 0.12, alphaMap: tex, transparent: true, displacementMap: tex, displacementScale: 0.035, bumpMap: tex, bumpScale: 2 }));
  relief.position.z = 0.045; seal.add(relief);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; seal.add(at(ball(0.014, gold), Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.05)); }
  return g; } };

// ================================================================ new League tracks and the Grand Slam
/** Untouchable: a fortress keep — battlements, arrow slits, a gatehouse shield and a pennant. Never breached. */
PIECES["untouchable"] = { name: "Untouchable", build(K, font) {
  const g = new THREE.Group(); const stone = engrave(K.main, hammered(21), 0.7);
  g.add(smooth([[0, 0], [0.56, 0], [0.58, 0.04], [0.52, 0.1], [0.5, 0.16], [0, 0.16]], K.accent)); g.add(ring(0.56, 0.016, K.trim, 0.04));
  // keep: a slightly tapered drum with string courses
  g.add(smooth([[0.46, 0.16], [0.42, 1.3], [0.46, 1.34], [0.46, 1.4], [0, 1.4]], stone));
  for (const y of [0.5, 0.95]) g.add(ring(0.445 - (y - 0.16) * 0.03, 0.014, K.trim, y));
  // battlements: merlons round the top
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const mer = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.16, 0.12, 3, 0.02), stone); mer.position.set(Math.cos(a) * 0.43, 1.48, Math.sin(a) * 0.43); mer.rotation.y = -a; g.add(mer); }
  // arrow slits
  for (const [a, y] of [[0.3, 0.75], [-0.45, 1.1], [1.6, 0.8], [-1.4, 0.7]]) { const sl = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.2, 0.04, 2, 0.015), K.ink); const r = 0.44 - (y - 0.16) * 0.03; sl.position.set(Math.sin(a) * r, y, Math.cos(a) * r); sl.rotation.y = a; g.add(sl); }
  // gate: arched door with studs, and a shield above it
  const door = new THREE.Shape(); door.moveTo(-0.13, 0); door.lineTo(-0.13, 0.22); door.absarc(0, 0.22, 0.13, Math.PI, 0, true); door.lineTo(0.13, 0); door.lineTo(-0.13, 0);
  const dm = extrude(door, 0.04, K.accent, 0.01); dm.position.set(0, 0.16, 0.45); g.add(dm);
  for (let i = 0; i < 6; i++) g.add(at(ball(0.012, K.bright), -0.08 + (i % 2) * 0.16, 0.22 + Math.floor(i / 2) * 0.09, 0.48));
  const sh = new THREE.Shape(); sh.moveTo(0, -0.2); sh.bezierCurveTo(0.15, -0.14, 0.18, 0, 0.18, 0.14); sh.lineTo(-0.18, 0.14); sh.bezierCurveTo(-0.18, 0, -0.15, -0.14, 0, -0.2);
  const shield = extrude(sh, 0.04, K.enamel, 0.012); shield.position.set(0, 0.72, 0.43); g.add(shield);
  const d = dart(K, K.bright); d.scale.setScalar(0.34); d.rotation.z = Math.PI; d.position.set(0, 0.88, 0.47); g.add(d);
  // flag
  g.add(at(cyl(0.012, 0.014, 0.5, K.trim, 16), 0, 1.62, 0));
  const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.quadraticCurveTo(0.18, 0.03, 0.34, -0.06); pen.quadraticCurveTo(0.18, -0.08, 0, -0.18);
  g.add(at(extrude(pen, 0.008, K.enamel, 0.004), 0.012, 1.85, 0)); g.add(at(ball(0.03, K.bright), 0, 1.88, 0));
  if (K.gem) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + Math.PI / 12; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), K.gem), Math.cos(a) * 0.45, 1.41, Math.sin(a) * 0.45)); }
  if (K.glow) g.add(ring(0.43, 0.01, K.glow, 0.95));
  return g; } };

/** Ever-present: a lighthouse — banded tower, gallery rail, a lit lantern room and a dome. Always there. */
PIECES["ever-present"] = { name: "Ever-present", build(K) {
  const g = new THREE.Group();
  g.add(smooth([[0, 0], [0.5, 0], [0.52, 0.04], [0.46, 0.08], [0.44, 0.13], [0, 0.13]], K.accent)); g.add(ring(0.5, 0.015, K.trim, 0.04));
  const bands = 5, h0 = 0.13, h1 = 1.3, r0 = 0.34, r1 = 0.2;
  for (let i = 0; i < bands; i++) { const a = h0 + (h1 - h0) * i / bands, b = h0 + (h1 - h0) * (i + 1) / bands, ra = r0 + (r1 - r0) * i / bands, rb = r0 + (r1 - r0) * (i + 1) / bands;
    g.add(new THREE.Mesh(new THREE.LatheGeometry([V(0, a), V(ra, a), V(rb, b), V(0, b)], 128), i % 2 ? K.enamel : K.main)); }
  for (const y of [0.6, 1.0]) { const r = r0 + (r1 - r0) * (y - h0) / (h1 - h0); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.11, 0.03, 2, 0.01), K.ink), 0, y, r + 0.005)); }
  // gallery with a railing
  g.add(at(cyl(0.3, 0.26, 0.05, K.main), 0, 1.33, 0)); g.add(ring(0.3, 0.012, K.trim, 1.36));
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; g.add(at(cyl(0.006, 0.006, 0.12, K.trim, 8), Math.cos(a) * 0.29, 1.42, Math.sin(a) * 0.29)); }
  g.add(ring(0.29, 0.01, K.trim, 1.48));
  // lantern: glass room with a glowing lamp and mullions
  const lamp = new THREE.MeshStandardMaterial({ color: 0x302000, emissive: K.glow ? 0x6fe9ff : 0xffd27a, emissiveIntensity: 5 });
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), lamp), 0, 1.55, 0));
  g.add(at(cyl(0.16, 0.16, 0.26, glass(), 48), 0, 1.55, 0));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(cyl(0.008, 0.008, 0.26, K.main, 8), Math.cos(a) * 0.16, 1.55, Math.sin(a) * 0.16)); }
  // beams of light either side
  const beamTex = canvasTex(4, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const beamMat = new THREE.MeshBasicMaterial({ color: K.glow ? 0x6fd8ea : 0xb89a5a, alphaMap: beamTex, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  g.add(smooth([[0, 1.68], [0.2, 1.68], [0.18, 1.72], [0.1, 1.8], [0, 1.83]], K.main)); g.add(at(ball(0.035, K.bright), 0, 1.86, 0)); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.1, 12), K.trim), 0, 1.93, 0));
  if (K.gem) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), K.gem), Math.cos(a) * 0.3, 1.33, Math.sin(a) * 0.3)); }
  return g; } };

/** The Grand Slam: the showpiece. A winged dartboard globe in an armillary cage, crowned, on four spiral columns. */
PIECES["grand-slam"] = { name: "The Grand Slam", fit: 0.84, build(K, font) {
  const g = new THREE.Group();
  g.add(smooth([[0, 0], [0.62, 0], [0.64, 0.04], [0.56, 0.1], [0.5, 0.16], [0.36, 0.2], [0, 0.21]], K.main)); g.add(ring(0.63, 0.018, K.trim, 0.04)); beads(g, 0.56, 0.013, 0.11, 64, K.bright);
  g.add(band(0.5, 0.15, 0.37, 0.2, K.main, 12, 1.6));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 0.26, z = Math.sin(a) * 0.26;
    const c = fluted([[0.045, 0.2], [0.055, 0.26], [0.045, 0.82], [0.06, 0.86], [0.05, 0.9]], 6, 0.3, K.main, { twist: 12, seg: 48, div: 80 }); c.position.set(x, 0, z); g.add(c); g.add(at(ball(0.05, K.trim), x, 0.92, z)); }
  g.add(at(cyl(0.12, 0.08, 0.9, K.accent), 0, 0.6, 0)); g.add(ring(0.33, 0.016, K.trim, 0.94)); g.add(smooth([[0, 0.9], [0.36, 0.92], [0.3, 0.98], [0.1, 1.02], [0, 1.03]], K.main));
  // the globe and its cage
  const c = new THREE.Group(); c.position.y = 1.5; g.add(c);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 96, 64), new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.55, clearcoat: 0.6 })); globe.rotation.y = -Math.PI / 2; c.add(globe);
  for (const [rx, rz, r] of [[0, 0, 0.42], [Math.PI / 2, 0, 0.42], [Math.PI / 2 + 0.4, 0.3, 0.45], [0.3, Math.PI / 2, 0.45]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 16, 200), K.main); t.rotation.set(rx, 0, rz); c.add(t); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const st = extrude(starShape(0.035, 0.015), 0.01, K.bright, 0.004); st.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); c.add(st); }
  // wings
  const feather = (len) => { const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(len * 0.5, 0.06, len, 0.015); f.quadraticCurveTo(len * 0.5, -0.03, 0, -0.03); return f; };
  for (const s of [-1, 1]) { const wing = new THREE.Group(); wing.position.set(s * 0.36, 0.05, -0.05); wing.scale.x = s;
    for (let i = 0; i < 11; i++) { const len = 0.36 + i * 0.06, fm = extrude(feather(len), 0.012, i % 2 ? K.main : K.bright, 0.005); fm.rotation.z = 0.15 + i * 0.13; fm.position.set(0, i * 0.012, -i * 0.004); wing.add(fm); }
    c.add(wing); }
  // crown on top
  const cr = new THREE.Group(); cr.position.y = 0.42; c.add(cr);
  cr.add(smooth([[0.14, 0], [0.15, 0.06], [0.14, 0.07], [0, 0.07]], K.main, 96, 10));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cr.add(tube([[Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14], [Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15]], 0.016, K.main, 8)); cr.add(at(ball(0.022, K.gem ?? K.bright), Math.cos(a) * 0.15, 0.17, Math.sin(a) * 0.15)); }
  cr.add(at(extrude(starShape(0.07, 0.03), 0.02, K.bright, 0.006), 0, 0.2, 0));
  if (K.gem) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), Math.cos(a) * 0.36, 0.95, Math.sin(a) * 0.36)); }
  // laurel garland round the column cap and a glowing halo behind the globe
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.03, 0.035, 0.09, 0); ls.quadraticCurveTo(0.03, -0.035, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 16 });
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, side = i % 2 ? 1 : -1; const l = new THREE.Mesh(leafGeo, K.bright); const hh = new THREE.Group(); l.rotation.z = side * 0.6; hh.add(l); hh.position.set(Math.cos(a) * 0.36, 0.97, Math.sin(a) * 0.36); hh.rotation.y = -a + Math.PI / 2; g.add(hh); }
  if (K.glow) { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.012, 16, 200), K.glow); halo.position.set(0, 1.5, -0.12); g.add(halo); }
  g.scale.setScalar(1.12);
  return g; } };

// ================================================================ Teams: Doubles and Shift Wars
const goblet = (K, s = 1) => { const c = new THREE.Group();
  c.add(smooth([[0, 0], [0.2, 0], [0.21, 0.02], [0.12, 0.06], [0.05, 0.1], [0.04, 0.3], [0.07, 0.34], [0.05, 0.38], [0.1, 0.42], [0.26, 0.52], [0.31, 0.7], [0.32, 0.82], [0.3, 0.82], [0.28, 0.7], [0, 0.6]], K.main));
  c.add(ring(0.32, 0.012, K.trim, 0.81)); c.add(ring(0.065, 0.01, K.trim, 0.34)); c.add(band(0.28, 0.6, 0.31, 0.74, K.main, 6, 1.8)); c.scale.setScalar(s); return c; };

/** Team wins: twin goblets rising from one stem, joined by a bridge of laurel. Two winners, one trophy. */
PIECES["doubles-wins"] = { name: "Team wins", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.46));
  g.add(fluted([[0.06, 0.14], [0.08, 0.2], [0.06, 0.62], [0.1, 0.68], [0, 0.7]], 10, 0.15, K.main, { seg: 96 })); g.add(ring(0.08, 0.012, K.trim, 0.2));
  for (const s of [-1, 1]) { g.add(tube([[0, 0.66, 0], [s * 0.18, 0.72, 0], [s * 0.36, 0.86, 0], [s * 0.4, 0.98, 0]], 0.035, K.main, 60));
    const c = goblet(K, 1.25); c.position.set(s * 0.42, 0.96, 0); g.add(c); }
  g.add(at(ball(0.06, K.trim), 0, 0.7, 0));
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.03, 0.03, 0.08, 0); ls.quadraticCurveTo(0.03, -0.03, 0, 0);
  const leaf = new THREE.ExtrudeGeometry(ls, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 12 });
  for (let i = 0; i <= 14; i++) { const t = i / 14, x = -0.32 + t * 0.64, y = 1.98 + Math.sin(t * Math.PI) * 0.16; for (const side of [-1, 1]) { const l = new THREE.Mesh(leaf, K.bright); l.position.set(x, y, 0); l.rotation.z = side * 0.7 + (t - 0.5); g.add(l); } }
  g.add(at(extrude(starShape(0.08, 0.035), 0.02, K.bright, 0.006), 0, 2.24, 0));
  if (K.gem) for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), s * 0.42, 1.75, 0.36));
  if (K.glow) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 12, 48).rotateX(Math.PI / 2), K.glow), 0, 0.68, 0));
  return g; } };

/** Team matches: two pub tankards raised and clinking. */
PIECES["doubles-matches"] = { name: "Team matches", build(K, font) {
  const g = new THREE.Group(); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.08, 0.7, 4, 0.03), K.accent), 0, 0.04, 0));
  const pint = (s) => { const t = new THREE.Group();
    t.add(smooth([[0, 0], [0.26, 0], [0.27, 0.02], [0.24, 0.06], [0.23, 0.64], [0.25, 0.68], [0, 0.68]], K.main));
    for (const y of [0.1, 0.56]) t.add(ring(0.235, 0.016, K.trim, y));
    t.add(band(0.232, 0.16, 0.232, 0.5, K.main, 5, 1.6));
    t.add(smooth([[0, 0.66], [0.24, 0.67], [0.26, 0.72], [0.18, 0.8], [0.06, 0.82], [0, 0.82]], new THREE.MeshPhysicalMaterial({ color: 0xfff6e6, roughness: 0.8, sheen: 0.5 })));   // the head
    t.add(tube([[s * 0.22, 0.55, 0], [s * 0.4, 0.56, 0], [s * 0.44, 0.38, 0], [s * 0.4, 0.2, 0], [s * 0.22, 0.16, 0]], 0.032, K.main));
    return t; };
  const a = pint(-1); a.position.set(-0.28, 0.08, 0); a.rotation.z = -0.18; g.add(a);
  const b = pint(1); b.position.set(0.28, 0.08, 0); b.rotation.z = 0.18; g.add(b);
  for (let i = 0; i < 7; i++) { const sp = ball(0.02 + (i % 3) * 0.008, new THREE.MeshPhysicalMaterial({ color: 0xfff1d0, roughness: 0.3, transmission: 0.5, transparent: true, opacity: 0.8 })); sp.position.set(-0.08 + i * 0.03, 0.98 + (i % 2) * 0.06, 0.05); g.add(sp); }
  if (K.gem) for (const x of [-0.28, 0.28]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, 0.42, 0.24));
  if (K.glow) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.015, 0.72, 2, 0.006), K.glow), 0, 0.085, 0));
  return g; } };

/** Partners you've won with: a chain of interlocking rings, one link per partner, on a turned stand. */
PIECES["doubles-partners"] = { name: "Partners", build(K) {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); g.scale.setScalar(1.35); g.add(turnedFoot(K, 0.4)); g.add(at(cyl(0.05, 0.08, 0.5, K.main), 0, 0.38, 0)); g.add(ring(0.07, 0.012, K.trim, 0.6));
  const links = [[-0.26, 1.0, 0, 0.3], [0.0, 1.08, Math.PI / 2, 0], [0.26, 1.0, 0, -0.3]];
  links.forEach(([x, y, ry, rz], i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 32, 128), i === 1 ? K.bright : K.main); t.position.set(x, y, 0); t.rotation.set(0, ry, rz); g.add(t);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 12, 128), K.trim); inner.position.set(x, y, 0); inner.rotation.set(0, ry, rz); inner.scale.setScalar(1.18); g.add(inner); });
  g.add(tube([[0, 0.62, 0], [0, 0.88, 0]], 0.02, K.trim, 8));
  if (K.gem) links.forEach(([x, y]) => g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), x, y + 0.24, 0)));
  if (K.glow) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 12, 128), K.glow), 0, 1.08, 0)).children.at(-1).rotation.y = Math.PI / 2;
  return outer; } };

/** Different teams beaten: a presentation shield, a crest in the middle and small team shields round the rim. */
PIECES["doubles-teams-beaten"] = { name: "Teams beaten", build(K, font) {
  const g = new THREE.Group(); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.3, 0.3, 4, 0.04), K.accent), 0, 0.15, -0.05));
  const sh = new THREE.Shape(); sh.moveTo(0, -0.7); sh.bezierCurveTo(0.55, -0.5, 0.66, -0.1, 0.62, 0.5); sh.quadraticCurveTo(0.3, 0.6, 0, 0.48); sh.quadraticCurveTo(-0.3, 0.6, -0.62, 0.5); sh.bezierCurveTo(-0.66, -0.1, -0.55, -0.5, 0, -0.7);
  const shield = extrude(sh, 0.06, engrave(K.main, sunburst(), 0.5), 0.02); shield.position.set(0, 1.0, 0); g.add(shield);
  const rim = sh.getPoints(120).map(p => [p.x, 1.0 + p.y, 0.05]); g.add(tube(rim, 0.026, K.trim, 360));
  const inner = sh.getPoints(120).map(p => [p.x * 0.8, 1.0 + p.y * 0.8, 0.055]); g.add(tube(inner, 0.01, K.bright, 360));
  // crest: an enamel roundel with two crossed darts
  const crest = new THREE.Group(); crest.position.set(0, 1.02, 0.06); g.add(crest);
  crest.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 64).rotateX(Math.PI / 2), K.enamel)); crest.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 12, 96), K.trim));
  for (const s of [-1, 1]) { const d = dart(K, K.bright); d.scale.setScalar(0.34); d.rotation.z = s * 0.7 + Math.PI; d.position.set(-s * 0.1, 0.12, 0.03); crest.add(d); }
  // small team shields round it
  const mini = new THREE.Shape(); mini.moveTo(0, -0.08); mini.bezierCurveTo(0.06, -0.06, 0.07, 0, 0.07, 0.06); mini.lineTo(-0.07, 0.06); mini.bezierCurveTo(-0.07, 0, -0.06, -0.06, 0, -0.08);
  const enCols = [0x8a1020, 0x123a7a, 0x0e4a2a, 0x3d1466, 0x6a3a10, 0x111114, 0x0f3f66, 0x5a1020];
  for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + (i - 3.5) * 0.34 + (i >= 4 ? Math.PI : 0) * 0, ang = -Math.PI * 0.05 + i / 8 * Math.PI * 2;
    const x = Math.cos(ang) * 0.42, y = Math.sin(ang) * 0.36; const m = extrude(mini, 0.02, new THREE.MeshPhysicalMaterial({ color: enCols[i], roughness: 0.2, clearcoat: 1 }), 0.006); m.position.set(x, 1.0 + y, 0.06); g.add(m);
    g.add(tube(mini.getPoints(30).map(p => [x + p.x, 1.0 + y + p.y, 0.075]), 0.006, K.trim, 80)); }
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 1.52, 0.06));
  if (K.glow) g.add(tube(sh.getPoints(120).map(p => [p.x * 1.04, 1.0 + p.y * 1.04, 0.0]), 0.01, K.glow, 360));
  return g; } };

/** Seasons in a team: an arched bridge between two towers. */
PIECES["doubles-seasons"] = { name: "Seasons together", build(K) {
  const g = new THREE.Group(); const stone = engrave(K.main, hammered(31), 0.6);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.08, 0.5, 4, 0.03), K.accent), 0, 0.04, 0));
  for (const s of [-1, 1]) { const t = new THREE.Group(); t.position.x = s * 0.56;
    t.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.3, 1.1, 0.3, 4, 0.02), stone), 0, 0.63, 0));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; t.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.1, 0.08, 2, 0.01), stone), Math.cos(a) * 0.12, 1.24, Math.sin(a) * 0.12)); }
    t.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), K.enamel), 0, 1.45, 0)).children.at(-1).rotation.y = Math.PI / 4;
    t.add(at(ball(0.03, K.bright), 0, 1.65, 0));
    for (const y of [0.5, 0.9]) t.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.12, 0.02, 2, 0.01), K.ink), 0, y, 0.16));
    g.add(t); }
  // the arch and the deck
  const arch = new THREE.Shape(); arch.moveTo(-0.42, 0.1); arch.lineTo(-0.42, 0.72); arch.lineTo(0.42, 0.72); arch.lineTo(0.42, 0.1); arch.lineTo(0.36, 0.1); arch.absarc(0, 0.1, 0.36, 0, Math.PI, false); arch.lineTo(-0.42, 0.1);
  g.add(at(extrude(arch, 0.22, stone, 0.01), 0, 0, 0));
  const ar = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI; ar.push([Math.cos(a) * 0.37, 0.1 + Math.sin(a) * 0.37, 0.12]); } g.add(tube(ar, 0.016, K.trim, 120));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.04, 0.26, 2, 0.01), K.trim), 0, 0.74, 0));
  for (let i = 0; i <= 8; i++) g.add(at(cyl(0.008, 0.008, 0.1, K.trim, 8), -0.4 + i * 0.1, 0.8, 0.11));
  g.add(tube([[-0.42, 0.85, 0.11], [0.42, 0.85, 0.11]], 0.008, K.trim, 4));
  // two pennants flying, one each
  for (const s of [-1, 1]) { const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.quadraticCurveTo(0.1, 0.02, 0.2, -0.04); pen.quadraticCurveTo(0.1, -0.05, 0, -0.1); const p = extrude(pen, 0.006, K.bright, 0.003); p.position.set(s * 0.56, 1.64, 0); p.scale.x = s; g.add(p); }
  if (K.gem) for (const s of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), s * 0.56, 0.9, 0.17));
  if (K.glow) g.add(tube(ar.map(([x, y, z]) => [x * 0.96, 0.1 + (y - 0.1) * 0.96, z + 0.01]), 0.008, K.glow, 120));
  return g; } };

/** Department wins: a great cog standing in a laurel, a lightning bolt across its hub. */
PIECES["shift-wins"] = { name: "Department wins", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.42)); g.add(at(cyl(0.06, 0.09, 0.36, K.main), 0, 0.32, 0)); g.add(ring(0.075, 0.012, K.trim, 0.48));
  const cog = new THREE.Shape(), teeth = 16, R = 0.5, r = 0.42;
  for (let i = 0; i < teeth * 4; i++) { const a = i / (teeth * 4) * Math.PI * 2, k = i % 4, rr = k === 1 || k === 2 ? R : r; i ? cog.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : cog.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.26, 0, Math.PI * 2, true); cog.holes.push(hole);
  const cm = extrude(cog, 0.1, engrave(K.main, hammered(41), 0.5), 0.015); cm.position.set(0, 1.08, 0); g.add(cm);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(tube([[Math.cos(a) * 0.1, 1.08 + Math.sin(a) * 0.1, 0], [Math.cos(a) * 0.27, 1.08 + Math.sin(a) * 0.27, 0]], 0.03, K.main, 4)); }
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 48).rotateX(Math.PI / 2), K.enamel), 0, 1.08, 0)); g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 12, 64), K.trim), 0, 1.08, 0.07));
  const bolt = new THREE.Shape(); [[0.03, 0.2], [-0.08, 0.0], [0.0, 0.0], [-0.04, -0.2], [0.09, 0.03], [0.01, 0.03], [0.05, 0.2]].forEach(([x, y], i) => i ? bolt.lineTo(x, y) : bolt.moveTo(x, y));
  g.add(at(extrude(bolt, 0.03, K.bright, 0.008), 0, 1.08, 0.09));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + Math.PI / 16; g.add(at(ball(0.014, K.bright), Math.cos(a) * 0.36, 1.08 + Math.sin(a) * 0.36, 0.06)); }
  if (K.gem) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), Math.cos(a) * 0.36, 1.08 + Math.sin(a) * 0.36, 0.07)); }
  if (K.glow) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.01, 12, 128), K.glow), 0, 1.08, 0.06));
  return g; } };

/** Shift Wars matches: a works time clock — dial on top, card rack and a punched card in the slot. */
PIECES["shift-matches"] = { name: "Clocked in", build(K, font) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.9, 0.42, 6, 0.06), K.main), 0, 0.5, 0));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.06, 0.46, 3, 0.02), K.trim), 0, 0.06, 0));
  // clock head
  const head = new THREE.Group(); head.position.set(0, 1.18, 0); g.add(head);
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 96).rotateX(Math.PI / 2), K.main));
  head.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 16, 128), K.trim), 0, 0, 0.1));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 96), new THREE.MeshPhysicalMaterial({ color: 0xf3ead6, roughness: 0.4, clearcoat: 0.6 })); face.position.z = 0.101; head.add(face);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const tk = new THREE.Mesh(new THREE.BoxGeometry(0.012, i % 3 ? 0.03 : 0.06, 0.005), K.ink); tk.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.105); tk.rotation.z = a - Math.PI / 2; head.add(tk); }
  const hand = (len, w, rot) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), K.ink); m.geometry.translate(0, len / 2, 0); m.position.z = 0.11; m.rotation.z = rot; head.add(m); };
  hand(0.16, 0.02, -0.9); hand(0.23, 0.012, 1.9); head.add(at(ball(0.02, K.enamel), 0, 0, 0.115));
  head.add(at(ball(0.05, K.trim), 0, 0.36, 0)); head.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 48), K.trim), 0, 0.42, 0));
  // card slot, lever and a punched card
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.06, 0.06, 2, 0.02), K.ink), 0, 0.72, 0.21));
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.006), new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 360, (c, w, h) => { c.fillStyle = "#f2e8cf"; c.fillRect(0, 0, w, h); c.fillStyle = "#a33"; c.font = "bold 26px sans-serif"; c.fillText("SHIFT", 20, 40);
    c.strokeStyle = "#7a6a50"; c.lineWidth = 2; for (let y = 60; y < h; y += 34) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14, y); c.stroke(); } c.fillStyle = "#333"; c.font = "18px monospace"; ["07:58", "16:02", "07:55", "16:01", "19:30"].forEach((t, i) => c.fillText(t, 26, 86 + i * 34)); }), roughness: 0.9 }));
  card.position.set(0, 0.86, 0.215); card.rotation.x = -0.05; g.add(card);
  g.add(tube([[0.35, 0.6, 0.1], [0.5, 0.6, 0.1], [0.55, 0.78, 0.1]], 0.025, K.trim, 30)); g.add(at(ball(0.05, K.enamel), 0.55, 0.8, 0.1));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.18, 0.02, 2, 0.01), K.plate), 0, 0.3, 0.215));
  if (font) { const t = textMesh(font, "IN", 0.08, 0.012, K.enamel); t.position.set(0, 0.3, 0.23); g.add(t); }
  if (K.gem) for (const x of [-0.28, 0.28]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, 0.3, 0.22));
  if (K.glow) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 12, 128), K.glow); t.position.set(0, 1.18, 0.105); g.add(t); }
  return g; } };

/** Departments beaten: crossed spanner and hammer over a three-panel shield, one panel per department. */
PIECES["shift-depts-beaten"] = { name: "Departments beaten", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.4)); g.add(at(cyl(0.06, 0.09, 0.3, K.main), 0, 0.28, 0));
  const sh = new THREE.Shape(); sh.moveTo(0, -0.46); sh.bezierCurveTo(0.36, -0.32, 0.42, -0.05, 0.42, 0.34); sh.lineTo(-0.42, 0.34); sh.bezierCurveTo(-0.42, -0.05, -0.36, -0.32, 0, -0.46);
  const shield = extrude(sh, 0.06, K.main, 0.02); shield.position.set(0, 0.95, 0); g.add(shield);
  g.add(tube(sh.getPoints(100).map(p => [p.x, 0.95 + p.y, 0.05]), 0.022, K.trim, 300));
  const cols = [0x8a1020, 0x123a7a, 0x0e4a2a];
  [[-0.27, 0.2], [0.27, 0.2], [0, -0.17]].forEach(([x, y], i) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 48).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: cols[i], roughness: 0.2, clearcoat: 1 })); c.position.set(x * 0.8, 0.95 + y, 0.065); g.add(c);
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 12, 64), K.bright), x * 0.8, 0.95 + y, 0.075)); });
  // spanner and hammer crossed behind
  const spanner = new THREE.Group(); spanner.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.07, 1.0, 0.04, 2, 0.015), K.bright), 0, 0, 0));
  const jaw = new THREE.Shape(); jaw.absarc(0, 0, 0.11, 0, Math.PI * 2, false); const jh = new THREE.Path(); jh.moveTo(-0.04, 0.12); jh.lineTo(-0.04, 0); jh.lineTo(0.04, 0); jh.lineTo(0.04, 0.12); jh.lineTo(-0.04, 0.12); jaw.holes.push(jh);
  spanner.add(at(extrude(jaw, 0.04, K.bright, 0.01), 0, 0.52, 0)); spanner.position.set(0, 1.0, -0.06); spanner.rotation.z = 0.7; g.add(spanner);
  const hammer = new THREE.Group(); hammer.add(at(cyl(0.025, 0.03, 1.0, K.accent, 16), 0, 0, 0)); hammer.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.1, 0.1, 3, 0.02), K.bright), 0, 0.5, 0));
  hammer.position.set(0, 1.0, -0.06); hammer.rotation.z = -0.7; g.add(hammer);
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), K.gem), 0, 1.36, 0.06));
  if (K.glow) g.add(tube(sh.getPoints(100).map(p => [p.x * 1.05, 0.95 + p.y * 1.05, 0]), 0.009, K.glow, 300));
  return g; } };

/** Seasons on the rota: a works hard hat with a lamp, resting on a folded hi-vis jacket. */
PIECES["shift-seasons"] = { name: "On the rota", build(K) {
  const g = new THREE.Group();
  const vis = new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#e8ff2a"; c.fillRect(0, 0, w, h); c.fillStyle = "#cfd6dc"; c.fillRect(0, h * .35, w, h * .1); c.fillRect(0, h * .6, w, h * .1); }), roughness: 0.6, sheen: 0.6 });
  const jacket = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.22, 0.8, 8, 0.1), vis); jacket.position.y = 0.11; g.add(jacket);
  const hat = new THREE.Group(); hat.position.y = 0.22; hat.rotation.z = 0.06; hat.scale.setScalar(1.35); g.add(hat);
  hat.add(smooth([[0, 0], [0.56, 0], [0.58, 0.02], [0.56, 0.04], [0.42, 0.05], [0.4, 0.1], [0.38, 0.32], [0.3, 0.46], [0.16, 0.53], [0, 0.55]], K.main));
  hat.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 0.9, 3, 0.02), K.main), 0, 0.5, 0)).children.at(-1).scale.set(1, 1, 0.8);
  const ridge = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI; ridge.push([0, 0.1 + Math.cos(a) * 0.44, Math.sin(a) * 0.4]); } hat.add(tube(ridge, 0.03, K.bright, 80));
  hat.add(ring(0.41, 0.014, K.trim, 0.1));
  // lamp on the front
  const lamp = new THREE.Group(); lamp.position.set(0, 0.28, 0.38); hat.add(lamp);
  lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.08, 32).rotateX(Math.PI / 2), K.trim));
  lamp.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.065, 32), new THREE.MeshStandardMaterial({ color: 0x302000, emissive: K.glow ? 0x6fe9ff : 0xfff0c0, emissiveIntensity: 5 })), 0, 0, 0.042));
  if (K.gem) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; hat.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), K.gem), Math.cos(a) * 0.41, 0.12, Math.sin(a) * 0.41)); }
  return g; } };

/** Inseparable (Teams showpiece): two strands twisting round each other into a pair of interlocked rings, set with stones. */
PIECES["inseparable"] = { name: "Inseparable", fit: 0.9, build(K) {
  const g = new THREE.Group();
  g.add(smooth([[0, 0], [0.6, 0], [0.62, 0.04], [0.54, 0.1], [0.46, 0.16], [0.3, 0.2], [0, 0.21]], K.main)); g.add(ring(0.61, 0.018, K.trim, 0.04)); beads(g, 0.54, 0.013, 0.11, 60, K.bright);
  g.add(band(0.46, 0.15, 0.31, 0.2, K.main, 12, 1.6));
  // the double helix
  for (const ph of [0, Math.PI]) { const pts = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = ph + t * Math.PI * 5, r = 0.14 - t * 0.04; pts.push([Math.cos(a) * r, 0.2 + t * 1.0, Math.sin(a) * r]); } g.add(tube(pts, 0.04, ph ? K.bright : K.main, 320)); }
  g.add(at(cyl(0.03, 0.03, 1.0, K.accent, 16), 0, 0.7, 0));
  for (let i = 0; i < 6; i++) g.add(at(ball(0.03, K.gem ?? K.bright), 0, 0.3 + i * 0.16, 0));
  g.add(smooth([[0, 1.18], [0.18, 1.2], [0.14, 1.26], [0.06, 1.3], [0, 1.31]], K.main)); g.add(ring(0.18, 0.014, K.trim, 1.2));
  // interlocked rings
  const c = new THREE.Group(); c.position.y = 1.72; g.add(c);
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 40, 160), K.main); r1.position.x = -0.16; r1.rotation.y = 0.5; c.add(r1);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 40, 160), K.bright); r2.position.x = 0.16; r2.rotation.y = -0.5; c.add(r2);
  for (const [x, ry] of [[-0.16, 0.5], [0.16, -0.5]]) for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), K.gem ?? K.trim);
    const p = new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.055).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); st.position.set(x + p.x, p.y, p.z); c.add(st); }
  c.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), K.gem ?? K.bright), 0, 0.38, 0));
  // laurel sprays either side of the cap
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(0.03, 0.035, 0.09, 0); ls.quadraticCurveTo(0.03, -0.035, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 16 });
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const t = i / 8, l = new THREE.Mesh(leafGeo, K.bright); l.position.set(s * (0.2 + t * 0.22), 1.24 + t * 0.26, 0); l.rotation.z = s > 0 ? 0.9 + t * 0.6 : Math.PI - 0.9 - t * 0.6; g.add(l); }
  if (K.glow) { const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.012, 16, 200), K.glow); halo.position.set(0, 1.72, -0.15); g.add(halo); }
  return g; } };

// ================================================================ Practice
const boardFace = (r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 128), new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.75 })); return m; };

/** Practice sessions: a board cabinet with its doors swung open, a dart in the board. */
PIECES["practice-sessions"] = { name: "Sessions", build(K) {
  const g = new THREE.Group(); const wood = K.tier === "BRONZE" ? K.plinth : K.main;
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.14, 4, 0.03), wood), 0, 0.85, -0.05));
  const bf = boardFace(0.36); bf.position.set(0, 0.85, 0.025); g.add(bf); g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.02, 12, 128), K.trim), 0, 0.85, 0.03));
  for (const s of [-1, 1]) { const door = new THREE.Group(); door.position.set(s * 0.45, 0.85, 0.03);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.9, 0.05, 3, 0.02), wood); panel.position.x = s * 0.225; door.add(panel);
    const inset = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.78, 0.02, 2, 0.01), engrave(K.accent, filigree(2), 0.8)); inset.position.set(s * 0.225, 0, 0.03); door.add(inset);
    door.add(at(ball(0.02, K.bright), s * 0.03, 0, 0.05)); door.rotation.y = s * 1.15; g.add(door); }
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.05, 0.22, 2, 0.015), K.trim), 0, 1.32, 0)); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.05, 0.22, 2, 0.015), K.trim), 0, 0.38, 0));
  g.add(at(cyl(0.05, 0.08, 0.36, K.main), 0, 0.18, -0.05));
  const d = dart(K, K.enamel); d.scale.setScalar(0.5); d.rotation.set(Math.PI / 2 - 0.4, 0, 0); d.position.set(0.04, 1.06, 0.03); g.add(d);
  if (K.gem) for (const x of [-0.4, 0.4]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, 1.32, 0.12));
  if (K.glow) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.008, 12, 128), K.glow), 0, 0.85, 0.04));
  return g; } };

/** Darts thrown: a turned dart stand holding a fan of darts. */
PIECES["practice-darts"] = { name: "Darts thrown", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.44));
  g.add(fluted([[0, 0.14], [0.36, 0.15], [0.38, 0.2], [0.34, 0.3], [0, 0.31]], 24, 0.05, K.main, { seg: 128 })); g.add(ring(0.36, 0.014, K.trim, 0.3));
  const cols = [K.enamel, K.bright, K.accent];
  for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.16, r = 0.05 + (i % 3) * 0.08, ang = i * 2.1;
    const d = dart(K, cols[i % 3]); d.scale.setScalar(0.95); d.rotation.set(0, 0, a); d.position.set(Math.cos(ang) * r * 0.6, 0.3, Math.sin(ang) * r * 0.6); g.add(d); }
  if (K.gem) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), Math.cos(a) * 0.36, 0.22, Math.sin(a) * 0.36)); }
  if (K.glow) g.add(ring(0.37, 0.008, K.glow, 0.25));
  return g; } };

/** Practice 180s: a neon 180 sign on a brick backboard. */
PIECES["practice-180s"] = { name: "Practice 180s", build(K, font) {
  const g = new THREE.Group();
  const brick = new THREE.MeshPhysicalMaterial({ map: canvasTex(512, 384, (c, w, h) => { c.fillStyle = "#2a1712"; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) { c.fillStyle = `hsl(10,${35 + Math.random() * 15}%,${22 + Math.random() * 8}%)`; c.fillRect(x + 2, y + 2, 60, 28); } }), roughness: 0.9 });
  const back = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.95, 0.06, 3, 0.02), brick); back.position.set(0, 0.95, -0.03); g.add(back);
  const frameShape = new THREE.Shape(); frameShape.moveTo(-0.7, -0.52); frameShape.lineTo(0.7, -0.52); frameShape.lineTo(0.7, 0.52); frameShape.lineTo(-0.7, 0.52); frameShape.lineTo(-0.7, -0.52);
  const fh = new THREE.Path(); fh.moveTo(-0.64, -0.46); fh.lineTo(0.64, -0.46); fh.lineTo(0.64, 0.46); fh.lineTo(-0.64, 0.46); fh.lineTo(-0.64, -0.46); frameShape.holes.push(fh);
  g.add(at(extrude(frameShape, 0.08, K.main, 0.02), 0, 0.95, 0));
  const neon = new THREE.MeshStandardMaterial({ color: 0x220008, emissive: K.glow ? 0x6fe9ff : K.tier === "GOLD" ? 0xffb020 : K.tier === "BRONZE" ? 0xff5a20 : 0xff3a6a, emissiveIntensity: 4 });
  if (font) { const tg = new TextGeometry("180", { font, size: 0.34, depth: 0.03, curveSegments: 16, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 4 });
    tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0); g.add(at(new THREE.Mesh(tg, neon), 0, 0.98, 0.06)); }
  const und = []; for (let i = 0; i <= 40; i++) und.push([-0.45 + i * 0.0225, 0.68 + Math.sin(i * 0.5) * 0.012, 0.06]); g.add(tube(und, 0.012, neon, 80));
  for (const [x, y] of [[-0.6, 1.4], [0.6, 1.4], [-0.6, 0.5], [0.6, 0.5]]) g.add(at(ball(0.03, K.trim), x, y, 0.06));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.36, 0.3, 3, 0.04), K.main), 0, 0.2, -0.02)); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.04, 0.34, 2, 0.01), K.trim), 0, 0.4, -0.02));
  if (K.gem) for (const x of [-0.6, 0.6]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), x, 0.95, 0.08));
  return g; } };

/** Practice checkouts: a target on a tripod with a dart in the bull. */
PIECES["practice-checkouts"] = { name: "Checkouts", build(K) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const leg = cyl(0.02, 0.03, 1.2, K.main, 12); leg.position.set(Math.cos(a) * 0.22, 0.58, Math.sin(a) * 0.22 - 0.1); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(leg); }
  const t = new THREE.Group(); t.position.set(0, 1.08, 0.05); t.rotation.x = -0.12; g.add(t);
  const cols = [0xf3ead6, 0x111114, 0x123a7a, 0xc8102e, 0xf2c230];
  cols.forEach((col, i) => { const r = 0.48 - i * 0.09; const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08 + i * 0.006, 96).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.5, clearcoat: 0.4 })); m.position.z = i * 0.003; t.add(m); });
  t.add(new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.03, 16, 160), K.main));
  for (let i = 1; i < 5; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48 - i * 0.09, 0.006, 8, 128), K.bright); ring.position.z = 0.05; t.add(ring); }
  const d = dart(K, K.enamel); d.scale.setScalar(0.62); d.rotation.set(Math.PI / 2 - 0.3, 0, 0); d.position.set(0, 0, 0.05); t.add(d);
  if (K.gem) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; t.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), K.gem), Math.cos(a) * 0.49, Math.sin(a) * 0.49, 0.04)); }
  if (K.glow) t.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.008, 12, 128), K.glow), 0, 0, 0.05));
  return g; } };

/** Checkout rate: a metronome — steady rhythm, every dart the same. */
PIECES["practice-checkout-rate"] = { name: "Checkout rate", build(K) {
  const g = new THREE.Group(); const body = K.tier === "BRONZE" ? K.plinth : K.main;
  const prof = new THREE.Shape(); prof.moveTo(-0.42, 0); prof.lineTo(0.42, 0); prof.lineTo(0.14, 1.3); prof.lineTo(-0.14, 1.3); prof.lineTo(-0.42, 0);
  g.add(extrude(prof, 0.34, body, 0.03));
  const face = new THREE.Shape(); face.moveTo(-0.3, 0.12); face.lineTo(0.3, 0.12); face.lineTo(0.1, 1.15); face.lineTo(-0.1, 1.15); face.lineTo(-0.3, 0.12);
  g.add(at(extrude(face, 0.02, engrave(K.accent, sunburst(), 0.4), 0.006), 0, 0, 0.215));
  for (let i = 0; i < 9; i++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.01), K.bright), 0, 0.4 + i * 0.075, 0.235)).children.at(-1).scale.x = i % 2 ? 6 : 10;
  const arm = new THREE.Group(); arm.position.set(0, 0.22, 0.25); arm.rotation.z = 0.32; g.add(arm);
  arm.add(at(cyl(0.012, 0.012, 1.05, K.bright, 12), 0, 0.52, 0)); arm.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.09, 0.05, 2, 0.015), K.enamel), 0, 0.72, 0));
  arm.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 16), K.bright), 0, 1.08, 0));
  g.add(at(ball(0.035, K.trim), 0, 0.22, 0.25));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.06, 0.42, 3, 0.02), K.trim), 0, 0.0, 0));
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), 0, 1.22, 0.2));
  if (K.glow) g.add(tube([[-0.3, 0.12, 0.24], [0.3, 0.12, 0.24], [0.1, 1.15, 0.24], [-0.1, 1.15, 0.24], [-0.3, 0.12, 0.24]], 0.008, K.glow, 40));
  return g; } };

/** Games tried: a stack of game boxes with dice and counters. */
PIECES["practice-games"] = { name: "Games tried", build(K, font) {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); g.scale.setScalar(1.35); const lids = [0x8a1020, 0x123a7a, 0x0e4a2a];
  [[0, 0.09, 0.9, 0.18, 0.66, 0.1], [0.04, 0.27, 0.78, 0.16, 0.58, -0.12], [-0.02, 0.43, 0.66, 0.14, 0.5, 0.2]].forEach(([x, y, w, h, d, ry], i) => {
    const box = new THREE.Group(); box.position.set(x, y, 0); box.rotation.y = ry; g.add(box);
    box.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.02), new THREE.MeshPhysicalMaterial({ color: lids[i], roughness: 0.3, clearcoat: 0.8 })));
    box.add(at(new THREE.Mesh(new RoundedBoxGeometry(w + 0.01, 0.02, d + 0.01, 2, 0.008), K.trim), 0, h / 2 - 0.01, 0));
    box.add(at(new THREE.Mesh(new RoundedBoxGeometry(w * 0.5, 0.004, d * 0.4, 2, 0.002), engrave(K.bright, filigree(1), 0.6)), 0, h / 2 + 0.002, 0)); });
  const die = (x, z, rot, s = 0.14) => { const d = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 4, s * 0.18), K.bright); d.position.set(x, 0.5 + s / 2, z); d.rotation.set(rot, rot * 1.3, 0); g.add(d);
    for (const [px, py] of [[-.25, -.25], [.25, .25], [0, 0]]) g.add(at(ball(s * 0.08, K.ink), x + px * s, 0.5 + s + 0.002, z + py * s)); };
  die(-0.1, 0.04, 0.3); die(0.12, -0.06, 0.8, 0.12);
  for (let i = 0; i < 4; i++) g.add(at(cyl(0.045, 0.045, 0.03, new THREE.MeshPhysicalMaterial({ color: [0xc8102e, 0x123a7a, 0x0e4a2a, 0xf2c230][i], roughness: 0.3, clearcoat: 1 }), 24), 0.3 - i * 0.08, 0.2 + 0.015, 0.36));
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), 0.25, 0.53, 0.1));
  if (K.glow) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.012, 0.68, 2, 0.005), K.glow), 0, 0.005, 0));
  return outer; } };

/** Days practised: a desk flip-calendar on its stand. */
PIECES["practice-days"] = { name: "Days practised", build(K) {
  const g = new THREE.Group();
  const stand = new THREE.Shape(); stand.moveTo(-0.5, 0); stand.lineTo(0.5, 0); stand.lineTo(0.42, 1.1); stand.lineTo(-0.42, 1.1); stand.lineTo(-0.5, 0);
  g.add(at(extrude(stand, 0.3, K.main, 0.03), 0, 0, -0.05));
  const page = new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 300, (c, w, h) => { c.fillStyle = "#f6f1e4"; c.fillRect(0, 0, w, h); c.fillStyle = "#b3122a"; c.fillRect(0, 0, w, 70);
    c.fillStyle = "#fff"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.fillText("DAY", w / 2, 52); c.fillStyle = "#1a1a1a"; c.font = "bold 150px sans-serif"; c.fillText("30", w / 2, 230); c.font = "22px sans-serif"; c.fillStyle = "#777"; c.fillText("PRACTISED", w / 2, 280); }), roughness: 0.8 });
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.74), page); pg.position.set(0, 0.62, 0.15); pg.rotation.x = -0.035; g.add(pg);
  for (let i = 1; i < 4; i++) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.74), new THREE.MeshPhysicalMaterial({ color: 0xece4d2, roughness: 0.9 })), 0, 0.62 - i * 0.003, 0.15 - i * 0.004));
  for (let i = 0; i < 6; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 24), K.bright), -0.25 + i * 0.1, 1.0, 0.16));
  // the flipped page curling over the top
  const flip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 32, 1, true, 0, Math.PI * 1.3), new THREE.MeshPhysicalMaterial({ color: 0xece4d2, roughness: 0.9, side: THREE.DoubleSide })); flip.rotation.z = Math.PI / 2; flip.position.set(0, 1.04, 0.12); g.add(flip);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.06, 0.46, 3, 0.02), K.trim), 0, 0.03, 0.05));
  if (K.gem) for (const x of [-0.38, 0.38]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, 0.08, 0.28));
  if (K.glow) g.add(tube([[-0.31, 0.25, 0.12], [0.31, 0.25, 0.12], [0.31, 0.99, 0.12], [-0.31, 0.99, 0.12], [-0.31, 0.25, 0.12]], 0.008, K.glow, 40));
  return g; } };

/** Practice streak: a curving run of dominoes mid-topple. */
PIECES["practice-streak"] = { name: "Streak", build(K) {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); g.scale.setScalar(1.45); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.05, 0.62, 3, 0.02), K.accent), 0, 0.025, 0));
  const n = 9;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), a = -0.9 + t * 1.8, x = Math.sin(a) * 0.55, z = Math.cos(a) * 0.3 - 0.1, fall = i < 3 ? 1.2 - i * 0.25 : 0;
    const dm = new THREE.Group(); dm.position.set(x, 0.06, z); dm.rotation.y = -a + Math.PI / 2;
    const tile = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.4, 0.05, 3, 0.015), i % 2 ? K.main : K.bright); tile.geometry.translate(0, 0.2, 0); tile.rotation.x = -fall; dm.add(tile);
    for (const y of [0.1, 0.3]) for (let k = 0; k < (i % 3) + 1; k++) { const p = ball(0.012, K.ink); p.position.set(-0.03 + k * 0.03, y, 0.027); const pg = new THREE.Group(); pg.add(p); pg.rotation.x = -fall; dm.add(pg); }
    g.add(dm); }
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), 0.55, 0.6, 0.0));
  if (K.glow) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.07, 0.012, 0.64, 2, 0.005), K.glow), 0, 0.005, 0));
  return outer; } };

/** Shadow level: the Shadow Bot — a robot bust in a glass dome, eyes lit. */
PIECES["shadow-level"] = { name: "Shadow level", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.46));
  const shadow = new THREE.MeshPhysicalMaterial({ color: 0x14161c, metalness: 0.8, roughness: 0.25, clearcoat: 1 });
  g.add(smooth([[0, 0.14], [0.36, 0.15], [0.3, 0.3], [0.2, 0.36], [0, 0.37]], shadow));
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.42, 0.42, 6, 0.1), shadow); head.position.y = 0.62; g.add(head);
  const eye = new THREE.MeshStandardMaterial({ color: 0x100000, emissive: K.glow ? 0x6fe9ff : 0xff3040, emissiveIntensity: 5 });
  for (const x of [-0.11, 0.11]) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 32).rotateX(Math.PI / 2), eye), x, 0.66, 0.215));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.04, 0.02, 2, 0.01), K.bright), 0, 0.52, 0.215));
  for (const s of [-1, 1]) { g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 24).rotateZ(Math.PI / 2), K.trim), s * 0.28, 0.62, 0)); }
  g.add(at(cyl(0.012, 0.012, 0.16, K.trim, 8), 0, 0.9, 0)); g.add(at(ball(0.035, eye), 0, 0.99, 0));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.035, 0.44, 2, 0.01), K.main), 0, 0.85, 0));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.035, 0.44, 2, 0.01), K.main), 0, 0.41, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass()); dome.position.y = 0.38; dome.scale.y = 1.6; g.add(dome);
  g.add(at(cyl(0.46, 0.46, 0.4, glass(), 48), 0, 0.18 + 0.2, 0)).children.at(-1).scale.y = 0.0001;
  g.add(ring(0.465, 0.02, K.trim, 0.38)); g.add(at(ball(0.04, K.trim), 0, 0.38 + 0.46 * 1.6, 0));
  if (K.gem) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), K.gem), Math.cos(a) * 0.465, 0.4, Math.sin(a) * 0.465)); }
  return g; } };

/** Iron discipline (Practice showpiece): a grindstone sharpening a dart, sparks flying. */
PIECES["grindstone"] = { name: "Iron discipline", ry: -0.7, fit: 1.12, build(K) {
  const g = new THREE.Group();
  const iron = engrave(K.main, hammered(55), 0.6);
  for (const s of [-1, 1]) { const leg = new THREE.Shape(); leg.moveTo(-0.08, 0); leg.lineTo(0.08, 0); leg.lineTo(0.03, 1.0); leg.lineTo(-0.03, 1.0); leg.lineTo(-0.08, 0);
    const lm = extrude(leg, 0.08, iron, 0.015); lm.position.set(0, 0.1, s * 0.22); g.add(lm); g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 12, 32), K.main), 0, 1.08, s * 0.22)); }
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.1, 0.7, 3, 0.03), iron), 0, 0.05, 0));
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 96), new THREE.MeshPhysicalMaterial({ color: 0x8a8378, roughness: 0.95, bumpMap: hammered(77), bumpScale: 3 })); stone.rotation.x = Math.PI / 2; stone.position.y = 1.08; g.add(stone);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 48), K.main); cap.rotation.x = Math.PI / 2; cap.position.set(0, 1.08, s * 0.09); g.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 16, 160), K.bright); rim.position.set(0, 1.08, s * 0.08); g.add(rim);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem ?? K.bright), Math.cos(a) * 0.34, 1.08 + Math.sin(a) * 0.34, s * 0.09)); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(tube([[Math.cos(a) * 0.16, 1.08 + Math.sin(a) * 0.16, s * 0.095], [Math.cos(a) * 0.3, 1.08 + Math.sin(a) * 0.3, s * 0.095]], 0.012, K.main, 4)); } }
  g.add(at(smooth([[0, 0], [0.62, 0], [0.64, 0.04], [0.56, 0.1], [0, 0.11]], K.main), 0, 0.1, 0)); beads(g, 0.58, 0.012, 0.16, 56, K.bright);
  g.add(at(cyl(0.025, 0.025, 0.62, K.bright, 16), 0, 1.08, 0)).children.at(-1).rotation.x = Math.PI / 2;
  // crank handle
  g.add(tube([[0, 1.08, 0.31], [0, 1.08, 0.36], [0.22, 1.2, 0.36], [0.22, 1.2, 0.48]], 0.02, K.main, 30)); g.add(at(cyl(0.035, 0.035, 0.14, K.enamel, 16), 0.22, 1.2, 0.48)).children.at(-1).rotation.x = Math.PI / 2;
  // the dart held to the wheel and a shower of sparks
  const d = dart(K, K.enamel); d.scale.setScalar(0.85); d.rotation.set(0, 0, Math.PI / 2 + 0.25); d.position.set(0.5, 1.4, 0); g.add(d);
  const spark = new THREE.MeshStandardMaterial({ color: 0x301000, emissive: 0xff8a20, emissiveIntensity: 4 });
  const r = rng(13); for (let i = 0; i < 22; i++) { const a = Math.PI * (0.85 + r() * 0.5), len = 0.08 + r() * 0.18, x0 = 0.42, y0 = 1.36;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.002, len, 6), spark); sp.position.set(x0 + Math.cos(a) * (0.12 + r() * 0.45), y0 + Math.sin(a) * (0.1 + r() * 0.35) + 0.2, (r() - 0.5) * 0.3); sp.rotation.z = a + Math.PI / 2; g.add(sp); }
  // brass plaque on the base: 'every day'
  if (K.gem) for (let i = 0; i < 6; i++) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), -0.35 + i * 0.14, 0.11, 0.35));
  if (K.glow) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 12, 160), K.glow); t.position.set(0, 1.08, -0.085); g.add(t); }
  return g; } };

// ================================================================ Master-501
/** Ladder climbed: a gilded ladder leaning up to a star, rungs numbered by tier. */
PIECES["m501-ladder"] = { name: "Ladder climbed", build(K) {
  const g = new THREE.Group(); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.6, 3, 0.03), K.accent), 0, 0.04, 0));
  const lad = new THREE.Group(); lad.position.set(-0.1, 0.08, 0); lad.rotation.z = -0.22; g.add(lad);
  for (const x of [-0.18, 0.18]) lad.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.05, 1.6, 0.06, 2, 0.015), K.main), x, 0.8, 0));
  for (let i = 0; i < 8; i++) { lad.add(at(cyl(0.02, 0.02, 0.36, i % 3 === 2 ? K.bright : K.trim, 12), 0, 0.15 + i * 0.19, 0)).children.at(-1).rotation.z = Math.PI / 2; }
  lad.add(at(extrude(starShape(0.15, 0.065), 0.04, K.bright, 0.012), 0, 1.78, 0));
  // a small dart climbing the ladder
  const d = dart(K, K.enamel); d.scale.setScalar(0.4); d.rotation.z = -0.4; d.position.set(0.1, 1.0, 0.06); lad.add(d);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.04, 0.3, 2, 0.01), K.trim), 0.15, 0.1, 0));
  if (K.gem) for (let i = 0; i < 5; i++) lad.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), K.gem), 0.2, 0.25 + i * 0.3, 0.04));
  if (K.glow) lad.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 12, 64), K.glow), 0, 1.78, -0.02));
  return g; } };

/** Runs completed: a stone milestone marker carved 501, with an iron ring. */
PIECES["m501-runs"] = { name: "Runs completed", build(K, font) {
  const g = new THREE.Group(); const stone = engrave(K.main, hammered(61), 0.7);
  const ms = new THREE.Shape(); ms.moveTo(-0.38, 0); ms.lineTo(0.38, 0); ms.lineTo(0.38, 0.9); ms.absarc(0, 0.9, 0.38, 0, Math.PI, false); ms.lineTo(-0.38, 0);
  g.add(at(extrude(ms, 0.3, stone, 0.03), 0, 0.08, 0));
  const inner = new THREE.Shape(); inner.moveTo(-0.3, 0); inner.lineTo(0.3, 0); inner.lineTo(0.3, 0.88); inner.absarc(0, 0.88, 0.3, 0, Math.PI, false); inner.lineTo(-0.3, 0);
  g.add(at(extrude(inner, 0.02, K.enamel, 0.006), 0, 0.14, 0.17));
  if (font) { const t = textMesh(font, "501", 0.2, 0.03, K.bright); t.position.set(0, 0.85, 0.19); g.add(t); }
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 16, 64), K.trim), 0, 0.42, 0.21));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.55, 3, 0.03), K.accent), 0, 0.04, 0));
  const r = rng(9); for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04 + r() * 0.04, 0), K.accent); b.position.set(-0.45 + r() * 0.9, 0.1, 0.2 + r() * 0.06); g.add(b); }
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), K.gem), 0, 1.25, 0.18));
  if (K.glow) g.add(tube(inner.getPoints(60).map(p => [p.x * 1.05, 0.14 + p.y, 0.2]), 0.008, K.glow, 120));
  return g; } };

/** Master-501 wins: a championship belt draped over a stand, the 501 centre plate set with stones. */
PIECES["m501-wins"] = { name: "Master-501 wins", build(K, font) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.9, 0.18, 3, 0.03), K.accent), 0, 0.45, -0.1)); g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.06, 0.3, 3, 0.02), K.accent), 0, 0.92, -0.1));
  const leather = new THREE.MeshPhysicalMaterial({ color: K.enamel.color, roughness: 0.55, sheen: 0.6, bumpMap: hammered(71), bumpScale: 0.3 });
  const strap = []; for (let i = 0; i <= 60; i++) { const t = i / 60, x = -0.75 + t * 1.5; strap.push([x, 0.95 - Math.pow(Math.abs(x) / 0.75, 2) * 0.45, 0.05 - Math.abs(x) * 0.1]); }
  const sg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strap.map(p => new THREE.Vector3(...p))), 120, 0.1, 4, false); const sm = new THREE.Mesh(sg, leather); sm.scale.z = 0.25; g.add(sm);
  const plate = new THREE.Group(); plate.position.set(0, 0.96, 0.08); g.add(plate);
  const ps = new THREE.Shape(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, rx = 0.34, ry = 0.24, w = 1 + Math.sin(a * 8) * 0.04; i ? ps.lineTo(Math.cos(a) * rx * w, Math.sin(a) * ry * w) : ps.moveTo(rx * w, 0); }
  plate.add(extrude(ps, 0.04, engrave(K.main, sunburst(), 0.4), 0.015));
  plate.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 64).rotateX(Math.PI / 2), K.enamel), 0, 0, 0.03));
  if (font) { const t = textMesh(font, "501", 0.09, 0.02, K.bright); t.position.z = 0.05; plate.add(t); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; plate.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), K.gem ?? K.bright), Math.cos(a) * 0.25, Math.sin(a) * 0.17, 0.04)); }
  for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 6).rotateX(Math.PI / 2), K.main); side.position.set(s * 0.5, 0.78, 0.04); side.rotation.z = s * 0.4; g.add(side); }
  if (K.glow) plate.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 12, 64), K.glow), 0, 0, 0.05));
  return g; } };

/** Master-501 winning run: a comet streaking upward with a fiery tail. */
PIECES["m501-run"] = { name: "Winning run", build(K) {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(turnedFoot(K, 0.4)); outer.add(g); g.scale.set(1.25, 1.0, 1.25);
  const arc = []; for (let i = 0; i <= 80; i++) { const t = i / 80; arc.push([-0.4 + t * 0.7, 0.2 + t * t * 1.3, 0]); }
  g.add(tube(arc, 0.05, K.main, 160));
  for (let i = 0; i < 4; i++) { const pts = arc.map(([x, y, z], k) => [x - 0.03 * i, y + 0.02 * i * Math.sin(k / 6 + i), z + (i - 1.5) * 0.04]); g.add(tube(pts.slice(20 + i * 10), 0.012 + i * 0.003, i % 2 ? K.bright : K.trim, 120)); }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), K.bright); head.material = head.material.clone(); head.material.flatShading = true; head.position.set(0.3, 1.5, 0); g.add(head);
  const fire = new THREE.MeshStandardMaterial({ color: 0x2a0a00, emissive: K.glow ? 0x6fe9ff : 0xff8a20, emissiveIntensity: 3 });
  g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), fire), 0.3, 1.5, 0.1));
  for (let i = 0; i < 5; i++) g.add(at(extrude(starShape(0.035, 0.015), 0.01, K.bright, 0.004), -0.3 + i * 0.14, 0.4 + i * 0.22 + (i % 2) * 0.1, 0.1));
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0.3, 1.5, 0.22));
  return outer; } };

/** World champion (Master-501 showpiece): the dart in the stone. */
PIECES["dart-in-stone"] = { name: "World champion", fit: 0.88, build(K, font) {
  const g = new THREE.Group(); const rock = new THREE.MeshPhysicalMaterial({ color: 0x6f6a62, roughness: 0.9, bumpMap: hammered(91), bumpScale: 2.5, flatShading: true });
  let geo = new THREE.IcosahedronGeometry(0.55, 1); geo.deleteAttribute("uv"); geo.deleteAttribute("normal"); geo = mergeVertices(geo); const p = geo.attributes.position, r = rng(17);
  for (let i = 0; i < p.count; i++) { const k = 0.8 + r() * 0.35; p.setXYZ(i, p.getX(i) * k * 1.3, Math.max(-0.1, p.getY(i)) * k * 0.9, p.getZ(i) * k); }
  geo = geo.toNonIndexed(); geo.computeVertexNormals(); const stone = new THREE.Mesh(geo, rock); stone.position.y = 0.2; g.add(stone);
  // gold veins in the stone
  for (let i = 0; i < 5; i++) { const pts = []; for (let k = 0; k <= 8; k++) pts.push([(r() - 0.5) * 0.9, 0.1 + k * 0.05, 0.35 + r() * 0.15]); g.add(tube(pts, 0.008, K.bright, 40)); }
  const d = dart(K, K.enamel); d.scale.setScalar(1.85); d.position.set(0, 0.42, 0); d.rotation.z = 0.05; g.add(d);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.016, 16, 160), K.glow ?? K.bright); halo.position.set(0, 1.62, -0.12); g.add(halo);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(at(extrude(starShape(0.03, 0.013), 0.008, K.bright, 0.003), Math.cos(a) * 0.4, 1.62 + Math.sin(a) * 0.4, -0.1)); }
  if (K.gem) for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.45)); }
  return g; } };

// ================================================================ Board Curse and Boss Battle
/** Board Curse wins: a cursed board bound in chains with a padlock. */
PIECES["board-curse-wins"] = { name: "Board Curse wins", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.4)); g.add(at(cyl(0.06, 0.09, 0.3, K.main), 0, 0.28, 0));
  const b = new THREE.Group(); b.position.set(0, 0.95, 0); g.add(b);
  const face = boardFace(0.46); face.material = face.material.clone(); face.material.color.setHex(0x9a8aa8); face.position.z = 0.04; b.add(face);
  b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 96).rotateX(Math.PI / 2), K.accent)); b.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 16, 160), K.main), 0, 0, 0.04));
  const link = new THREE.TorusGeometry(0.035, 0.011, 10, 24);
  for (const a of [0.7, -0.7]) for (let i = -9; i <= 9; i++) { const l = new THREE.Mesh(link, K.trim); const t = i * 0.055; l.position.set(Math.cos(a) * t * 1, Math.sin(a) * t, 0.08); l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, a); b.add(l); }
  const lock = new THREE.Group(); lock.position.set(0, -0.02, 0.12); b.add(lock);
  lock.add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.13, 0.05, 3, 0.02), K.bright)); lock.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 12, 32, Math.PI), K.trim), 0, 0.065, 0));
  lock.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16).rotateX(Math.PI / 2), K.ink), 0, -0.01, 0.027));
  const curse = new THREE.MeshStandardMaterial({ color: 0x100018, emissive: K.glow ? 0x6fe9ff : 0x9a40ff, emissiveIntensity: 3 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; b.add(at(ball(0.018, curse), Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0.05)); }
  if (K.gem) b.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), 0, -0.02, 0.15));
  return g; } };

/** Endless streak: an infinity loop ribbon on a stand. */
PIECES["board-curse-streak"] = { name: "Endless streak", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.4)); g.add(at(cyl(0.05, 0.08, 0.42, K.main), 0, 0.33, 0)); g.add(ring(0.065, 0.012, K.trim, 0.54));
  const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200 * Math.PI * 2, d = 1 + Math.sin(t) ** 2; pts.push([0.55 * Math.cos(t) / d, 1.0 + 0.55 * Math.sin(t) * Math.cos(t) / d, 0.08 * Math.sin(t * 2)]); }
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), true);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.05, 24, true), K.main));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.058, 24, true), engrave(K.bright, filigree(30), 1.2))).children.at(-1).scale.set(1, 1, 1);
  for (let i = 0; i < 12; i++) { const p2 = curve.getPoint(i / 12); g.add(at(ball(0.02, K.gem ?? K.trim), p2.x, p2.y, p2.z + 0.055)); }
  g.add(at(cyl(0.02, 0.02, 0.4, K.trim, 12), 0, 0.75, 0));
  if (K.glow) g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.012, 12, true), K.glow)).children.at(-1).position.z = 0.06;
  return g; } };

/** Bosses defeated: a horned boss helmet on a pike, the visor glowing. */
PIECES["bosses-defeated"] = { name: "Bosses defeated", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.42)); g.add(at(cyl(0.05, 0.08, 0.36, K.main), 0, 0.3, 0));
  const helm = new THREE.Group(); helm.position.y = 0.9; g.add(helm);
  helm.add(smooth([[0, -0.36], [0.3, -0.34], [0.36, -0.2], [0.38, 0.05], [0.33, 0.25], [0.2, 0.38], [0, 0.42]], engrave(K.main, hammered(81), 0.5)));
  helm.add(ring(0.37, 0.02, K.trim, -0.02)); helm.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.6, 0.06, 2, 0.02), K.bright), 0, 0.05, 0.36));
  const visor = new THREE.MeshStandardMaterial({ color: 0x100000, emissive: K.glow ? 0x6fe9ff : 0xff3020, emissiveIntensity: 4 });
  for (const s of [-1, 1]) { helm.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.04, 0.04, 2, 0.015), visor), s * 0.13, 0.02, 0.345)).children.at(-1).rotation.y = -s * 0.35;
    const horn = []; for (let i = 0; i <= 30; i++) { const t = i / 30; horn.push([s * (0.32 + t * 0.32), 0.15 + Math.sin(t * 2.2) * 0.42, -t * 0.05]); }
    const hg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(horn.map(p => new THREE.Vector3(...p))), 60, 0.07, 20, false); const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) { const k = Math.floor(i / 21) / 60; const c = new THREE.CatmullRomCurve3(horn.map(p => new THREE.Vector3(...p))).getPoint(k); hp.setXYZ(i, c.x + (hp.getX(i) - c.x) * (1 - k * 0.9), c.y + (hp.getY(i) - c.y) * (1 - k * 0.9), c.z + (hp.getZ(i) - c.z) * (1 - k * 0.9)); }
    hg.computeVertexNormals(); helm.add(new THREE.Mesh(hg, K.bright)); }
  for (let i = 0; i < 10; i++) { const a = Math.PI + i / 9 * Math.PI; helm.add(at(ball(0.016, K.bright), Math.cos(a) * 0.36, -0.2, -Math.sin(a) * 0.36)); }
  if (K.gem) helm.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), 0, 0.3, 0.33));
  return g; } };

/** Ascension: a spire of three rising tiers, each a level of ascension, a light at the top. */
PIECES["boss-ascension"] = { name: "Ascension", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.46));
  [[0.36, 0.14, 0.4], [0.26, 0.54, 0.4], [0.17, 0.94, 0.4]].forEach(([r, y, h], i) => { g.add(fluted([[r, y], [r * 0.96, y + h * 0.5], [r * 0.82, y + h]], 8, 0.1, K.main, { twist: 1.5 + i, seg: 96, div: 40 }));
    g.add(ring(r * 0.84, 0.014, K.trim, y + h)); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + i; g.add(at(ball(0.02, K.gem ?? K.bright), Math.cos(a) * r * 0.9, y + h * 0.5, Math.sin(a) * r * 0.9)); } });
  const light = new THREE.MeshStandardMaterial({ color: 0x302000, emissive: K.glow ? 0x6fe9ff : 0xffd27a, emissiveIntensity: 4 });
  g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), light), 0, 1.5, 0)); g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.8, transparent: true, opacity: 0.4, roughness: 0, thickness: 0.2 })), 0, 1.5, 0));
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.16, 1.4, 0); w.scale.x = s;
    for (let i = 0; i < 6; i++) { const f = new THREE.Shape(); const len = 0.18 + i * 0.04; f.moveTo(0, 0); f.quadraticCurveTo(len * 0.5, 0.04, len, 0.01); f.quadraticCurveTo(len * 0.5, -0.02, 0, -0.02); const fm = extrude(f, 0.008, K.bright, 0.003); fm.rotation.z = 0.2 + i * 0.16; w.add(fm); } g.add(w); }
  return g; } };

/** Boss slayer (Modes showpiece): a sword driven through a horned skull, on a pile of defeated boss crests. */
PIECES["boss-slayer"] = { name: "Boss slayer", fit: 0.95, build(K) {
  const g = new THREE.Group();
  const cols = [0x8a1020, 0x123a7a, 0x0e4a2a, 0x3d1466, 0x6a3a10, 0x111114];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sh = new THREE.Shape(); sh.moveTo(0, -0.12); sh.bezierCurveTo(0.1, -0.08, 0.1, 0, 0.1, 0.08); sh.lineTo(-0.1, 0.08); sh.bezierCurveTo(-0.1, 0, -0.1, -0.08, 0, -0.12);
    const m = extrude(sh, 0.03, new THREE.MeshPhysicalMaterial({ color: cols[i], roughness: 0.2, clearcoat: 1 }), 0.01); m.position.set(Math.cos(a) * 0.38, 0.1, Math.sin(a) * 0.3); m.rotation.set(-1.2, 0, a); g.add(m); }
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xe8e0cc, roughness: 0.6, clearcoat: 0.3 });
  const skull = new THREE.Group(); skull.position.y = 0.42; g.add(skull);
  skull.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 48, 32), bone), 0, 0.08, 0)); skull.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.16, 0.26, 4, 0.06), bone), 0, -0.14, 0.04));
  const dark = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: K.glow ? 0x6fe9ff : 0xff3020, emissiveIntensity: 2 });
  for (const s of [-1, 1]) { skull.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), dark), s * 0.1, 0.02, 0.22));
    const horn = []; for (let i = 0; i <= 20; i++) { const t = i / 20; horn.push([s * (0.24 + t * 0.26), 0.16 + Math.sin(t * 2.4) * 0.3, -0.04]); } skull.add(tube(horn, 0.045, K.bright, 40)); }
  // the sword
  const sw = new THREE.Group(); sw.position.set(0, 0.42, 0.02); sw.rotation.z = 0.08; sw.scale.setScalar(1.3); g.add(sw);
  const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.lineTo(0.06, 0.12); blade.lineTo(0.05, 1.3); blade.lineTo(-0.05, 1.3); blade.lineTo(-0.06, 0.12); blade.lineTo(0, 0);
  sw.add(at(extrude(blade, 0.02, new THREE.MeshPhysicalMaterial({ color: 0xe6ebf0, metalness: 1, roughness: 0.08 }), 0.008), 0, -0.2, 0));
  sw.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.06, 0.08, 3, 0.02), K.main), 0, 1.12, 0)); for (const s of [-1, 1]) sw.add(at(ball(0.045, K.gem ?? K.bright), s * 0.26, 1.12, 0));
  sw.add(at(cyl(0.035, 0.035, 0.32, K.enamel, 16), 0, 1.31, 0)); for (let i = 0; i < 5; i++) sw.add(ring(0.038, 0.007, K.bright, 1.18 + i * 0.06)); sw.add(at(ball(0.06, K.main), 0, 1.5, 0));
  if (K.glow) sw.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.01, 12, 64), K.glow), 0, 1.12, -0.04));
  return g; } };

// ================================================================ Career mode (bragging rights)
const leafGeo = (len = 0.085, wid = 0.035) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(len * 0.35, wid, len, 0); s.quadraticCurveTo(len * 0.35, -wid, 0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 14 }); };
/** A laurel wreath in the xy plane: two branches meeting at the bottom, open at the top. */
const wreath = (R, mat, n = 22, gap = 0.55) => { const g = new THREE.Group(), geo = leafGeo(0.11, 0.045);
  for (const side of [-1, 1]) { const pts = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + side * (i / 40) * (Math.PI - gap); pts.push([Math.cos(a) * R, Math.sin(a) * R, 0]); } g.add(tube(pts, 0.012, mat, 80));
    for (let i = 1; i <= n; i++) { const a = -Math.PI / 2 + side * (i / n) * (Math.PI - gap), x = Math.cos(a) * R, y = Math.sin(a) * R;
      for (const o of [-1, 1]) { const l = new THREE.Mesh(geo, mat); l.position.set(x, y, 0.004 * o); l.rotation.z = a + side * Math.PI / 2 + o * 0.75 - side * 0.35; g.add(l); } } }
  return g; };
const continents = () => canvasTex(1024, 512, (c, w, h) => { c.fillStyle = "#0d2a55"; c.fillRect(0, 0, w, h); const r = rng(4);
  c.strokeStyle = "rgba(255,255,255,.12)"; c.lineWidth = 2; for (let i = 1; i < 12; i++) { c.beginPath(); c.moveTo(i / 12 * w, 0); c.lineTo(i / 12 * w, h); c.stroke(); } for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, i / 6 * h); c.lineTo(w, i / 6 * h); c.stroke(); }
  c.fillStyle = "#e9cf86"; const blob = (x, y, s) => { for (let i = 0; i < 26; i++) { c.beginPath(); c.arc((x + (r() - 0.5) * s) * w, (y + (r() - 0.5) * s * 0.8) * h, (0.012 + r() * 0.03) * w, 0, 7); c.fill(); } };
  [[0.2, 0.32, 0.16], [0.27, 0.66, 0.12], [0.5, 0.3, 0.09], [0.53, 0.58, 0.14], [0.7, 0.33, 0.2], [0.84, 0.7, 0.08], [0.47, 0.88, 0.25]].forEach(([x, y, s]) => blob(x, y, s)); });

/** Career wins: a world globe in a gimbal on a turned stand, a dart orbiting it on its flight path. */
PIECES["career-wins"] = { name: "Pro Circuit", build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.44));
  g.add(fluted([[0.07, 0.14], [0.11, 0.2], [0.06, 0.34], [0.05, 0.56], [0.09, 0.62], [0.05, 0.68], [0, 0.7]], 12, 0.12, K.main, { seg: 96 })); g.add(ring(0.1, 0.012, K.trim, 0.2)); g.add(ring(0.07, 0.01, K.trim, 0.62));
  const globe = new THREE.Group(); globe.position.y = 1.22; globe.rotation.z = 0.41; g.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 96, 64), new THREE.MeshPhysicalMaterial({ map: continents(), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0.1 })));
  globe.add(at(ball(0.04, K.trim), 0, 0.5, 0)); globe.add(at(ball(0.04, K.trim), 0, -0.5, 0));
  // meridian ring (half round, engraved) and a horizon ring with degree beads
  const mer = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.02, 20, 160, Math.PI * 1.5), K.main); mer.rotation.z = -Math.PI * 0.25; mer.rotation.y = Math.PI / 2; globe.add(mer);
  g.add(ring(0.56, 0.026, K.main, 1.22)); beads(g, 0.56, 0.01, 1.25, 72, K.bright); g.add(band(0.585, 1.205, 0.585, 1.235, K.main, 16, 1.4));
  for (const s of [-1, 1]) g.add(tube([[s * 0.56, 1.2, 0], [s * 0.5, 0.95, 0], [s * 0.22, 0.72, 0], [0, 0.68, 0]], 0.022, K.main, 60));
  // the orbit: an elliptical flight path with a dart riding it
  const orbit = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; orbit.push([Math.cos(a) * 0.78, 1.22 + Math.sin(a) * 0.16, Math.sin(a) * 0.5]); }
  const o = tube(orbit, 0.008, K.accent, 320); g.add(o); for (let i = 0; i < 24; i++) { const p = orbit[Math.floor(i / 24 * 160)]; g.add(at(ball(0.012, K.bright), ...p)); }
  const d = dart(K, K.enamel); d.scale.setScalar(0.55); d.position.set(0.55, 1.42, 0.38); d.rotation.set(0.3, 0, -1.9); g.add(d);
  if (K.gem) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), Math.cos(a) * 0.56, 1.255, Math.sin(a) * 0.56)); }
  if (K.glow) g.add(ring(0.47, 0.008, K.glow, 1.22));
  return g; } };

/** Titles: a presentation salver standing on an easel, its centre engraved with a board, a winner's goblet before it. */
PIECES["career-titles"] = { name: "Silverware", build(K) {
  const g = new THREE.Group();
  const s = new THREE.Group(); s.position.set(0, 1.08, -0.1); s.rotation.x = -0.18; g.add(s);
  const rim = new THREE.Shape(); for (let i = 0; i <= 360; i++) { const a = i / 360 * Math.PI * 2, r = 0.82 + Math.sin(a * 16) * 0.03; i ? rim.lineTo(Math.cos(a) * r, Math.sin(a) * r) : rim.moveTo(r, 0); }
  s.add(extrude(rim, 0.05, engrave(K.main, sunburst(), 0.4), 0.02));
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.02, 128).rotateX(Math.PI / 2), engrave(K.accent, guilloche(), 0.35)); well.position.z = 0.03; s.add(well);
  s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.02, 16, 160), K.trim), 0, 0, 0.04)); s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.012, 16, 160), K.bright), 0, 0, 0.04));
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; s.add(at(ball(0.011, K.bright), Math.cos(a) * 0.725, Math.sin(a) * 0.725, 0.04)); }
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 128), new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.55, clearcoat: 0.6 })); face.position.z = 0.045; s.add(face);
  s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 16, 128), K.main), 0, 0, 0.05));
  s.add(at(wreath(0.46, K.bright, 14, 0.9), 0, -0.02, 0.05));
  // easel: two splayed legs and a rear prop
  for (const x of [-1, 1]) g.add(tube([[x * 0.34, 0.02, 0.2], [x * 0.3, 0.6, 0.02], [x * 0.26, 1.3, -0.18]], 0.022, K.trim, 40));
  g.add(tube([[0, 0.02, -0.55], [0, 0.7, -0.32], [0, 1.25, -0.2]], 0.02, K.trim, 40)); g.add(tube([[-0.36, 0.28, 0.14], [0.36, 0.28, 0.14]], 0.016, K.trim, 20));
  const c = goblet(K, 0.62); c.position.set(0.5, 0, 0.32); g.add(c); g.add(at(turnedFoot(K, 0.15), 0.5, 0, 0.32)); c.position.y = 0.05;
  if (K.gem) { s.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), K.gem), 0, 0.82, 0.05)); for (const a of [0.5, 2.64]) s.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.04)); }
  if (K.glow) s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.008, 12, 128), K.glow), 0, 0, 0.045));
  return g; } };

/** Majors: the big stage — a stepped stage under a lighting truss, two spotlights trained on the trophy. */
PIECES["career-majors"] = { name: "Big Stage", build(K) {
  const g = new THREE.Group();
  const deck = (w, h, d, y, mat) => g.add(at(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.02), mat), 0, y, 0));
  deck(1.5, 0.12, 0.95, 0.06, K.enamel); deck(1.54, 0.025, 0.99, 0.13, K.trim); deck(1.0, 0.08, 0.62, 0.18, K.main); deck(1.03, 0.02, 0.65, 0.23, K.bright);
  for (let i = 0; i < 3; i++) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.04, 0.12, 2, 0.01), K.accent), 0, 0.02 + i * 0.045, 0.53 + (2 - i) * 0.07));
  // truss: two towers and a top beam, each a box of rails with zig-zag bracing
  const rails = (a, b, w) => { const ax = new THREE.Vector3(...a), bx = new THREE.Vector3(...b); const offs = [[-w, -w], [w, -w], [w, w], [-w, w]];
    const dir = bx.clone().sub(ax).normalize(), side = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(0, 0, 1);
    const corner = (o) => side.clone().multiplyScalar(o[0]).add(up.clone().multiplyScalar(o[1]));
    for (const o of offs) g.add(tube([ax.clone().add(corner(o)).toArray(), bx.clone().add(corner(o)).toArray()], 0.012, K.main, 8));
    const n = 9; for (let i = 0; i < n; i++) for (const [p, q] of [[offs[0], offs[1]], [offs[3], offs[2]], [offs[0], offs[3]]]) {
      const t0 = i / n, t1 = (i + 1) / n, A = ax.clone().lerp(bx, t0).add(corner(i % 2 ? p : q)), B = ax.clone().lerp(bx, t1).add(corner(i % 2 ? q : p)); g.add(tube([A.toArray(), B.toArray()], 0.006, K.accent, 4)); } };
  rails([-0.68, 0.12, -0.3], [-0.68, 1.62, -0.3], 0.05); rails([0.68, 0.12, -0.3], [0.68, 1.62, -0.3], 0.05); rails([-0.68, 1.62, -0.3], [0.68, 1.62, -0.3], 0.05);
  for (const x of [-0.68, 0.68]) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.03, 0.16, 2, 0.01), K.trim), x, 0.13, -0.3));
  // spotlights on yokes, lenses lit, trained down on the stage centre
  for (const s of [-1, 1]) { const L = new THREE.Group(); L.position.set(s * 0.38, 1.55, -0.24); g.add(L);
    L.add(tube([[-0.08, 0.06, 0], [-0.08, -0.06, 0], [0.08, -0.06, 0], [0.08, 0.06, 0]], 0.01, K.trim, 20));
    const can = new THREE.Group(); can.position.y = -0.08; can.rotation.x = 0.85; can.rotation.z = s * 0.45; L.add(can);
    can.add(smooth([[0, 0.12], [0.055, 0.11], [0.065, 0.0], [0.08, -0.1], [0.075, -0.12]], new THREE.MeshPhysicalMaterial({ color: 0x15171b, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }), 48, 30));
    can.add(ring(0.078, 0.008, K.trim, -0.11));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48), K.glow ?? new THREE.MeshStandardMaterial({ color: 0x302810, emissive: 0xfff1c8, emissiveIntensity: 2.5 })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.115; can.add(lens); }
  // the trophy on its riser, with a gem or a star on the lid
  const c = goblet(K, 0.85); c.position.y = 0.24; g.add(c); g.add(at(ball(0.04, K.gem ?? K.bright), 0, 0.24 + 0.85 * 0.84, 0));
  const star = extrude(starShape(0.08, 0.035), 0.02, K.bright, 0.006); star.position.set(0, 0.13, 0.5); g.add(star);
  if (K.gem) for (let i = 0; i < 7; i++) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), K.gem), -0.6 + i * 0.2, 0.135, 0.48));
  return g; } };

/** 180s in Career: a raised "180" inside a laurel wreath, three darts fanned behind it. */
PIECES["career-180s"] = { name: "Maximum Man", build(K, font) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.4));
  g.add(fluted([[0.08, 0.14], [0.12, 0.2], [0.07, 0.3], [0.07, 0.42], [0.14, 0.48], [0, 0.5]], 14, 0.12, K.main, { seg: 96 })); g.add(ring(0.12, 0.012, K.trim, 0.2));
  const f = new THREE.Group(); f.position.y = 1.18; g.add(f);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 128).rotateX(Math.PI / 2), engrave(K.enamel, sunburst(), 0.3)); f.add(disc);
  f.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 16, 160), K.main)); f.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.01, 12, 160), K.bright), 0, 0, 0.03));
  f.add(at(wreath(0.66, K.accent, 18, 0.7), 0, 0, 0.04));
  for (const [a, z] of [[-0.62, -0.06], [0, -0.07], [0.62, -0.06]]) { const d = dart(K, K.enamel); d.scale.setScalar(0.95); const h = new THREE.Group(); h.rotation.z = a; h.add(d); h.position.z = z; f.add(h); }
  if (font) { const t = textMesh(font, "180", 0.36, 0.09, K.main); t.position.z = 0.07; f.add(t);
    const back = textMesh(font, "180", 0.36, 0.02, K.ink); back.position.set(0.012, -0.012, 0.03); f.add(back); }
  f.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.02), K.bright), 0, -0.3, 0.05));
  g.add(tube([[0, 0.5, 0], [0, 0.62, 0]], 0.05, K.main, 8));
  if (K.gem) for (let i = 0; i < 3; i++) f.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), K.gem), -0.12 + i * 0.12, 0.34, 0.05));
  if (K.glow) f.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.008, 12, 160), K.glow), 0, 0, 0.035));
  return g; } };

/** World ranking: a stepped summit climbed by a ribbon path, a pennant and a laurelled "1" at the top. */
PIECES["career-ranking"] = { name: "Climber", build(K, font) {
  const g = new THREE.Group(), steps = 5;
  for (let i = 0; i < steps; i++) { const w = 1.3 - i * 0.22, h = 0.2, y = i * h;
    g.add(at(new THREE.Mesh(new RoundedBoxGeometry(w, h, w * 0.7, 3, 0.02), i % 2 ? K.enamel : K.main), 0, y + h / 2, 0));
    g.add(at(new THREE.Mesh(new RoundedBoxGeometry(w + 0.03, 0.022, w * 0.7 + 0.03, 2, 0.008), K.trim), 0, y + h, 0));
    for (let k = 0; k < 2 + (steps - i); k++) { const x = -w / 2 + (k + 0.5) * w / (2 + steps - i); g.add(at(ball(0.012, K.bright), x, y + h * 0.5, w * 0.35 + 0.012)); }
    if (font && i < steps - 1) { const t = textMesh(font, String([64, 32, 16, 8][i]), 0.07, 0.012, i % 2 ? K.bright : K.ink); t.position.set(w / 2 - 0.13, y + h * 0.5, w * 0.35 + 0.01); g.add(t); } }
  // top: a "1" on a drum in a wreath, a pennant beside it
  const top = steps * 0.2; g.add(at(cyl(0.16, 0.18, 0.08, K.main), 0, top + 0.04, 0)); g.add(ring(0.17, 0.012, K.trim, top + 0.08));
  if (font) { const one = textMesh(font, "1", 0.42, 0.09, K.main); one.position.set(0, top + 0.33, 0); g.add(one); }
  g.add(at(wreath(0.27, K.accent, 12, 0.9), 0, top + 0.33, -0.04));
  g.add(at(cyl(0.012, 0.012, 0.7, K.trim, 12), 0.3, top + 0.35, -0.05)); g.add(at(ball(0.025, K.bright), 0.3, top + 0.71, -0.05));
  const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.lineTo(0.32, -0.08); pen.lineTo(0, -0.18); const p = extrude(pen, 0.01, K.enamel, 0.004); p.position.set(0.31, top + 0.68, -0.05); g.add(p);
  const path = []; for (let i = 0; i <= 60; i++) { const t = i / 60; path.push([-0.55 + t * 0.4, t * top + 0.05, 0.46 - t * 0.3]); } g.add(tube(path, 0.01, K.bright, 120));
  if (K.gem) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), K.gem), 0, top + 0.62, 0.02));
  if (K.glow) g.add(ring(0.2, 0.008, K.glow, top + 0.085));
  return g; } };

/** Seasons on one save: the well-travelled dart case — strapped, cornered, tagged and stickered. */
PIECES["career-seasons"] = { name: "Long Haul", ry: -0.42, build(K, font) {
  const g = new THREE.Group();
  const leather = new THREE.MeshPhysicalMaterial({ color: K.tier === "BRONZE" ? 0x4a2410 : K.tier === "SILVER" ? 0x151a22 : K.tier === "GOLD" ? 0x3a0c10 : K.tier === "PLATINUM" ? 0x0c1a3a : 0x0a2236,
    roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.3, bumpMap: hammered(21), bumpScale: 0.15 });
  const W = 1.2, H = 0.85, D = 0.32, y0 = 0.05;
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 6, 0.06), leather), 0, y0 + H / 2, 0));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(W + 0.01, 0.03, D + 0.01, 3, 0.012), K.main), 0, y0 + H * 0.62, 0));
  // corner caps and studs
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) { const c = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.08, 3, 0.03), K.main);
    c.position.set(sx * (W / 2 - 0.06), y0 + (sy ? H - 0.06 : 0.06), sz * (D / 2 - 0.02)); g.add(c); g.add(at(ball(0.014, K.bright), sx * (W / 2 - 0.07), y0 + (sy ? H - 0.07 : 0.07), sz * (D / 2 + 0.02))); }
  // straps with buckles
  for (const x of [-0.3, 0.3]) { g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.09, H + 0.02, D + 0.02, 2, 0.01), K.accent), x, y0 + H / 2, 0));
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 4), K.bright); b.rotation.z = Math.PI / 4; b.position.set(x, y0 + H * 0.4, D / 2 + 0.02); g.add(b); }
  // handle and latches
  g.add(tube([[-0.18, y0 + H, 0], [-0.17, y0 + H + 0.13, 0], [0, y0 + H + 0.17, 0], [0.17, y0 + H + 0.13, 0], [0.18, y0 + H, 0]], 0.03, leather, 40));
  for (const x of [-0.18, 0.18]) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.04, 0.07, 2, 0.01), K.main), x, y0 + H + 0.01, 0));
  for (const x of [-0.12, 0.12]) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.06, 0.02, 2, 0.008), K.bright), x, y0 + H * 0.62, D / 2 + 0.01));
  // travel stickers: a board, a star and a season count
  const sticker = (draw, x, y, r, rot) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshPhysicalMaterial({ map: canvasTex(256, 256, draw), roughness: 0.5, clearcoat: 0.6 }));
    m.position.set(x, y, D / 2 + 0.002); m.rotation.z = rot; g.add(m); };
  sticker((c, w) => { c.fillStyle = "#f3e7c9"; c.fillRect(0, 0, w, w); c.fillStyle = "#8a1020"; c.beginPath(); c.arc(w / 2, w / 2, w * 0.38, 0, 7); c.fill(); c.fillStyle = "#f3e7c9"; c.beginPath(); c.arc(w / 2, w / 2, w * 0.26, 0, 7); c.fill(); c.fillStyle = "#0e4a2a"; c.beginPath(); c.arc(w / 2, w / 2, w * 0.12, 0, 7); c.fill(); }, -0.08, y0 + 0.28, 0.12, 0.2);
  sticker((c, w) => { c.fillStyle = "#123a7a"; c.fillRect(0, 0, w, w); c.fillStyle = "#ffd24a"; c.font = `bold ${w * 0.3}px Arial`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("TOUR", w / 2, w * 0.52); }, 0.1, y0 + 0.44, 0.1, -0.3);
  sticker((c, w) => { c.fillStyle = "#ffd24a"; c.fillRect(0, 0, w, w); c.fillStyle = "#3a0c10"; c.font = `bold ${w * 0.42}px Arial`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("★", w / 2, w * 0.55); }, 0.47, y0 + 0.2, 0.08, 0.1);
  // a luggage tag hanging from the handle
  const tag = new THREE.Group(); tag.position.set(0.17, y0 + H + 0.05, D / 2 + 0.03); tag.rotation.z = 0.35; g.add(tag);
  tag.add(tube([[0, 0.05, 0], [0.01, -0.06, 0.01], [0.02, -0.14, 0]], 0.005, K.trim, 20));
  const ts = new THREE.Shape(); ts.moveTo(-0.07, 0); ts.lineTo(0.07, 0); ts.lineTo(0.07, -0.2); ts.lineTo(-0.07, -0.2); ts.lineTo(-0.07, 0); const tg = extrude(ts, 0.01, K.plate, 0.004); tg.position.y = -0.13; tag.add(tg);
  if (font) { const t = textMesh(font, "TKDL", 0.035, 0.004, K.ink); t.position.set(0, -0.23, 0.012); tag.add(t); }
  if (K.gem) for (const x of [-0.12, 0.12]) g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), K.gem), x, y0 + H * 0.62 + 0.05, D / 2 + 0.02));
  if (K.glow) g.add(at(new THREE.Mesh(new RoundedBoxGeometry(W + 0.02, 0.008, D + 0.02, 2, 0.004), K.glow), 0, y0 + 0.02, 0));
  return g; } };

/** Showpiece: the World Championship trophy — a great two-handled cup on a column of darts, crowned by a gilded globe. */
PIECES["world-champion"] = { name: "World Champion", fit: 0.86, build(K) {
  const g = new THREE.Group(); g.add(turnedFoot(K, 0.55));
  g.add(smooth([[0, 0.14], [0.36, 0.14], [0.34, 0.2], [0.2, 0.26], [0.14, 0.3], [0, 0.31]], K.main)); g.add(ring(0.36, 0.016, K.trim, 0.15)); beads(g, 0.3, 0.012, 0.21, 48, K.bright);
  // column: a core wrapped in four upright darts
  g.add(at(cyl(0.07, 0.07, 0.6, K.enamel, 32), 0, 0.6, 0)); g.add(ring(0.12, 0.016, K.trim, 0.31)); g.add(ring(0.12, 0.016, K.trim, 0.9));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const d = dart(K, K.enamel); d.scale.setScalar(0.62); d.position.set(Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1); g.add(d); }
  // the bowl: gadrooned below, engraved bands, a laurel girdle
  const bowl = [[0.1, 0.92], [0.28, 0.98], [0.5, 1.12], [0.62, 1.32], [0.64, 1.56], [0.62, 1.7], [0.66, 1.76]];
  g.add(fluted(bowl, 30, 0.07, K.main, { t0: 0.0, t1: 0.45 })); g.add(smooth([[0.62, 1.76], [0.58, 1.6], [0.5, 1.2], [0, 1.08]], K.main));
  g.add(ring(0.665, 0.02, K.trim, 1.75)); g.add(band(0.638, 1.48, 0.64, 1.62, K.main, 12, 2.0)); g.add(ring(0.62, 0.012, K.trim, 1.32)); beads(g, 0.645, 0.012, 1.66, 80, K.bright);
  const geo = leafGeo(0.09, 0.036); g.add(ring(0.633, 0.006, K.accent, 1.42));
  for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, side = i % 2 ? 1 : -1; const l = new THREE.Mesh(geo, K.accent), h = new THREE.Group(); l.rotation.z = side * 0.6; h.add(l);
    h.position.set(Math.cos(a) * 0.635, 1.42, Math.sin(a) * 0.635); h.rotation.y = -a + Math.PI / 2; g.add(h); }
  // great ear handles with acanthus beads
  for (const s of [-1, 1]) { const pts = [[s * 0.62, 1.64, 0], [s * 0.92, 1.74, 0], [s * 1.04, 1.5, 0], [s * 0.94, 1.2, 0], [s * 0.6, 1.08, 0]]; g.add(tube(pts, 0.038, K.main));
    const hc = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); for (let i = 1; i < 16; i++) { const p = hc.getPoint(i / 16); g.add(at(ball(0.018, K.bright), p.x + s * 0.035, p.y, p.z)); }
    g.add(at(ball(0.05, K.trim), s * 0.6, 1.08, 0)); }
  // lid, knop and the globe finial in a gimbal ring
  g.add(fluted([[0, 1.76], [0.65, 1.76], [0.64, 1.8], [0.46, 1.9], [0.22, 1.98], [0, 2.0]], 28, 0.05, K.main, { t0: 0.3, t1: 0.95 })); beads(g, 0.6, 0.013, 1.8, 64, K.bright);
  g.add(smooth([[0, 1.99], [0.07, 2.01], [0.04, 2.08], [0.09, 2.12], [0, 2.14]], K.trim));
  const gl = new THREE.Group(); gl.position.y = 2.36; g.add(gl); gl.rotation.z = 0.4;
  gl.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 64, 48), new THREE.MeshPhysicalMaterial({ map: continents(), roughness: 0.25, clearcoat: 1, metalness: 0.15 })));
  gl.add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 12, 128), K.main)); const eq = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.01, 12, 128), K.bright); eq.rotation.x = Math.PI / 2; gl.add(eq);
  g.add(at(cyl(0.02, 0.03, 0.12, K.trim, 16), 0, 2.16, 0)); g.add(at(ball(0.035, K.gem ?? K.bright), 0, 2.62, 0));
  if (K.gem) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), K.gem), Math.cos(a) * 0.645, 1.55, Math.sin(a) * 0.645)); } }
  if (K.glow) { g.add(ring(0.62, 0.012, K.glow, 1.32)); g.add(ring(0.36, 0.01, K.glow, 0.17)); }
  return g; } };

Object.assign(ICONS, {
  ticket: (c, w) => { c.save(); c.translate(.5 * w, .5 * w); c.rotate(-0.25); c.fillRect(-.34 * w, -.2 * w, .68 * w, .4 * w); c.fillStyle = "#000"; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * .34 * w, 0, .07 * w, 0, 7); c.fill(); }
    c.fillRect(-.02 * w, -.16 * w, .04 * w, .32 * w); c.font = `bold ${.13 * w}px Arial`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PRO", -.15 * w, .01 * w); c.restore(); },
  loop: (c, w) => { c.lineWidth = .08 * w; c.strokeStyle = "#fff"; c.beginPath(); c.arc(.5 * w, .52 * w, .26 * w, -0.4, Math.PI * 1.55); c.stroke(); poly(c, w, [[.76, .24], [.8, .48], [.56, .4]]); },
  trophy: (c, w) => { c.beginPath(); c.moveTo(.28 * w, .18 * w); c.lineTo(.72 * w, .18 * w); c.quadraticCurveTo(.72 * w, .56 * w, .5 * w, .6 * w); c.quadraticCurveTo(.28 * w, .56 * w, .28 * w, .18 * w); c.fill();
    c.lineWidth = .045 * w; c.strokeStyle = "#fff"; for (const s of [-1, 1]) { c.beginPath(); c.arc((.5 + s * .24) * w, .3 * w, .09 * w, 0, 7); c.stroke(); } c.fillRect(.46 * w, .58 * w, .08 * w, .14 * w); c.fillRect(.33 * w, .72 * w, .34 * w, .08 * w); },
  rings: (c, w) => { c.lineWidth = .06 * w; c.strokeStyle = "#fff"; for (const x of [.4, .6]) { c.beginPath(); c.arc(x * w, .56 * w, .17 * w, 0, 7); c.stroke(); } poly(c, w, [[.34, .3], [.4, .2], [.46, .3], [.4, .36]]); },
  ton: txt("100+", .26),
  fish: (c, w) => { c.beginPath(); c.ellipse(.46 * w, .5 * w, .26 * w, .15 * w, 0, 0, 7); c.fill(); poly(c, w, [[.68, .5], [.88, .32], [.88, .68]]); c.fillStyle = "#000"; c.beginPath(); c.arc(.32 * w, .46 * w, .03 * w, 0, 7); c.fill(); },
  ten: txt("10", .4),
  torch: (c, w) => { poly(c, w, [[.42, .5], [.58, .5], [.54, .88], [.46, .88]]); c.beginPath(); c.moveTo(.5 * w, .12 * w); c.bezierCurveTo(.72 * w, .3 * w, .66 * w, .48 * w, .5 * w, .48 * w); c.bezierCurveTo(.34 * w, .48 * w, .3 * w, .3 * w, .5 * w, .12 * w); c.fill(); },
  nine: txt("9", .5),
  pillar: (c, w) => { c.fillRect(.24 * w, .2 * w, .52 * w, .07 * w); c.fillRect(.22 * w, .74 * w, .56 * w, .07 * w); for (let i = 0; i < 4; i++) c.fillRect((.29 + i * .12) * w, .3 * w, .06 * w, .42 * w); poly(c, w, [[.2, .2], [.5, .08], [.8, .2]]); },
  watch: (c, w) => { c.beginPath(); c.arc(.5 * w, .56 * w, .26 * w, 0, 7); c.fill(); c.fillRect(.45 * w, .16 * w, .1 * w, .1 * w); c.lineWidth = .03 * w; c.strokeStyle = "#fff"; c.beginPath(); c.arc(.5 * w, .14 * w, .05 * w, 0, 7); c.stroke();
    c.fillStyle = "#000"; c.beginPath(); c.arc(.5 * w, .56 * w, .2 * w, 0, 7); c.fill(); c.fillStyle = "#fff"; c.fillRect(.48 * w, .4 * w, .04 * w, .18 * w); c.fillRect(.48 * w, .54 * w, .14 * w, .04 * w); },
});
