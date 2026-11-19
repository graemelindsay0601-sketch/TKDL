/**
 * Workstream E2 (second pass) — physically based trophy models for offline rendering.
 * Every trophy is real 3D geometry rendered with three.js MeshPhysicalMaterial
 * (metalness/roughness, clearcoat, anisotropic brushing, glass transmission)
 * under one studio environment (softboxes + strip lights), one camera and one
 * ebony plinth with a brass engraving plate. Deterministic: seeded procedural
 * textures only, no randomness at render time, no external assets.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// ---------------------------------------------------------------- deterministic noise
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- studio
/** Product-photography environment: dark cyclorama, big overhead softbox, warm/cool strips, low fill, back kickers. */
export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  // graded cyclorama: lighter overhead, darker floor, so mirror metals always have tone to reflect
  const cyc = new THREE.SphereGeometry(20, 64, 32), col = [];
  for (let i = 0; i < cyc.attributes.position.count; i++) { const y = cyc.attributes.position.getY(i) / 20; const v = 0.06 + Math.max(0, y) * 0.32 + (y < -0.1 ? 0.05 : 0); col.push(v, v * 1.02, v * 1.08); }
  cyc.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(cyc, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(14, 7, 0xffffff, 2.6, [0, 10, 1], [0, 0, 0]);          // large overhead softbox
  panel(5, 12, 0xfff3e2, 2.8, [-8, 3, 4], [0, 1.5, 0]);        // big warm key softbox, left front
  panel(1.6, 12, 0xe2eeff, 4.2, [8, 3, 2], [0, 1.5, 0]);       // cool strip, right
  panel(1.2, 12, 0xffffff, 3.2, [5, 3, -7], [0, 1.5, 0]);      // back-right kicker
  panel(1.2, 12, 0xffffff, 3.2, [-5, 3, -7], [0, 1.5, 0]);     // back-left kicker
  panel(12, 4, 0xfff6e8, 2.2, [0, 1, 11], [0, 1, 0]);          // front fill behind the camera (lights the brass plate)
  panel(16, 16, 0x9aa3ad, 0.55, [0, -4, 0], [0, 0, 0]);        // floor bounce
  panel(3, 3, 0xffd9a0, 2.0, [6, 7, 6], [0, 1, 0]);            // warm accent for gold
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.015).texture; pm.dispose();
  return tex;
}

// ---------------------------------------------------------------- procedural textures
function canvasTexture(size, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function woodTexture(seed = 7, base = "#5a3218", light = "#9a6136", dark = "#2c160a") {
  const r = rng(seed);
  return canvasTexture(1024, (g, s) => {
    const grd = g.createLinearGradient(0, 0, s, 0); grd.addColorStop(0, dark); grd.addColorStop(.3, base); grd.addColorStop(.55, light); grd.addColorStop(.8, base); grd.addColorStop(1, dark);
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {             // grain lines with gentle waves and knots
      const x0 = r() * s, amp = 4 + r() * 18, freq = 0.004 + r() * 0.01, ph = r() * 6.28;
      g.strokeStyle = r() > .5 ? `rgba(30,14,5,${.12 + r() * .25})` : `rgba(200,140,90,${.05 + r() * .12})`; g.lineWidth = .6 + r() * 2.2;
      g.beginPath(); for (let y = 0; y <= s; y += 8) { const x = x0 + Math.sin(y * freq + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    for (let k = 0; k < 3; k++) { const cx = r() * s, cy = r() * s; for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(40,18,6,${.25 - i * .02})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, 6 + i * 5, 14 + i * 9, 0, 0, Math.PI * 2); g.stroke(); } }
  });
}
export function brushedRoughness(seed = 3) {
  const r = rng(seed);
  return canvasTexture(512, (g, s) => { g.fillStyle = "#6a6a6a"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) { const y = r() * s, v = 80 + r() * 90; g.strokeStyle = `rgb(${v},${v},${v})`; g.globalAlpha = .35; g.lineWidth = r() * 1.4; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (r() - .5) * 3); g.stroke(); } }, false);
}
export function dartboardTexture() {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2, R = s * .48, ring = (r0, r1, a0, a1, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r1, a0, a1); g.arc(c, c, r0, a1, a0, true); g.closePath(); g.fill(); };
    g.fillStyle = "#121212"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 20; i++) { const a0 = (i - .5) / 20 * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI * 2 / 20, odd = i % 2;
      ring(R * .1, R * .58, a0, a1, odd ? "#e9dcbc" : "#1a1715"); ring(R * .58, R * .63, a0, a1, odd ? "#2d7a45" : "#b3322b");
      ring(R * .63, R * .95, a0, a1, odd ? "#e9dcbc" : "#1a1715"); ring(R * .95, R, a0, a1, odd ? "#2d7a45" : "#b3322b"); }
    g.fillStyle = "#2d7a45"; g.beginPath(); g.arc(c, c, R * .1, 0, Math.PI * 2); g.fill(); g.fillStyle = "#b3322b"; g.beginPath(); g.arc(c, c, R * .045, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#c9ced3"; g.lineWidth = 2.2; [R * .1, R * .58, R * .63, R * .95, R].forEach(r => { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); });
    for (let i = 0; i < 20; i++) { const a = (i - .5) / 20 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .1, c + Math.sin(a) * R * .1); g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); g.stroke(); }
  });
}

// ---------------------------------------------------------------- materials
export function materials() {
  const brush = brushedRoughness();
  const M = {
    silver: new THREE.MeshPhysicalMaterial({ color: 0xe6e9ed, metalness: 1, roughness: 0.06, clearcoat: 0.4, clearcoatRoughness: 0.04 }),
    silverBrushed: new THREE.MeshPhysicalMaterial({ color: 0xd5d9de, metalness: 1, roughness: 0.32, roughnessMap: brush, anisotropy: 0.8 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xf2c25a, metalness: 1, roughness: 0.1, clearcoat: 0.3 }),
    goldBrushed: new THREE.MeshPhysicalMaterial({ color: 0xe0b04d, metalness: 1, roughness: 0.34, roughnessMap: brush, anisotropy: 0.7 }),
    brass: new THREE.MeshPhysicalMaterial({ color: 0xfbe2a0, metalness: 1, roughness: 0.42, roughnessMap: brush, anisotropy: 0.3, envMapIntensity: 2.8 }),
    copper: new THREE.MeshPhysicalMaterial({ color: 0xd58556, metalness: 1, roughness: 0.18, clearcoat: 0.3 }),
    gunmetal: new THREE.MeshPhysicalMaterial({ color: 0x5b636d, metalness: 1, roughness: 0.28, roughnessMap: brush, anisotropy: 0.5 }),
    gunmetalDark: new THREE.MeshPhysicalMaterial({ color: 0x2c3138, metalness: 0.9, roughness: 0.38 }),
    ebony: new THREE.MeshPhysicalMaterial({ color: 0x08090b, metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03 }),
    enamelNavy: new THREE.MeshPhysicalMaterial({ color: 0x163463, metalness: 0.1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    enamelRed: new THREE.MeshPhysicalMaterial({ color: 0x8e1d22, metalness: 0.1, roughness: 0.2, clearcoat: 1 }),
    cyanLight: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x39d8ff, emissiveIntensity: 2.4, roughness: 0.3 }),
    // Thin optical glass for a transparent background: strong studio reflections and Fresnel edges over a faint
    // cool body tint. (Screen-space transmission needs an opaque backdrop to refract, which an isolated asset lacks.)
    glass: new THREE.MeshPhysicalMaterial({ color: 0xf2faff, metalness: 0, roughness: 0.0, transparent: true, opacity: 0.15, ior: 1.52,
      specularIntensity: 1, specularColor: new THREE.Color(0xffffff), envMapIntensity: 4.2, clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.4,
      iridescenceIOR: 1.3, side: THREE.DoubleSide, depthWrite: false }),
    glassEdge: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transparent: true, opacity: 0.55, envMapIntensity: 4, clearcoat: 1, depthWrite: false }),
    wood: new THREE.MeshPhysicalMaterial({ map: woodTexture(11), roughness: 0.38, clearcoat: 0.85, clearcoatRoughness: 0.08 }),
    woodDark: new THREE.MeshPhysicalMaterial({ map: woodTexture(23, "#3e200d", "#6e4022", "#1c0d05"), roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    dartboard: new THREE.MeshPhysicalMaterial({ map: dartboardTexture(), roughness: 0.75 }),
  };
  return M;
}

// ---------------------------------------------------------------- geometry helpers
const V = (x, y) => new THREE.Vector2(x, y);
export const lathe = (pts, mat, seg = 160) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => V(x, y)), seg), mat); return m; };
/** Smooth lathe from control points via Catmull-Rom spline (no faceting). */
export const smoothLathe = (pts, mat, seg = 160, div = 120) => {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => V(x, y)));
  return new THREE.Mesh(new THREE.LatheGeometry(curve.getPoints(div), seg), mat);
};
export const torus = (R, r, mat, y = 0, seg = 160) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 32, seg), mat); m.rotation.x = Math.PI / 2; m.position.y = y; return m; };
export const tube = (points, r, mat, seg = 200) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), seg, r, 32, false), mat);
export const extrude = (shape, depth, mat, bevel = 0.03, holes = []) => {
  holes.forEach(h => shape.holes.push(h));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 64 });
  g.translate(0, 0, -depth / 2); return new THREE.Mesh(g, mat);
};
const group = (...children) => { const g = new THREE.Group(); children.forEach(c => c && g.add(c)); return g; };
const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };

/** Shared ebony plinth (top surface at y=0) with a brushed-brass engraving plate on the front face. */
export function plinth(M, width = 1.5, depth = 1.0, height = 0.42) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 6, 0.05), M.ebony); base.position.y = -height / 2 - 0.08; g.add(base);
  const cap = new THREE.Mesh(new RoundedBoxGeometry(width * 0.86, 0.1, depth * 0.84, 6, 0.03), M.ebony); cap.position.y = -0.05; g.add(cap);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(width * 1.002, 0.025, depth * 1.002, 2, 0.01), M.silverBrushed); trim.position.y = -0.1; g.add(trim);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.17, 0.02, 3, 0.008), M.brass); plate.position.set(0, -height / 2 - 0.09, depth / 2 + 0.008); plate.name = "plate"; g.add(plate);
  return g;
}

// ---------------------------------------------------------------- designs (Stage A)
export const DESIGNS = {};

/** Twisted, fluted spire: a lathe whose radius is modulated by flutes that rotate with height. */
function flutedSpire(profile, flutes, depth, twist, mat, seg = 192, div = 220) {
  const curve = new THREE.SplineCurve(profile.map(([x, y]) => V(x, y)));
  const geo = new THREE.LatheGeometry(curve.getPoints(div), seg), pos = geo.attributes.position, y0 = profile[0][1], y1 = profile.at(-1)[1];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), r = Math.hypot(x, z); if (r < 1e-5) continue;
    const t = (y - y0) / (y1 - y0), a = Math.atan2(z, x), k = 1 + depth * Math.cos(flutes * (a + twist * t)) * Math.sin(Math.PI * Math.min(1, t * 1.15));
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals(); return new THREE.Mesh(geo, mat);
}
DESIGNS["sovereign"] = (M) => {
  const g = new THREE.Group();
  // stepped drum: brushed silver tiers with polished and gold bands
  g.add(smoothLathe([[0, 0], [0.46, 0], [0.47, 0.03], [0.42, 0.08], [0.4, 0.16], [0.34, 0.2], [0.33, 0.34], [0.27, 0.4], [0, 0.4]], M.silverBrushed));
  g.add(torus(0.415, 0.02, M.silver, 0.08)); g.add(torus(0.335, 0.022, M.gold, 0.2)); g.add(torus(0.28, 0.018, M.silver, 0.39));
  // the spire: twisted fluted silver rising to a fine point — sculptural, not a crown
  g.add(flutedSpire([[0.0, 0.4], [0.2, 0.42], [0.25, 0.75], [0.27, 1.15], [0.24, 1.6], [0.17, 2.1], [0.09, 2.55], [0.025, 2.86], [0.0, 2.92]], 6, 0.22, 2.4, M.silver));
  // gold collars where the spire swells and narrows
  g.add(torus(0.335, 0.026, M.gold, 1.0)); g.add(torus(0.215, 0.02, M.gold, 2.02));
  // two sweeping silver wings embracing the lower spire
  for (const s of [-1, 1]) g.add(tube([[s * 0.24, 0.42, 0.02], [s * 0.42, 0.8, 0.05], [s * 0.4, 1.3, 0.04], [s * 0.2, 1.75, 0.0]], 0.035, M.silver));
  g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), M.gold), 0, 2.95, 0));
  g.userData.height = 3.0; return g;
};

DESIGNS["double-crown"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.62, 0], [0.64, 0.05], [0.56, 0.16], [0.5, 0.26], [0, 0.26]], M.enamelNavy));
  g.add(torus(0.6, 0.022, M.gold, 0.05)); g.add(torus(0.5, 0.018, M.gold, 0.26));
  g.add(smoothLathe([[0, 0.26], [0.52, 0.26], [0.52, 0.3], [0, 0.3]], M.silverBrushed));
  const arch = (x, z) => tube([[x - 0.3, 0.3, z], [x - 0.33, 1.1, z], [x - 0.22, 1.85, z], [x, 2.1, z], [x + 0.22, 1.85, z], [x + 0.33, 1.1, z], [x + 0.3, 0.3, z]], 0.075, M.silver);
  g.add(arch(-0.2, 0.08)); g.add(arch(0.2, -0.08));
  // gold band binding the two arches, and gold finials at each crown
  g.add(tube([[-0.5, 1.25, 0.1], [0, 1.18, 0.16], [0.5, 1.25, -0.1]], 0.03, M.gold));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.085, 48, 32), M.gold), -0.2, 2.18, 0.08));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.085, 48, 32), M.gold), 0.2, 2.18, -0.08));
  g.userData.height = 2.3; return g;
};

function shieldShape(w = 0.8, h = 1.1) {
  const s = new THREE.Shape();
  s.moveTo(0, h / 2 + 0.06); s.quadraticCurveTo(w * 0.5, h / 2 + 0.02, w / 2, h / 2 - 0.04);
  s.lineTo(w / 2 - 0.02, -h * 0.05); s.bezierCurveTo(w / 2 - 0.05, -h * 0.32, w * 0.2, -h * 0.46, 0, -h / 2 - 0.04);
  s.bezierCurveTo(-w * 0.2, -h * 0.46, -w / 2 + 0.05, -h * 0.32, -w / 2 + 0.02, -h * 0.05);
  s.lineTo(-w / 2, h / 2 - 0.04); s.quadraticCurveTo(-w * 0.5, h / 2 + 0.02, 0, h / 2 + 0.06);
  return s;
}
DESIGNS["wood-silver-shield"] = (M) => {
  const g = new THREE.Group(), face = new THREE.Group();
  face.add(extrude(shieldShape(1.3, 1.75), 0.09, M.wood, 0.03));
  const rimOuter = shieldShape(1.26, 1.71), rimHole = shieldShape(1.12, 1.56);
  const rim = extrude(rimOuter, 0.03, M.silver, 0.012, [new THREE.Path(rimHole.getPoints(80))]); rim.position.z = 0.07; face.add(rim);
  const crest = extrude(shieldShape(0.62, 0.8), 0.04, M.silver, 0.02); crest.position.set(0, 0.16, 0.08); face.add(crest);
  [0.2, 0.14, 0.08].forEach((r, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 16, 96), i === 2 ? M.gold : M.silverBrushed); t.position.set(0, 0.18, 0.125); face.add(t); });
  face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 24, 16), M.enamelRed), 0, 0.18, 0.13));
  // engraved winner plates and studs
  for (let i = 0; i < 2; i++) face.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.015, 2, 0.005), M.silverBrushed), i ? 0.2 : -0.2, -0.42, 0.075));
  face.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.015, 2, 0.005), M.silverBrushed), 0, -0.53, 0.075));
  [[-0.5, 0.72], [0.5, 0.72], [0, -0.8], [-0.52, 0.0], [0.52, 0.0]].forEach(([x, y]) => face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), M.silver), x, y, 0.09)));
  face.position.y = 1.02; face.rotation.x = -0.08; g.add(face);
  // slot block that holds the shield upright
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.14, 0.32, 4, 0.04), M.woodDark), 0, 0.07, -0.02));
  g.userData.height = 1.95; g.rotation.y = -0.28; return g;
};

DESIGNS["cut-glass"] = (M) => {
  const g = new THREE.Group();
  // foot and stem: heavy optical glass
  g.add(smoothLathe([[0, 0], [0.42, 0], [0.44, 0.03], [0.3, 0.1], [0.12, 0.16], [0, 0.16]], M.glass, 64));
  g.add(smoothLathe([[0, 0.14], [0.12, 0.16], [0.08, 0.3], [0.1, 0.45], [0.07, 0.6], [0.14, 0.7], [0, 0.7]], M.glass, 64));
  // faceted bowl: low radial segment count gives the cut facets, flat-shaded
  const bowlGeo = new THREE.LatheGeometry([V(0, 0.68), V(0.16, 0.7), V(0.42, 0.92), V(0.58, 1.3), V(0.64, 1.72), V(0.66, 1.88), V(0.6, 1.88), V(0.58, 1.72), V(0.52, 1.3), V(0.37, 0.95), V(0.12, 0.76), V(0, 0.76)], 18);
  const bowlMat = M.glass.clone(); bowlMat.flatShading = true;
  g.add(new THREE.Mesh(bowlGeo, bowlMat));
  // diamond cuts: a ring of faceted prisms set into the bowl wall
  for (let row = 0; row < 3; row++) for (let i = 0; i < 18; i++) {
    const a = (i + (row % 2) * 0.5) / 18 * Math.PI * 2, y = 1.05 + row * 0.24, rr = 0.47 + row * 0.055;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), bowlMat); d.scale.set(1, 1.6, 0.45);
    d.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr); d.lookAt(0, y, 0); g.add(d);
  }
  // optical thickness: an inner wall and polished rim, plus light catching on every cut facet edge
  const innerGeo = new THREE.LatheGeometry([V(0, 0.8), V(0.1, 0.8), V(0.33, 0.98), V(0.48, 1.32), V(0.54, 1.72), V(0.56, 1.86)], 18);
  g.add(new THREE.Mesh(innerGeo, M.glass));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(bowlGeo, 12), edgeMat));
  g.add(torus(0.63, 0.016, M.glassEdge, 1.885)); g.add(torus(0.43, 0.012, M.glassEdge, 0.02));
  g.add(torus(0.63, 0.009, M.silver, 1.9));
  g.userData.height = 1.95; return g;
};

DESIGNS["vault-geometric"] = (M) => {
  const g = new THREE.Group();
  // stepped hexagonal pedestal
  const hex = (r, h, mat, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6, 1), mat); m.position.y = y; m.rotation.y = Math.PI / 6; return m; };
  g.add(hex(0.5, 0.12, M.gunmetalDark, 0.06)); g.add(hex(0.42, 0.06, M.silverBrushed, 0.15)); g.add(hex(0.18, 0.5, M.gunmetal, 0.43));
  // the vault body: bevelled hexagonal prism with a polished cap
  const body = new THREE.Group();
  const shape = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 2; const p = [Math.cos(a) * 0.62, Math.sin(a) * 0.62]; i ? shape.lineTo(...p) : shape.moveTo(...p); }
  body.add(extrude(shape, 0.34, M.gunmetal, 0.05));
  const inner = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 2; const p = [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; i ? inner.lineTo(...p) : inner.moveTo(...p); }
  const frame = extrude(shape.clone(), 0.04, M.silver, 0.015, [new THREE.Path(inner.getPoints())]); frame.position.z = 0.2; body.add(frame);
  // dial mechanism: ring, bolts, centre wheel with spokes, cyan light channels
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 24, 96), M.silver); ring.position.z = 0.22; body.add(ring);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 20), M.silverBrushed); bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.2); body.add(bolt); }
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 48), M.gunmetalDark); wheel.rotation.x = Math.PI / 2; wheel.position.z = 0.21; body.add(wheel);
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.035, 0.03, 2, 0.01), M.silver); s.rotation.z = i * Math.PI / 4; s.position.z = 0.245; body.add(s); }
  body.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 32).rotateX(Math.PI / 2), M.cyanLight), 0, 0, 0.26));
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.008, 12, 96), M.cyanLight); glow.position.z = 0.24; body.add(glow);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 2; const ch = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.018, 0.02, 2, 0.006), M.cyanLight); ch.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.205); ch.rotation.z = a; body.add(ch); }
  body.position.y = 1.32; g.add(body);
  // faceted crystal-steel crown on top
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 6), M.silver); cap.position.y = 2.06; cap.rotation.y = Math.PI / 6; g.add(cap);
  g.userData.height = 2.22; g.rotation.y = -0.32; return g;
};

DESIGNS["regional-craft"] = (M) => {
  const g = new THREE.Group();
  // hand-turned wooden pedestal with copper bands
  g.add(smoothLathe([[0, 0], [0.34, 0], [0.36, 0.05], [0.26, 0.12], [0.18, 0.3], [0.2, 0.5], [0.14, 0.72], [0.16, 0.86], [0.24, 0.94], [0, 0.94]], M.wood, 128));
  g.add(torus(0.205, 0.02, M.copper, 0.5)); g.add(torus(0.155, 0.016, M.copper, 0.78)); g.add(torus(0.33, 0.018, M.copper, 0.05));
  // inlaid dartboard disc in a copper rim, tilted to face the viewer
  const board = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 96), [M.woodDark, M.dartboard, M.woodDark]); disc.rotation.x = Math.PI / 2; board.add(disc);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 24, 128), M.copper); board.add(rimT);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; board.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), M.brass), Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0.04)); }
  board.position.set(0, 1.5, 0.02); board.rotation.x = -0.12; g.add(board);
  // carved yoke holding the board
  g.add(tube([[-0.22, 0.9, 0], [-0.36, 1.05, 0], [-0.42, 1.2, -0.02]], 0.045, M.woodDark)); g.add(tube([[0.22, 0.9, 0], [0.36, 1.05, 0], [0.42, 1.2, -0.02]], 0.045, M.woodDark));
  g.userData.height = 2.1; return g;
};

// ---------------------------------------------------------------- designs (Stage B)
const ear = (side, y0, y1, out, r, mat) => tube([[side * out[0], y0, 0], [side * out[1], (y0 * 2 + y1) / 3, 0], [side * out[2], (y0 + y1 * 2) / 3, 0], [side * out[3], y1, 0]], r, mat);

DESIGNS["silver-cup"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.32, 0], [0.33, 0.03], [0.2, 0.1], [0.08, 0.2], [0.06, 0.38], [0.1, 0.44], [0.06, 0.5], [0.08, 0.6], [0.3, 0.75], [0.42, 1.0], [0.46, 1.28], [0.44, 1.3], [0.4, 1.02], [0.28, 0.8], [0, 0.72]], M.silver));
  g.add(torus(0.455, 0.014, M.silver, 1.29)); g.add(torus(0.4, 0.01, M.silverBrushed, 1.0)); g.add(torus(0.095, 0.02, M.silver, 0.44));
  for (const s of [-1, 1]) g.add(ear(s, 1.18, 0.82, [0.44, 0.66, 0.64, 0.34], 0.03, M.silver));
  g.userData.height = 1.35; return g;
};

DESIGNS["championship-cup"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.42, 0], [0.43, 0.04], [0.26, 0.12], [0.1, 0.24], [0.08, 0.44], [0.13, 0.5], [0.08, 0.56], [0.12, 0.66], [0.48, 0.82], [0.66, 1.05], [0.7, 1.22], [0.66, 1.26], [0.6, 1.1], [0.4, 0.88], [0, 0.8]], M.silver));
  g.add(torus(0.665, 0.02, M.gold, 1.23)); g.add(torus(0.58, 0.012, M.gold, 1.05)); g.add(torus(0.125, 0.022, M.gold, 0.5));
  // domed lid with a gold finial
  g.add(smoothLathe([[0, 1.24], [0.62, 1.24], [0.6, 1.3], [0.42, 1.42], [0.16, 1.52], [0.06, 1.6], [0, 1.6]], M.silver));
  g.add(smoothLathe([[0, 1.58], [0.06, 1.6], [0.035, 1.7], [0.07, 1.78], [0, 1.9]], M.gold));
  for (const s of [-1, 1]) g.add(ear(s, 1.16, 0.82, [0.66, 0.98, 0.94, 0.42], 0.045, M.silver));
  // laurel garland: alternating gold leaves around the bowl
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), M.gold); l.scale.set(1, 0.45, 0.35);
    l.position.set(Math.cos(a) * 0.6, 1.0 + (i % 2) * 0.03, Math.sin(a) * 0.6); l.rotation.y = -a; l.rotation.z = (i % 2 ? 0.6 : -0.6); g.add(l); }
  g.userData.height = 1.95; return g;
};

DESIGNS["tall-championship"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.3, 0], [0.31, 0.03], [0.18, 0.1], [0.07, 0.22], [0.055, 0.7], [0.1, 0.76], [0.06, 0.82], [0.1, 0.92], [0.26, 1.08], [0.33, 1.4], [0.3, 1.78], [0.22, 1.96], [0.24, 2.0], [0, 2.0]], M.silver));
  g.add(torus(0.315, 0.012, M.gold, 1.45)); g.add(torus(0.232, 0.016, M.gold, 1.98)); g.add(torus(0.09, 0.018, M.gold, 0.76));
  g.add(smoothLathe([[0, 1.99], [0.22, 2.0], [0.16, 2.12], [0.06, 2.2], [0.035, 2.34], [0.06, 2.42], [0, 2.56]], M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 32, 20), M.gold), 0, 2.58, 0));
  for (const s of [-1, 1]) g.add(ear(s, 1.86, 1.2, [0.24, 0.5, 0.48, 0.3], 0.025, M.silver));
  g.userData.height = 2.62; return g;
};

DESIGNS["silver-bowl"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.36, 0], [0.37, 0.04], [0.24, 0.1], [0.12, 0.2], [0.1, 0.34], [0.16, 0.4], [0, 0.4]], M.silverBrushed));
  // wide fluted bowl with a rolled rim
  const bowl = flutedSpire([[0.05, 0.4], [0.3, 0.44], [0.62, 0.56], [0.84, 0.74], [0.92, 0.86], [0.9, 0.88], [0.8, 0.76], [0.56, 0.62], [0.2, 0.52], [0, 0.5]], 16, 0.05, 0, M.silver);
  g.add(bowl); g.add(torus(0.915, 0.022, M.silver, 0.87)); g.add(torus(0.16, 0.016, M.gold, 0.4));
  g.userData.height = 0.95; return g;
};

DESIGNS["championship-plate"] = (M) => {
  const g = new THREE.Group(), plate = new THREE.Group();
  plate.add(smoothLathe([[0, -0.02], [0.78, -0.02], [0.82, 0.02], [0.8, 0.05], [0.66, 0.035], [0.5, 0.02], [0, 0.02]], M.silver, 192));
  plate.add(torus(0.8, 0.018, M.silver, 0.04)); plate.add(torus(0.62, 0.01, M.silverBrushed, 0.036)); plate.add(torus(0.42, 0.008, M.silverBrushed, 0.025));
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; plate.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), M.silver), Math.cos(a) * 0.71, 0.04, Math.sin(a) * 0.71)); }
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 64), M.gold); medal.position.y = 0.035; plate.add(medal);
  plate.add(torus(0.16, 0.012, M.goldBrushed, 0.05));
  plate.rotation.x = Math.PI / 2 - 0.18; plate.position.set(0, 0.98, 0); g.add(plate);
  // easel stand
  g.add(tube([[-0.42, 0.02, 0.18], [-0.3, 0.4, 0.05], [-0.2, 0.62, -0.05]], 0.022, M.silverBrushed)); g.add(tube([[0.42, 0.02, 0.18], [0.3, 0.4, 0.05], [0.2, 0.62, -0.05]], 0.022, M.silverBrushed));
  g.add(tube([[0, 0.02, -0.35], [0, 0.6, -0.18], [0, 0.9, -0.12]], 0.022, M.silverBrushed));
  g.userData.height = 1.85; return g;
};

DESIGNS["traditional-shield"] = (M) => {
  const g = new THREE.Group(), face = new THREE.Group();
  face.add(extrude(shieldShape(1.2, 1.6), 0.06, M.silver, 0.03));
  const field = extrude(shieldShape(0.92, 1.28), 0.03, M.enamelNavy, 0.01); field.position.z = 0.05; face.add(field);
  const bar = (w, h) => new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.04, 3, 0.012), M.gold);
  face.add(at(bar(0.09, 1.2), 0, -0.02, 0.08)); face.add(at(bar(0.86, 0.09), 0, 0.18, 0.08));
  face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), M.gold), 0, 0.18, 0.09)); face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 20), M.silver), 0, 0.18, 0.2));
  [[-0.45, 0.6], [0.45, 0.6], [-0.4, -0.3], [0.4, -0.3]].forEach(([x, y]) => face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), M.gold), x, y, 0.07)));
  face.position.y = 0.98; face.rotation.x = -0.08; g.add(face);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.14, 0.3, 4, 0.04), M.silverBrushed), 0, 0.07, -0.02));
  g.userData.height = 1.85; g.rotation.y = -0.26; return g;
};

DESIGNS["crystal-column"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.3, 0], [0.31, 0.04], [0.26, 0.1], [0.24, 0.16], [0, 0.16]], M.silver));
  const glassFacet = M.glass.clone(); glassFacet.flatShading = true;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.9, 6, 1), glassFacet); col.position.y = 1.11; col.rotation.y = Math.PI / 6; g.add(col);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 6), glassFacet); tip.position.y = 2.27; tip.rotation.y = Math.PI / 6; g.add(tip);
  const edges = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  [col, tip].forEach(m => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 10), edges); e.position.copy(m.position); e.rotation.copy(m.rotation); g.add(e); });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.7, 6), M.glassEdge); core.position.y = 1.08; g.add(core);
  g.add(torus(0.245, 0.02, M.silver, 0.18));
  g.userData.height = 2.5; return g;
};

/** A flat ribbon swept along a 3D curve (thin rectangle cross-section with rounded edge). */
const ribbon = (points, width, thickness, mat) => {
  const s = new THREE.Shape(); s.moveTo(-thickness / 2, -width / 2); s.lineTo(thickness / 2, -width / 2); s.lineTo(thickness / 2, width / 2); s.lineTo(-thickness / 2, width / 2); s.lineTo(-thickness / 2, -width / 2);
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { steps: 220, bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))) }), mat);
};
DESIGNS["metal-sculpture"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.34, 0], [0.35, 0.04], [0.3, 0.1], [0, 0.1]], M.gunmetalDark));
  g.add(ribbon([[0, 0.1, 0], [-0.32, 0.6, 0.1], [-0.12, 1.1, -0.15], [0.26, 1.5, 0.05], [0.1, 2.0, 0.12], [-0.08, 2.3, 0]], 0.2, 0.035, M.silver));
  g.add(ribbon([[0.04, 0.1, 0], [0.34, 0.55, -0.1], [0.18, 1.0, 0.14], [-0.24, 1.4, -0.05], [-0.06, 1.85, -0.12], [0.12, 2.1, 0]], 0.16, 0.035, M.gunmetal));
  g.userData.height = 2.35; g.rotation.y = 0.3; return g;
};

DESIGNS["dart-sculpture"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.4, 0], [0.4, 0.04], [0.32, 0.18], [0.16, 0.3], [0, 0.32]], M.gunmetal));
  // polished chrome sail sweeping up behind the dart
  const sail = new THREE.Shape(); sail.moveTo(-0.08, 0); sail.bezierCurveTo(-0.5, 0.6, -0.3, 1.5, 0.35, 2.2); sail.bezierCurveTo(-0.05, 1.5, -0.08, 0.7, 0.12, 0);
  const sm = extrude(sail, 0.05, M.silver, 0.02); sm.position.set(0, 0.28, -0.12); g.add(sm);
  // the dart: steel point, knurled gold barrel, shaft and flights
  const dart = new THREE.Group();
  dart.add(smoothLathe([[0, 0], [0.012, 0.02], [0.022, 0.28], [0, 0.3]], M.silverBrushed));
  dart.add(flutedSpire([[0.05, 0.28], [0.07, 0.32], [0.075, 0.6], [0.07, 0.88], [0.04, 0.92]], 28, 0.06, 0, M.gold));
  dart.add(smoothLathe([[0, 0.9], [0.03, 0.92], [0.024, 1.25], [0, 1.27]], M.gunmetal));
  const flight = new THREE.Shape(); flight.moveTo(0, 0); flight.lineTo(0.2, 0.14); flight.lineTo(0.2, 0.36); flight.lineTo(0, 0.3);
  for (let i = 0; i < 4; i++) { const f = extrude(flight.clone(), 0.006, M.enamelNavy, 0.003); const h = new THREE.Group(); f.position.set(0.01, 1.08, 0); h.add(f); h.rotation.y = i * Math.PI / 2 + 0.4; dart.add(h); }
  dart.position.set(0.02, 0.3, 0.02); dart.rotation.z = -0.12; dart.scale.setScalar(1.35); g.add(dart);
  g.userData.height = 2.2; return g;
};

function globeTexture() {
  const r = rng(91);
  return canvasTexture(1024, (g, s) => {
    const sea = g.createLinearGradient(0, 0, 0, s); sea.addColorStop(0, "#123a6e"); sea.addColorStop(.5, "#1f5a9e"); sea.addColorStop(1, "#0f3160"); g.fillStyle = sea; g.fillRect(0, 0, s, s);
    const land = (cx, cy, w, h, n) => { g.fillStyle = "#e3b65a"; g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, k = 0.7 + r() * 0.5; const x = cx + Math.cos(a) * w * k, y = cy + Math.sin(a) * h * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); };
    [[180, 330, 110, 150], [240, 620, 70, 140], [520, 300, 90, 80], [560, 520, 80, 150], [760, 330, 190, 110], [840, 640, 70, 50], [130, 120, 60, 30], [520, 900, 260, 40]].forEach(([x, y, w, h]) => land(x, y, w, h, 18));
    g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 2; for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * s / 12, 0); g.lineTo(i * s / 12, s); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * s / 6); g.lineTo(s, i * s / 6); g.stroke(); }
  });
}
DESIGNS["international-globe"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.38, 0], [0.39, 0.04], [0.28, 0.12], [0.12, 0.22], [0.09, 0.5], [0.13, 0.56], [0, 0.56]], M.silver));
  g.add(torus(0.13, 0.016, M.gold, 0.55));
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.62, 128, 96), new THREE.MeshPhysicalMaterial({ map: globeTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.15 }));
  globe.position.y = 1.28; globe.rotation.set(0.2, -0.8, 0.41); g.add(globe);
  // tilted meridian ring with a polished axis cap, held by a curved support
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.028, 32, 192), M.silver); meridian.position.y = 1.28; meridian.rotation.set(0, Math.PI / 2, 0.41); g.add(meridian);
  const equator = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.018, 24, 192), M.gold); equator.position.y = 1.28; equator.rotation.set(Math.PI / 2, 0.41, 0); g.add(equator);
  g.add(tube([[0, 0.56, 0], [0.18, 0.6, 0], [0.24, 0.62, 0]], 0.03, M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 20), M.gold), Math.sin(0.41) * 0.69, 1.28 + Math.cos(0.41) * 0.69, 0));
  g.userData.height = 2.05; return g;
};

DESIGNS["youth-rising-star"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.28, 0], [0.29, 0.04], [0.2, 0.1], [0.1, 0.16], [0, 0.16]], M.silverBrushed));
  g.add(tube([[0, 0.15, 0], [-0.22, 0.55, 0.05], [-0.12, 0.98, 0.05], [0.14, 1.3, 0], [0.18, 1.48, 0]], 0.04, M.silver));
  g.add(tube([[0.02, 0.15, 0], [0.18, 0.45, -0.05], [0.16, 0.8, -0.05], [0.04, 1.05, -0.02]], 0.026, M.gold));
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.17 : 0.4; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const st = extrude(star, 0.1, M.gold, 0.04); st.position.set(0.18, 1.78, 0); st.rotation.set(0.12, 0.55, -0.15); g.add(st);
  g.userData.height = 2.2; return g;
};

DESIGNS["open-masters-heritage"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.34, 0], [0.35, 0.04], [0.22, 0.1], [0.1, 0.2], [0.09, 0.3], [0.2, 0.36], [0.4, 0.55], [0.48, 0.85], [0.44, 1.15], [0.3, 1.38], [0.2, 1.52], [0.22, 1.62], [0, 1.62]], M.silver));
  g.add(torus(0.475, 0.014, M.gold, 0.85)); g.add(torus(0.215, 0.018, M.gold, 1.6)); g.add(torus(0.21, 0.014, M.silver, 0.36));
  // chased laurel band
  for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), M.goldBrushed); l.scale.set(1, 0.45, 0.35); l.position.set(Math.cos(a) * 0.47, 0.72 + (i % 2) * 0.03, Math.sin(a) * 0.47); l.rotation.y = -a; l.rotation.z = (i % 2 ? 0.6 : -0.6); g.add(l); }
  // lid, finial, spout and scrolled handle
  g.add(smoothLathe([[0, 1.6], [0.22, 1.62], [0.16, 1.72], [0.06, 1.8], [0.04, 1.9], [0, 2.0]], M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 20), M.gold), 0, 2.02, 0));
  const spout = smoothLathe([[0, 0], [0.09, 0], [0.05, 0.3], [0.035, 0.42], [0, 0.42]], M.silver); spout.position.set(0.3, 1.35, 0); spout.rotation.z = -0.95; g.add(spout);
  g.add(tube([[-0.3, 1.42, 0], [-0.58, 1.48, 0], [-0.62, 1.1, 0], [-0.46, 0.72, 0], [-0.42, 0.6, 0]], 0.035, M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), M.gold), -0.6, 1.5, 0));
  g.userData.height = 2.06; g.rotation.y = 0.35; return g;
};

// ---------------------------------------------------------------- event-specific designs (policy v2)
const leafRing = (g, M, r, y, n, mat) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat ?? M.goldBrushed);
  l.scale.set(1, 0.45, 0.35); l.position.set(Math.cos(a) * r, y + (i % 2) * 0.025, Math.sin(a) * r); l.rotation.y = -a; l.rotation.z = (i % 2 ? 0.6 : -0.6); g.add(l); } };

/** European Championship — the Continental Crest: navy-enamel urn, silver laurel handles, gold bead crown. */
DESIGNS["ec-continental-crest"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.36, 0], [0.37, 0.04], [0.22, 0.12], [0.1, 0.26], [0.09, 0.42], [0.14, 0.48], [0, 0.48]], M.silver));
  g.add(smoothLathe([[0, 0.46], [0.18, 0.48], [0.4, 0.66], [0.5, 0.98], [0.46, 1.3], [0.32, 1.52], [0.24, 1.6], [0, 1.6]], M.enamelNavy));
  g.add(torus(0.5, 0.02, M.silver, 0.98)); g.add(torus(0.4, 0.016, M.gold, 0.66)); g.add(torus(0.245, 0.022, M.silver, 1.59));
  leafRing(g, M, 0.48, 1.12, 30, M.silver);
  for (const s of [-1, 1]) { g.add(tube([[s * 0.36, 1.45, 0], [s * 0.64, 1.38, 0], [s * 0.62, 0.95, 0], [s * 0.44, 0.7, 0]], 0.03, M.silver));
    for (let i = 0; i < 6; i++) { const t = i / 5, l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), M.silver); l.scale.set(1, 0.4, 0.4);
      l.position.set(s * (0.62 - Math.sin(t * 2.2) * 0.04 + 0.04), 1.38 - t * 0.6, 0.03); l.rotation.z = s * (0.8 - t); g.add(l); } }
  g.add(smoothLathe([[0, 1.6], [0.24, 1.6], [0.16, 1.72], [0.08, 1.8], [0, 1.82]], M.silver));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), M.gold), Math.cos(a) * 0.17, 1.78, Math.sin(a) * 0.17)); }
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 20), M.gold), 0, 1.92, 0));
  g.userData.height = 2.0; return g;
};

/** Women's World Championship — a tall twisted crystal flame on a gold-banded silver drum. */
DESIGNS["wwc-crystal-flame"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.4, 0], [0.41, 0.04], [0.34, 0.12], [0.3, 0.3], [0.24, 0.36], [0, 0.36]], M.silverBrushed));
  g.add(torus(0.3, 0.022, M.gold, 0.3)); g.add(torus(0.36, 0.014, M.silver, 0.12));
  const crystal = M.glass.clone(); crystal.flatShading = true; crystal.opacity = 0.2;
  const flame = flutedSpire([[0.0, 0.36], [0.18, 0.4], [0.27, 0.85], [0.24, 1.4], [0.14, 1.95], [0.05, 2.35], [0.0, 2.45]], 5, 0.3, 3.2, crystal, 40, 60);
  g.add(flame); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(flame.geometry, 18), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));
  const core = flutedSpire([[0.0, 0.4], [0.07, 0.45], [0.1, 1.0], [0.06, 1.8], [0.0, 2.1]], 5, 0.2, 3.2, M.glassEdge, 32, 40); g.add(core);
  g.userData.height = 2.5; return g;
};

/** Youth World Championship — a crystal orb cradled by three gold arms, crowned with a small star. */
DESIGNS["ywc-star-orb"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.32, 0], [0.33, 0.04], [0.2, 0.12], [0.08, 0.24], [0.06, 0.82], [0.1, 0.88], [0, 0.88]], M.silver));
  g.add(torus(0.085, 0.016, M.gold, 0.6));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(tube([[Math.cos(a) * 0.06, 0.86, Math.sin(a) * 0.06], [Math.cos(a) * 0.32, 1.05, Math.sin(a) * 0.32], [Math.cos(a) * 0.36, 1.35, Math.sin(a) * 0.36], [Math.cos(a) * 0.2, 1.62, Math.sin(a) * 0.2]], 0.026, M.gold)); }
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 96, 64), M.glass), 0, 1.3, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 64, 48), M.glassEdge), 0, 1.3, 0));
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.07 : 0.17; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const st = extrude(star, 0.05, M.gold, 0.02); st.position.set(0, 1.84, 0); st.rotation.y = 0.5; g.add(st);
  g.userData.height = 2.05; return g;
};

/** Junior Development Championship — a modest single-piece silver cup with a gold star medallion. */
DESIGNS["junior-star-cup"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.26, 0], [0.27, 0.03], [0.14, 0.1], [0.06, 0.18], [0.05, 0.34], [0.22, 0.46], [0.32, 0.7], [0.34, 0.92], [0.32, 0.94], [0.29, 0.72], [0.2, 0.52], [0, 0.48]], M.silver));
  g.add(torus(0.335, 0.012, M.silver, 0.93)); g.add(torus(0.07, 0.014, M.gold, 0.2));
  for (const s of [-1, 1]) g.add(tube([[s * 0.31, 0.85, 0], [s * 0.5, 0.86, 0], [s * 0.48, 0.6, 0], [s * 0.26, 0.56, 0]], 0.025, M.silver));
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.045 : 0.1; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const st = extrude(star, 0.02, M.gold, 0.008); st.position.set(0, 0.72, 0.31); st.rotation.x = -0.25; g.add(st);
  g.userData.height = 1.0; return g;
};

/** Open Finals — an upright silver compass rose with gold cardinal points, on a curved stand. */
DESIGNS["open-finals-compass"] = (M) => {
  const g = new THREE.Group(), face = new THREE.Group();
  face.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 128).rotateX(Math.PI / 2), M.silverBrushed));
  face.add(new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.035, 32, 160), M.silver)); face.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 16, 128), M.gold));
  const rose = (rr, rIn, n, mat, z, rot = 0) => { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 + Math.PI / 2 + rot, r = i % 2 ? rIn : rr; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const m = extrude(s, 0.03, mat, 0.012); m.position.z = z; return m; };
  face.add(rose(0.42, 0.09, 8, M.silver, 0.05, Math.PI / 8)); face.add(rose(0.56, 0.1, 4, M.gold, 0.08));
  face.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 20), M.silver), 0, 0, 0.12));
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; const t = new THREE.Mesh(new RoundedBoxGeometry(0.012, i % 4 ? 0.04 : 0.07, 0.01, 1, 0.003), M.gold); t.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0.035); t.rotation.z = a - Math.PI / 2; face.add(t); }
  face.position.y = 1.12; face.rotation.y = -0.25; g.add(face);
  g.add(smoothLathe([[0, 0], [0.3, 0], [0.31, 0.04], [0.18, 0.12], [0.08, 0.2], [0, 0.2]], M.silverBrushed));
  g.add(tube([[0, 0.18, 0], [-0.16, 0.36, 0.02], [-0.5, 0.62, 0.04]], 0.03, M.silver)); g.add(tube([[0, 0.18, 0], [0.16, 0.36, -0.02], [0.5, 0.62, -0.04]], 0.03, M.silver));
  g.userData.height = 1.8; return g;
};

/** Amateur World Masters — a lidded silver cup whose finial is a lacquered globe. */
DESIGNS["awm-globe-cup"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.34, 0], [0.35, 0.04], [0.2, 0.12], [0.08, 0.24], [0.07, 0.46], [0.12, 0.52], [0.08, 0.58], [0.3, 0.76], [0.44, 1.02], [0.46, 1.2], [0.42, 1.24], [0, 1.24]], M.silver));
  g.add(torus(0.455, 0.016, M.gold, 1.2)); g.add(torus(0.11, 0.018, M.gold, 0.52)); leafRing(g, M, 0.44, 0.96, 26);
  g.add(smoothLathe([[0, 1.22], [0.42, 1.24], [0.36, 1.32], [0.18, 1.42], [0.08, 1.48], [0, 1.5]], M.silver));
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 64, 48), new THREE.MeshPhysicalMaterial({ map: globeTexture(), roughness: 0.15, clearcoat: 1, metalness: 0.15 }));
  globe.position.y = 1.66; globe.rotation.set(0.3, -0.6, 0.41); g.add(globe);
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.01, 16, 96), M.gold); m.position.y = 1.66; m.rotation.set(0, Math.PI / 2, 0.41); g.add(m);
  for (const s of [-1, 1]) g.add(ear(s, 1.12, 0.8, [0.44, 0.7, 0.66, 0.32], 0.035, M.silver));
  g.userData.height = 1.86; return g;
};

/** Amateur Masters — a hooped, lidded silver tankard with a scrolled handle and gold thumbpiece. */
DESIGNS["amateur-masters-tankard"] = (M) => {
  const g = new THREE.Group();
  g.add(smoothLathe([[0, 0], [0.4, 0], [0.42, 0.04], [0.36, 0.1], [0.34, 0.9], [0.36, 0.96], [0, 0.96]], M.silverBrushed));
  [0.12, 0.5, 0.88].forEach(y => g.add(torus(0.35, 0.025, M.gold, y)));
  g.add(smoothLathe([[0, 0.96], [0.38, 0.97], [0.36, 1.02], [0.22, 1.1], [0.08, 1.16], [0, 1.2]], M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 20), M.gold), 0, 1.22, 0));
  g.add(tube([[-0.32, 0.86, 0], [-0.6, 0.86, 0], [-0.66, 0.5, 0], [-0.5, 0.2, 0], [-0.34, 0.18, 0]], 0.045, M.silver));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), M.gold), -0.36, 1.06, 0));
  const crest = extrude(shieldShape(0.24, 0.3), 0.02, M.gold, 0.01); crest.position.set(0.0, 0.52, 0.34); g.add(crest);
  g.userData.height = 1.3; g.rotation.y = 0.45; return g;
};

/** Regional Champions League — a ring of eight linked silver shields around a gold medallion. */
DESIGNS["league-shield-ring"] = (M) => {
  const g = new THREE.Group(), ring = new THREE.Group();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sh = extrude(shieldShape(0.24, 0.3), 0.03, i % 2 ? M.silver : M.silverBrushed, 0.012);
    sh.position.set(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0); sh.rotation.z = a - Math.PI / 2; ring.add(sh); }
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.02, 24, 160), M.gold));
  ring.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 96).rotateX(Math.PI / 2), M.gold)); ring.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 16, 96), M.silver), 0, 0, 0.03));
  ring.position.y = 1.28; ring.rotation.y = -0.3; g.add(ring);
  g.add(smoothLathe([[0, 0], [0.34, 0], [0.35, 0.04], [0.22, 0.12], [0.1, 0.24], [0.08, 0.6], [0.12, 0.66], [0, 0.66]], M.woodDark));
  g.add(torus(0.1, 0.018, M.silver, 0.6)); g.add(torus(0.33, 0.016, M.silver, 0.05));
  g.userData.height = 2.0; return g;
};

/** Snooker Darts Cup — a low baize-banded cup holding a polished red resin ball. */
DESIGNS["snooker-darts-cup"] = (M) => {
  const g = new THREE.Group();
  const baize = new THREE.MeshPhysicalMaterial({ color: 0x1f6b3a, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0x3fa865), sheenRoughness: 0.5 });
  g.add(smoothLathe([[0, 0], [0.38, 0], [0.39, 0.04], [0.24, 0.12], [0.12, 0.22], [0.1, 0.36], [0.3, 0.48], [0.44, 0.66], [0.42, 0.68], [0.28, 0.54], [0, 0.5]], M.silver));
  g.add(smoothLathe([[0, 0.5], [0.3, 0.52], [0.36, 0.6], [0, 0.6]], baize)); g.add(torus(0.435, 0.016, M.gold, 0.665));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 96, 64), new THREE.MeshPhysicalMaterial({ color: 0xa3141a, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }));
  ball.position.y = 0.84; g.add(ball);
  g.userData.height = 1.1; return g;
};

/** Treble-Out Trophy — three nested triangular frames (silver, gold, silver) standing on a point. */
DESIGNS["treble-triangles"] = (M) => {
  const g = new THREE.Group(), tri = (r, mat, rot) => { const pts = [0, 1, 2, 0].map(i => { const a = i / 3 * Math.PI * 2 - Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r, 0]; });
    const c = new THREE.CurvePath(); for (let i = 0; i < 3; i++) c.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 300, 0.035, 16, true), mat); m.rotation.y = rot; return m; };
  const set = new THREE.Group(); set.add(tri(0.72, M.silver, 0)); set.add(tri(0.52, M.gold, 0.45)); set.add(tri(0.32, M.silver, 0.9));
  set.position.y = 1.1; g.add(set); // standing on its lower point, which meets the base
  g.add(smoothLathe([[0, 0], [0.3, 0], [0.31, 0.04], [0.16, 0.14], [0.05, 0.36], [0, 0.4]], M.gunmetal));
  g.userData.height = 1.85; return g;
};

/** Noughts & Crosses Trophy — a crystal block engraved with a 3×3 grid, inlaid with a silver cross and gold nought. */
DESIGNS["noughts-crosses-block"] = (M) => {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 0.32, 4, 0.04), M.glass); block.position.y = 0.62; block.rotation.y = -0.3; g.add(block);
  block.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.98, 0.3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })));
  for (const p of [-0.16, 0.16]) { block.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.86, 0.012), M.glassEdge), p, 0, 0.17)); block.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.012, 0.012), M.glassEdge), 0, p, 0.17)); }
  const cross = new THREE.Group(); [Math.PI / 4, -Math.PI / 4].forEach(r => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.045, 0.04, 2, 0.015), M.silver); b.rotation.z = r; cross.add(b); });
  cross.position.set(-0.32, 0.32, 0.18); block.add(cross); block.add(at(cross.clone(), 0.32, -0.32, 0.18));
  [[0, 0], [0.32, 0.32], [-0.32, -0.32]].forEach(([x, y]) => block.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 20, 64), M.gold), x, y, 0.18)));
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.1, 0.42, 3, 0.03), M.silverBrushed), 0, 0.06, 0));
  g.userData.height = 1.15; return g;
};

/** National Cricket — a carved wooden scoreboard (15–20 and bull rows) with silver tally marks. */
DESIGNS["cricket-scoreboard"] = (M) => {
  const g = new THREE.Group(), board = new THREE.Group();
  board.add(new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.3, 0.1, 4, 0.04), M.wood));
  board.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.08, 0.14, 3, 0.03), M.woodDark), 0, 0.68, 0));
  for (let r = 0; r < 7; r++) { const y = 0.5 - r * 0.16;
    board.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.1, 0.02, 2, 0.008), M.brass), -0.3, y, 0.06));
    const marks = 3 - (r % 3); for (let k = 0; k < marks; k++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.1, 0.02, 1, 0.006), M.silver); b.position.set(0.04 + k * 0.07, y, 0.06); board.add(b); }
    if (marks === 3) { const sl = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.016, 0.02, 1, 0.005), M.silver); sl.rotation.z = 0.5; sl.position.set(0.11, y, 0.07); board.add(sl); } }
  board.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 48).rotateX(Math.PI / 2), M.enamelRed), 0.3, -0.46, 0.06));
  board.position.y = 0.82; board.rotation.set(-0.06, -0.3, 0); g.add(board);
  g.add(at(new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.14, 0.3, 3, 0.04), M.woodDark), 0, 0.07, -0.02));
  g.userData.height = 1.55; return g;
};
