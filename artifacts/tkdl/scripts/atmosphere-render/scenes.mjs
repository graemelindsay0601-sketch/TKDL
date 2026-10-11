/**
 * Workstream F1 — atmosphere scene library (rendered by render.html; build-time only).
 *
 * Light layers render volumetric light on black for screen blending over the
 * reused venue photographs. Celebration layers render lit PBR confetti with
 * alpha. Plates (palace-stage, neutral) are complete opaque scenes. Every scene
 * is seeded, so a re-render reproduces the same composition.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SCENE_META } from "./scene-meta.mjs";

// ---------------------------------------------------------------- helpers
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (c) => new THREE.Color(c);

const NOISE = /* glsl */`
float h3(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * n3(p); p *= 2.03; a *= .5; } return s; }`;

/** Additive volumetric cone from `from` towards `to`, soft-edged, fading with distance, broken up by haze noise. */
export function beam(from, to, { radius = 0.6, color = "#ffffff", intensity = 1, haze = 0.55, apex = 0.05, falloff = 1.3 } = {}) {
  const dir = to.clone().sub(from), len = dir.length();
  const geo = new THREE.CylinderGeometry(apex, radius, len, 64, 24, true);
  geo.translate(0, -len / 2, 0); // apex at origin, opening downwards along -Y
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uI: { value: intensity }, uHaze: { value: haze }, uFall: { value: falloff }, uSeed: { value: (from.x * 7.31 + from.y * 3.17 + from.z * 13.7 + to.x * 1.9) % 50 } },
    vertexShader: /* glsl */`varying float vT; varying vec3 vN; varying vec3 vW;
      void main(){ vT = 1.0 - uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uI, uHaze, uFall, uSeed; varying float vT; varying vec3 vN; varying vec3 vW; ${NOISE}
      void main(){ vec3 v = normalize(cameraPosition - vW); float facing = abs(dot(normalize(vN), v));
        float edge = pow(facing, 2.2);
        float along = pow(1.0 - vT, uFall) * smoothstep(0.0, 0.04, vT);
        float hz = mix(1.0, 0.35 + 1.3 * fbm(vW * 0.35 + uSeed), uHaze);
        gl_FragColor = vec4(uColor * uI * edge * along * hz, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(V3(0, -1, 0), dir.normalize());
  return m;
}

let haloTex = null;
function halo() {
  if (haloTex) return haloTex;
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.06, "rgba(255,255,255,.95)"); g.addColorStop(0.16, "rgba(255,255,255,.32)");
  g.addColorStop(0.4, "rgba(255,255,255,.08)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); haloTex = new THREE.CanvasTexture(cv); return haloTex;
}
/** Bright fixture lens: hot core plus a soft additive halo (no post bloom, which bands under SwiftShader). */
export function lens(pos, color = "#ffffff", r = 0.12, intensity = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: col(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(r * 14); sp.position.copy(pos); return sp;
}

/** Additive radial pool of light on a floor/back plane. */
export function pool(center, normal, size, color = "#ffffff", intensity = 1, softness = 1.6) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uI: { value: intensity }, uS: { value: softness } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI, uS; varying vec2 vUv;
      void main(){ float d = length(vUv - .5) * 2.0; float a = pow(max(0.0, 1.0 - d), uS); gl_FragColor = vec4(uColor * uI * a, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  m.position.copy(center); m.lookAt(center.clone().add(normal)); return m;
}

/** Floating dust / haze particles catching the light (additive points). */
export function motes(count, box, color, size, seed, intensity = 1) {
  const r = rng(seed), pos = new Float32Array(count * 3), c = new Float32Array(count * 3), base = col(color);
  for (let i = 0; i < count; i++) {
    pos.set([box.min.x + r() * (box.max.x - box.min.x), box.min.y + r() * (box.max.y - box.min.y), box.min.z + r() * (box.max.z - box.min.z)], i * 3);
    const k = intensity * (0.25 + r() * r()); c.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  const tex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  return new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
}

/** Box truss bar between two points (dark aluminium, faintly lit). */
export function truss(a, b, mat, s = 0.32) {
  const g = new THREE.Group(), dir = b.clone().sub(a), len = dir.length();
  const chord = new THREE.CylinderGeometry(0.025, 0.025, len, 8);
  for (const [x, z] of [[-s / 2, -s / 2], [s / 2, -s / 2], [-s / 2, s / 2], [s / 2, s / 2]]) { const m = new THREE.Mesh(chord, mat); m.position.set(x, 0, z); g.add(m); }
  const n = Math.max(2, Math.round(len / s));
  const lace = new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(s, len / n), 6);
  for (let i = 0; i < n; i++) for (const side of [0, 1, 2, 3]) {
    const m = new THREE.Mesh(lace, mat); const y = -len / 2 + (i + 0.5) * len / n;
    const ang = Math.atan2(s, len / n) * (i % 2 ? 1 : -1);
    if (side < 2) { m.position.set(0, y, side ? s / 2 : -s / 2); m.rotation.z = ang; } else { m.position.set(side === 2 ? s / 2 : -s / 2, y, 0); m.rotation.x = ang; }
    g.add(m);
  }
  g.position.copy(a.clone().add(b).multiplyScalar(0.5));
  g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return g;
}

/** Moving-head fixture body: yoke + head, with a lens facing the beam. */
export function movingHead(pos, target, color, mat) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 24), mat);
  const dir = target.clone().sub(pos).normalize();
  head.quaternion.setFromUnitVectors(V3(0, -1, 0), dir); head.position.copy(pos);
  g.add(head); g.add(lens(pos.clone().add(dir.clone().multiplyScalar(0.19)), color, 0.1, 1.1));
  return g;
}

function cam(fov, pos, look) { const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 400); c.position.copy(pos); c.lookAt(look); return c; }
const dark = () => new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.7, roughness: 0.45 });

// ---------------------------------------------------------------- light layers (screen blend over venue plates)
export const SCENES = {};
const layer = (id, build, extra = {}) => { SCENES[id] = { ...SCENE_META[id].render, ...extra, build }; };

// Televised stage: two truss lines, eight moving heads, beams raking down onto the stage and across the hall.
layer("light-beams", ({ THREE }) => {
  const scene = new THREE.Scene(), r = rng(11), m = dark();
  scene.add(new THREE.AmbientLight(0x404a66, 0.6));
  const cols = ["#4d9bff", "#ff3d8b", "#e8eeff", "#7b6cff"];
  for (const [y, z, k] of [[9.4, -6, 0], [10.6, -1, 1]]) {
    scene.add(truss(V3(-18, y, z), V3(18, y, z), m));
    for (let i = 0; i < 8; i++) {
      const x = -14 + i * 4, p = V3(x, y - 0.35, z), c = cols[(i + k * 2) % 4];
      const cross = (i % 2 ? 1 : -1) * (4 + r() * 6);
      const t = V3(x * 1.3 + cross, -0.5, 2 + r() * 12);
      scene.add(movingHead(p, t, c, m));
      scene.add(beam(p, t, { radius: 0.8 + r() * 0.4, color: c, intensity: 0.24 + r() * 0.08, haze: 0.8, falloff: 1.15 }));
    }
  }
  scene.add(motes(1600, new THREE.Box3(V3(-18, -1, -7), V3(18, 10, 6)), "#9fb6ff", 0.045, 4, 0.5));
  return { scene, camera: cam(46, V3(0, 3, 24), V3(0, 3.4, 0)) };
});

// Major championship: wider symmetrical fan in white and gold from a triple rig.
layer("light-beams-major", ({ THREE }) => {
  const scene = new THREE.Scene(), r = rng(23), m = dark();
  scene.add(new THREE.AmbientLight(0x404a66, 0.6));
  for (const [y, z, n, k] of [[9.4, -8, 12, 0], [10.8, -3.5, 14, 1], [12.2, 1, 10, 2]]) {
    scene.add(truss(V3(-22, y, z), V3(22, y, z), m));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = -19 + u * 38, p = V3(x, y - 0.35, z), fan = (u - 0.5) * 2;
      const c = (i + k) % 3 === 0 ? "#ffc861" : (i + k) % 3 === 1 ? "#ffffff" : "#c4d8ff";
      const t = V3(x * 1.25 + (r() - 0.5) * 8, -0.5, 1 + r() * 13);
      scene.add(movingHead(p, t, c, m));
      scene.add(beam(p, t, { radius: 0.7 + r() * 0.3, color: c, intensity: 0.2 + r() * 0.07, haze: 0.8, falloff: 1.15 }));
    }
  }
  scene.add(motes(2200, new THREE.Box3(V3(-22, -1, -9), V3(22, 12, 6)), "#ffe2b0", 0.045, 5, 0.55));
  return { scene, camera: cam(50, V3(0, 3, 26), V3(0, 3.8, 0)) };
});

// The Palace: warm gold crown of beams from a curved rig, plus chandelier glow along the hall.
layer("light-beams-palace", ({ THREE }) => {
  const scene = new THREE.Scene(), r = rng(37), m = dark();
  scene.add(new THREE.AmbientLight(0x403020, 0.6));
  const arc = (i, n, R, y, z0) => { const a = Math.PI * (0.1 + 0.8 * i / (n - 1)); return V3(-Math.cos(a) * R, y + Math.sin(a) * 2.6, z0); };
  for (const [R, y, z, n] of [[19, 8.8, -7, 15], [23, 10.4, -2, 17]]) {
    for (let i = 0; i < n - 1; i++) scene.add(truss(arc(i, n, R, y, z), arc(i + 1, n, R, y, z), m, 0.28));
    for (let i = 0; i < n; i++) {
      const p = arc(i, n, R, y - 0.35, z), u = i / (n - 1);
      const t = V3((u - 0.5) * 34 + (r() - 0.5) * 6, -0.5, 1 + r() * 13);
      const c = i % 4 === 0 ? "#fff4dc" : "#ffbf5c";
      scene.add(movingHead(p, t, c, m));
      scene.add(beam(p, t, { radius: 0.7 + r() * 0.3, color: c, intensity: 0.21 + r() * 0.07, haze: 0.8, falloff: 1.15 }));
    }
  }
  for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) {
    const p = V3(sd * (9 + i * 1.6), 7.2 - i * 0.25, -6 + i * 4);
    scene.add(lens(p, "#ffcc88", 0.3, 0.9));
    scene.add(motes(70, new THREE.Box3(p.clone().addScalar(-0.5), p.clone().addScalar(0.5)), "#ffd9a0", 0.05, 100 + i * 2 + (sd > 0 ? 1 : 0), 1.6));
  }
  scene.add(motes(2600, new THREE.Box3(V3(-24, -1, -8), V3(24, 13, 8)), "#ffd79a", 0.045, 6, 0.6));
  return { scene, camera: cam(52, V3(0, 3, 27), V3(0, 4, 0)) };
});

// Club: a single warm shade over the oche, with dust turning in its light. Deliberately modest.
layer("light-lamp", ({ THREE }) => {
  const scene = new THREE.Scene();
  const p = V3(0, 6.2, -2);
  scene.add(beam(p, V3(0, -0.5, -1.2), { radius: 3.2, color: "#ffb766", intensity: 0.22, haze: 0.6, apex: 0.5, falloff: 0.9 }));
  scene.add(lens(p, "#ffcf8a", 0.35, 1.0));
  scene.add(pool(V3(0, -0.45, -1.2), V3(0, 1, 0), [9, 9], "#ffb35c", 0.35, 1.8));
  scene.add(motes(900, new THREE.Box3(V3(-2.6, 0, -3.5), V3(2.6, 6, 0.5)), "#ffd2a0", 0.03, 21, 0.9));
  return { scene, camera: cam(48, V3(0, 2.6, 11), V3(0, 2.6, 0)) };
});

// County / national hall: a row of three overhead spots on a plain bar, neutral-warm.
layer("light-hall", ({ THREE }) => {
  const scene = new THREE.Scene(), m = dark();
  scene.add(new THREE.AmbientLight(0x404040, 0.5));
  scene.add(truss(V3(-9, 7.6, -3), V3(9, 7.6, -3), m, 0.22));
  for (const x of [-5.5, 0, 5.5]) {
    const p = V3(x, 7.3, -3);
    scene.add(beam(p, V3(x * 0.6, -0.5, -1), { radius: 2.2, color: x === 0 ? "#fff1d8" : "#ffe2b8", intensity: x === 0 ? 0.2 : 0.14, haze: 0.65, apex: 0.18, falloff: 1.0 }));
    scene.add(lens(p, "#fff0d0", 0.22, 1.0));
    scene.add(pool(V3(x * 0.6, -0.45, -1), V3(0, 1, 0), [6, 6], "#ffe7c4", 0.18, 1.8));
  }
  scene.add(motes(1200, new THREE.Box3(V3(-9, 0, -4), V3(9, 7, 1)), "#ffe8c8", 0.035, 31, 0.6));
  return { scene, camera: cam(50, V3(0, 3, 15), V3(0, 3.6, 0)) };
});

// Professional floor: a receding line of cool LED strips over each board, as on a multi-board floor.
layer("light-floor", ({ THREE }) => {
  const scene = new THREE.Scene();
  for (let i = 0; i < 12; i++) {
    const z = 2 - i * 3.2;
    for (const x of [-4.2, 4.2]) {
      const p = V3(x, 4.2, z);
      const sp = lens(p, "#dfeaff", 0.22, 0.9); sp.scale.set(3.4, 0.6, 1); scene.add(sp);
      scene.add(beam(p, V3(x * 0.85, -0.5, z + 0.6), { radius: 1.3, color: "#cfe0ff", intensity: 0.1, haze: 0.5, apex: 0.25, falloff: 0.9 }));
    }
  }
  scene.add(motes(900, new THREE.Box3(V3(-6, 0, -36), V3(6, 5, 3)), "#cfe0ff", 0.035, 41, 0.5));
  return { scene, camera: cam(52, V3(0, 2.4, 9), V3(0, 2.6, -8)) };
});

// Follow-spot for walk-ons, match introductions and the winning moment: one hard white cone and a pool.
// Pool sits at 50% x / ~78% y of the frame; the component shifts the layer onto each plate's stage point.
layer("spotlight", ({ THREE }) => {
  const scene = new THREE.Scene();
  scene.add(beam(V3(0, 13, -1.4), V3(0, -0.5, -1), { radius: 1.35, color: "#fff6e8", intensity: 0.4, haze: 0.55, apex: 0.12, falloff: 0.55 }));
  scene.add(beam(V3(-2.6, 12.5, -3), V3(0, -0.5, -1.2), { radius: 1.6, color: "#dfe9ff", intensity: 0.13, haze: 0.6, apex: 0.1, falloff: 0.8 }));
  scene.add(lens(V3(0, 12.6, -1.4), "#fff6e8", 0.3, 0.8));
  scene.add(pool(V3(0, -0.45, -1), V3(0, 1, 0), [6.5, 3.2], "#fff3e0", 0.7, 2.2));
  scene.add(motes(1400, new THREE.Box3(V3(-3, 0, -3), V3(3, 12, 1)), "#ffffff", 0.03, 51, 0.7));
  return { scene, camera: cam(50, V3(0, 3.6, 15), V3(0, 5.6, 0)) };
});

// Pyro: four gerb fountains along the stage front, spark trails rendered as additive streaks.
layer("pyro", ({ THREE }) => {
  const scene = new THREE.Scene(), r = rng(61);
  const segs = [], cols = [];
  for (const x0 of [-9, -3.2, 3.2, 9]) {
    for (let k = 0; k < 900; k++) {
      const t = r() * 1.7, a = (r() - 0.5) * 0.32, sp = 13 + r() * 5;
      const vx = Math.sin(a) * sp, vy = Math.cos(a) * sp, g = -9.8;
      const pos = (tt) => V3(x0 + vx * tt, vy * tt + 0.5 * g * tt * tt, (r() - 0.5) * 0.02);
      const p1 = pos(t), p0 = pos(Math.max(0, t - 0.035 - r() * 0.03));
      if (p1.y < -0.2) continue;
      const heat = Math.max(0.15, 1 - t / 1.8), c = col("#ffd08a").lerp(col("#ff7a1a"), 1 - heat).multiplyScalar(0.55 + heat * 0.9);
      segs.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); cols.push(c.r * 0.2, c.g * 0.2, c.b * 0.2, c.r, c.g, c.b);
    }
    scene.add(lens(V3(x0, 0.1, 0), "#ffcf86", 0.5, 1.2));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  scene.add(motes(500, new THREE.Box3(V3(-11, 0, -0.5), V3(11, 9, 0.5)), "#ffc070", 0.06, 62, 0.9));
  return { scene, camera: cam(50, V3(0, 4.2, 17), V3(0, 4.4, 0)) };
});

// ---------------------------------------------------------------- celebration layers (alpha, PBR confetti)
function confettiScene(THREE, renderer, { seed, count, palette, ribbons = 0, spread = [26, 15, 8], size = [0.16, 0.24] }) {
  const scene = new THREE.Scene(), r = rng(seed);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.SpotLight(0xfff2dc, 900, 80, 0.9, 0.6); key.position.set(-4, 22, 10); key.target.position.set(0, 4, 0); scene.add(key, key.target);
  scene.add(new THREE.DirectionalLight(0xbcd2ff, 0.8).translateX(8).translateY(6).translateZ(4));
  const pieces = [];
  const mats = palette.map(([c, metal, rough]) => new THREE.MeshPhysicalMaterial({ color: c, metalness: metal, roughness: rough, side: THREE.DoubleSide, envMapIntensity: 1.6, clearcoat: metal > 0.5 ? 0.6 : 0 }));
  const geos = [new THREE.PlaneGeometry(size[0], size[1]), new THREE.PlaneGeometry(size[0] * 0.8, size[1] * 1.3), new THREE.CircleGeometry(size[0] * 0.6, 14)];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos[i % 3 === 2 && r() < 0.3 ? 2 : r() < 0.5 ? 0 : 1], mats[Math.floor(r() * mats.length)]);
    const depth = Math.pow(r(), 0.7);
    m.position.set((r() - 0.5) * spread[0] * (0.6 + depth), r() * spread[1] - 1, 6 - depth * spread[2] * 2);
    m.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28);
    pieces.push({ m, p0: m.position.clone(), r0: m.rotation.clone(), v: V3((r() - 0.5) * 0.25, -0.35 - r() * 0.3, 0), w: V3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9) });
    scene.add(m);
  }
  // Ticker tape: curled foil/paper strips.
  for (let i = 0; i < ribbons; i++) {
    const len = 0.9 + r() * 1.4, segN = 40, wdt = 0.07 + r() * 0.03, twist = (r() - 0.5) * 8, curl = 0.4 + r() * 0.8, ph = r() * 6.28;
    const pos = [], idx = [];
    for (let k = 0; k <= segN; k++) {
      const u = k / segN, y = -u * len, cx = Math.sin(u * curl * 6 + ph) * 0.18, cz = Math.cos(u * curl * 5 + ph) * 0.18, a = u * twist;
      pos.push(cx - Math.cos(a) * wdt / 2, y, cz - Math.sin(a) * wdt / 2, cx + Math.cos(a) * wdt / 2, y, cz + Math.sin(a) * wdt / 2);
      if (k < segN) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats[Math.floor(r() * mats.length)]);
    const depth = Math.pow(r(), 0.7);
    m.position.set((r() - 0.5) * spread[0] * (0.6 + depth), r() * spread[1] + 0.5, 6 - depth * spread[2] * 2);
    m.rotation.set((r() - 0.5) * 0.8, r() * 6.28, (r() - 0.5) * 0.8);
    pieces.push({ m, p0: m.position.clone(), r0: m.rotation.clone(), v: V3((r() - 0.5) * 0.15, -0.25 - r() * 0.2, 0), w: V3((r() - 0.5) * 1.5, (r() - 0.5) * 4, (r() - 0.5) * 1.5) });
    scene.add(m);
  }
  const camera = cam(48, V3(0, 5.5, 18), V3(0, 5.5, 0));
  // Sub-frames: a short shutter interval for motion blur, plus a small aperture jitter for depth of field.
  const subframe = (u, i) => {
    const dt = (u - 0.5) * 0.06;
    for (const p of pieces) {
      p.m.position.copy(p.p0).addScaledVector(p.v, dt * 10);
      p.m.rotation.set(p.r0.x + p.w.x * dt, p.r0.y + p.w.y * dt, p.r0.z + p.w.z * dt);
    }
    const a = i * 2.39996, rad = 0.12 * Math.sqrt((i + 0.5) / 12);
    camera.position.set(Math.cos(a) * rad, 5.5 + Math.sin(a) * rad, 18); camera.lookAt(0, 5.5, 0);
  };
  return { scene, camera, subframe };
}
const GOLD = ["#e9b949", 1, 0.22], GOLD_DEEP = ["#c98f2a", 1, 0.3], SILVER = ["#dfe5ee", 1, 0.18], WHITE = ["#f4f1ea", 0, 0.55];
layer("confetti-silver", ({ THREE, renderer }) => confettiScene(THREE, renderer, { seed: 71, count: 420, palette: [SILVER, SILVER, WHITE, ["#b9c8dc", 1, 0.25]] }));
layer("confetti-gold", ({ THREE, renderer }) => confettiScene(THREE, renderer, { seed: 81, count: 950, palette: [GOLD, GOLD, GOLD_DEEP, SILVER, WHITE] }));
layer("tickertape-palace", ({ THREE, renderer }) => confettiScene(THREE, renderer, { seed: 91, count: 900, ribbons: 340, palette: [GOLD, GOLD, GOLD_DEEP, SILVER, WHITE, WHITE] }));

// ---------------------------------------------------------------- plates (opaque backdrops)
/** Dartboard face drawn on a canvas (20 segments, doubles/trebles, bull). No numbers, no marks. */
function dartboardTexture(THREE) {
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d"), cx = S / 2;
  x.fillStyle = "#0c0c0c"; x.beginPath(); x.arc(cx, cx, cx, 0, 7); x.fill();
  const ring = (r0, r1, colA, colB) => { for (let i = 0; i < 20; i++) { const a0 = (i - 0.5) * Math.PI / 10 - Math.PI / 2, a1 = a0 + Math.PI / 10;
    x.fillStyle = i % 2 ? colA : colB; x.beginPath(); x.arc(cx, cx, r1, a0, a1); x.arc(cx, cx, r0, a1, a0, true); x.fill(); } };
  const R = cx * 0.78;
  ring(R * 0.1, R * 0.582, "#efe2c4", "#151515"); ring(R * 0.582, R * 0.629, "#1f8a4c", "#c8202a");
  ring(R * 0.629, R * 0.953, "#efe2c4", "#151515"); ring(R * 0.953, R, "#1f8a4c", "#c8202a");
  x.fillStyle = "#1f8a4c"; x.beginPath(); x.arc(cx, cx, R * 0.094, 0, 7); x.fill();
  x.fillStyle = "#c8202a"; x.beginPath(); x.arc(cx, cx, R * 0.037, 0, 7); x.fill();
  x.strokeStyle = "#b9bcc2"; x.lineWidth = 2; for (const r of [R * 0.094, R * 0.582, R * 0.629, R * 0.953, R]) { x.beginPath(); x.arc(cx, cx, r, 0, 7); x.stroke(); }
  for (let i = 0; i < 20; i++) { const a = (i - 0.5) * Math.PI / 10 - Math.PI / 2; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.094, cx + Math.sin(a) * R * 0.094); x.lineTo(cx + Math.cos(a) * R, cx + Math.sin(a) * R); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** Abstract LED fascia/screen content: gradient field with a fine diamond lattice. No text or marks. */
function ledTexture(THREE, a, b, accent, seed) {
  const W = 1024, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), r = rng(seed);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.35; x.strokeStyle = accent; x.lineWidth = 1.5;
  for (let i = -H; i < W; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); x.beginPath(); x.moveTo(i + H, 0); x.lineTo(i, H); x.stroke(); }
  x.globalAlpha = 1; for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,220,150,${0.2 + r() * 0.5})`; x.fillRect(r() * W, r() * H, 2, 2); }
  for (let y = 0; y < H; y += 3) { x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(0, y, W, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Seated crowd at round tables: instanced bodies and heads, warm table lamps. */
function crowdTables(THREE, scene, { rows, cols, z0, dz, xSpan, seed, lampColor = "#ffb867" }) {
  const r = rng(seed), body = new THREE.CapsuleGeometry(0.2, 0.42, 4, 8), head = new THREE.SphereGeometry(0.13, 10, 8), top = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20);
  const skin = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.55 }), cloth = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.75 });
  const cloth2 = new THREE.MeshStandardMaterial({ color: 0x120a0b, roughness: 0.75 }), tableMat = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.65, metalness: 0.05 });
  const N = rows * cols * 6, bodies = new THREE.InstancedMesh(body, cloth, N), bodies2 = new THREE.InstancedMesh(body, cloth2, N), heads = new THREE.InstancedMesh(head, skin, N * 2), tables = new THREE.InstancedMesh(top, tableMat, rows * cols);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(); let nb = 0, nb2 = 0, nh = 0, nt = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const tx = -xSpan / 2 + (j + 0.5) * xSpan / cols + (r() - 0.5) * 0.5, tz = z0 + i * dz + (r() - 0.5) * 0.4;
    if (Math.abs(tx) < 2.2 && tz < z0 + dz * 6) continue; // walk-on aisle
    tables.setMatrixAt(nt++, M.compose(V3(tx, 0.75, tz), Q.identity(), V3(1, 1, 1)));
    if (r() < 0.55) scene.add(lens(V3(tx, 0.95, tz), lampColor, 0.07, 0.55));
    const seats = 5 + Math.floor(r() * 2);
    for (let k = 0; k < seats; k++) {
      const a = k / seats * 6.28 + r() * 0.3, px = tx + Math.cos(a) * 0.95, pz = tz + Math.sin(a) * 0.95, standing = r() < 0.12 ? 0.35 : 0;
      const target = (r() < 0.5 ? bodies : bodies2); const s = 0.9 + r() * 0.25;
      target.setMatrixAt(target === bodies ? nb++ : nb2++, M.compose(V3(px, 0.62 + standing, pz), Q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.15)), V3(s, s, s)));
      heads.setMatrixAt(nh++, M.compose(V3(px + (r() - 0.5) * 0.05, 1.18 + standing + (s - 1) * 0.5, pz), Q.identity(), V3(s, s * 1.1, s)));
    }
  }
  bodies.count = nb; bodies2.count = nb2; heads.count = nh; tables.count = nt;
  scene.add(bodies, bodies2, heads, tables);
}
/** Raked balcony crowd: rows of seated silhouettes along a side gallery. */
function balconyCrowd(THREE, scene, { x, y, z0, z1, rows, seed, facing }) {
  const r = rng(seed), body = new THREE.CapsuleGeometry(0.19, 0.36, 3, 6), head = new THREE.SphereGeometry(0.12, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.9 }), hm = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.8 });
  const per = Math.floor((z1 - z0) / 0.62), N = per * rows, b = new THREE.InstancedMesh(body, mat, N), h = new THREE.InstancedMesh(head, hm, N);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(); let n = 0;
  for (let row = 0; row < rows; row++) for (let i = 0; i < per; i++) {
    if (r() < 0.06) continue;
    const px = x + facing * row * 0.85, py = y + row * 0.5, pz = z0 + i * 0.62 + (r() - 0.5) * 0.1;
    b.setMatrixAt(n, M.compose(V3(px, py + 0.5, pz), Q.identity(), V3(1, 1, 1))); h.setMatrixAt(n, M.compose(V3(px, py + 0.98, pz), Q.identity(), V3(1, 1.1, 1))); n++;
  }
  b.count = h.count = n; scene.add(b, h);
}

// The Palace: a fictional Victorian great hall ("Alexandra Grand Hall"), built for this plate.
// Iron-and-glass barrel vault, rose window, side galleries, table-seated crowd, lit championship stage. No trophy.
SCENES["palace-stage"] = { ...SCENE_META["palace-stage"].render, build: ({ THREE, renderer }) => {
  const scene = new THREE.Scene(), r = rng(101);
  scene.fog = new THREE.FogExp2(0x120d0a, 0.012);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.12;
  scene.add(new THREE.HemisphereLight(0x3a3040, 0x120c08, 0.35));
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.8, roughness: 0.45 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.85 });
  const brick = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.9 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.75, metalness: 0.05 });
  const HALL_W = 42, HALL_L = 80, WALL_H = 13, VAULT_R = HALL_W / 2;
  // Floor and walls
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, HALL_L), floor); fl.rotation.x = -Math.PI / 2; fl.position.z = HALL_L / 2 - 12; scene.add(fl);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(HALL_L, WALL_H), plaster); w.position.set(sx * HALL_W / 2, WALL_H / 2, HALL_L / 2 - 12); w.rotation.y = -sx * Math.PI / 2; scene.add(w);
    // Arched windows (night) and pilasters
    for (let i = 0; i < 14; i++) {
      const z = -6 + i * 5.2;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, WALL_H, 0.9), plaster); pil.position.set(sx * (HALL_W / 2 - 0.4), WALL_H / 2, z - 2.6); scene.add(pil);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color("#141c33") }));
      win.position.set(sx * (HALL_W / 2 - 0.05), 9.4, z); win.rotation.y = -sx * Math.PI / 2; scene.add(win);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24, 0, Math.PI), win.material); arch.position.set(sx * (HALL_W / 2 - 0.05), 11.5, z); arch.rotation.y = -sx * Math.PI / 2; scene.add(arch);
      scene.add(lens(V3(sx * (HALL_W / 2 - 1.2), 5.6, z), "#ffbf73", 0.18, 0.7)); // wall sconces
    }
    // Gallery (balcony) with crowd and a lit rail
    const gal = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, HALL_L - 18), new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 0.7 })); gal.position.set(sx * (HALL_W / 2 - 2.5), 5.2, HALL_L / 2 - 6); scene.add(gal);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, HALL_L - 18), new THREE.MeshStandardMaterial({ color: 0x8a6a36, metalness: 0.9, roughness: 0.3 }));
    rail.position.set(sx * (HALL_W / 2 - 5), 5.9, HALL_L / 2 - 6); scene.add(rail);
    balconyCrowd(THREE, scene, { x: sx * (HALL_W / 2 - 4.4), y: 5.45, z0: 4, z1: HALL_L - 18, rows: 4, seed: 120 + sx, facing: sx });
  }
  // Barrel vault: iron ribs and glazing
  const glass = new THREE.MeshStandardMaterial({ color: 0x0d1222, emissive: new THREE.Color("#0c1430"), emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide });
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(VAULT_R, VAULT_R, HALL_L, 64, 1, true, -Math.PI / 2, Math.PI), glass);
  vault.rotation.x = Math.PI / 2; vault.rotation.z = 0; vault.position.set(0, WALL_H, HALL_L / 2 - 12); scene.add(vault);
  for (let i = 0; i < 18; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(VAULT_R - 0.2, 0.18, 8, 64, Math.PI), iron); rib.position.set(0, WALL_H, -10 + i * 4.4); scene.add(rib);
  }
  for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI, purl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, HALL_L, 6), iron);
    purl.rotation.x = Math.PI / 2; purl.position.set(Math.cos(a) * (VAULT_R - 0.3), WALL_H + Math.sin(a) * (VAULT_R - 0.3), HALL_L / 2 - 12); scene.add(purl); }
  // Back wall with rose window above the stage
  const back = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, WALL_H + VAULT_R), brick); back.position.set(0, (WALL_H + VAULT_R) / 2, -12); scene.add(back);
  const roseC = V3(0, 21.5, -11.9);
  const rose = new THREE.Mesh(new THREE.CircleGeometry(6.2, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color("#3a2a40") })); rose.position.copy(roseC); scene.add(rose);
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28, sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.2, 0.1), iron);
    sp.position.copy(roseC).add(V3(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 0.05)); sp.rotation.z = a - Math.PI / 2; scene.add(sp); }
  for (const rr of [1.6, 3.6, 6.2]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.12, 8, 64), iron); ring.position.copy(roseC).add(V3(0, 0, 0.06)); scene.add(ring); }
  scene.add(lens(roseC.clone().add(V3(0, 0, 0.3)), "#9a7cc8", 2.6, 0.18));
  // Stage
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x0e0d10, roughness: 0.3, metalness: 0.3 });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(22, 1.3, 9), stageMat); stage.position.set(0, 0.65, -6.5); scene.add(stage);
  const fascia = new THREE.Mesh(new THREE.PlaneGeometry(22, 1.2), new THREE.MeshBasicMaterial({ map: ledTexture(THREE, "#4a1208", "#a8641c", "#ffd27a", 5) }));
  fascia.position.set(0, 0.65, -1.99); scene.add(fascia);
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(4, 0.43, 0.6), stageMat); st.position.set(0, 0.22 + i * 0.43 - 0.43 * 0, -1.7 + 0.6 * (2 - i) * 0 + 0.55 - i * 0.55); scene.add(st); }
  // Backdrop: dark proscenium wall, ring of lights around the board, side screens
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 11), new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.6 })); wall.position.set(0, 6.8, -10.9); scene.add(wall);
  const boardY = 1.3 + 1.73, boardZ = -10.7;
  const board = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64), new THREE.MeshStandardMaterial({ map: dartboardTexture(THREE), roughness: 0.7, emissive: new THREE.Color("#ffffff"), emissiveMap: dartboardTexture(THREE), emissiveIntensity: 0.55 }));
  board.position.set(0, boardY, boardZ + 0.05); scene.add(board);
  const surround = new THREE.Mesh(new THREE.RingGeometry(0.62, 1.35, 64), new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.5 })); surround.position.set(0, boardY, boardZ + 0.04); scene.add(surround);
  for (const [rr, c, k] of [[3.2, "#ffcf7a", 1.0], [4.3, "#ffb04a", 0.75], [5.4, "#ff8f3a", 0.5]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 10, 128, Math.PI), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(2.2 * k) }));
    ring.position.set(0, boardY - 0.4, boardZ + 0.1); scene.add(ring);
    for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI; scene.add(lens(V3(Math.cos(a) * rr, boardY - 0.4 + Math.sin(a) * rr, boardZ + 0.2), c, 0.07, 0.6 * k)); }
  }
  for (const sx of [-1, 1]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.6), new THREE.MeshBasicMaterial({ map: ledTexture(THREE, "#0b1a3a", "#1d3f7a", "#8fb8ff", 9 + sx) }));
    scr.position.set(sx * 9.2, 6.6, -10.6); scene.add(scr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.0, 0.2), iron); frame.position.set(sx * 9.2, 6.6, -10.75); scene.add(frame);
  }
  // Oche: lit throw line and players' table
  const oche = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe2a8") })); oche.position.set(0, 1.32, boardZ + 2.37); scene.add(oche);
  // Stage and house lighting
  const key = new THREE.SpotLight(0xfff0d8, 2600, 60, 0.32, 0.5, 1.6); key.position.set(0, 18, 8); key.target.position.set(0, 2, -9); scene.add(key, key.target);
  const wash = new THREE.SpotLight(0xffb060, 220, 90, 0.9, 0.8, 1.4); wash.position.set(0, 16, 26); wash.target.position.set(0, 0, 30); scene.add(wash, wash.target);
  const backL = new THREE.PointLight(0xff9a4a, 260, 30, 1.6); backL.position.set(0, 9, -9); scene.add(backL);
  // Stage spill rims the crowd from behind, so the floor reads as silhouettes against the stage.
  for (const sx of [-6, 0, 6]) { const rim = new THREE.SpotLight(0xffc27a, 420, 36, 0.36, 0.95, 1.4); rim.position.set(sx, 2.6, -1.5); rim.target.position.set(sx * 1.5, 2.2, 40); scene.add(rim, rim.target); }
  for (const sx of [-1, 1]) { const g = new THREE.SpotLight(0xffc48a, 900, 70, 0.6, 0.9, 1.5); g.position.set(sx * 14, 14, 20); g.target.position.set(sx * 17, 6, 30); scene.add(g, g.target); }
  // Overhead rig and beams
  const m = dark();
  const arc = (i, n, R, y, z0) => { const a = Math.PI * (0.15 + 0.7 * i / (n - 1)); return V3(-Math.cos(a) * R, y + Math.sin(a) * 2.4, z0); };
  for (const [R, y, z, n] of [[11, 11.5, -6, 11], [14, 12.5, -1.5, 13]]) {
    for (let i = 0; i < n - 1; i++) scene.add(truss(arc(i, n, R, y, z), arc(i + 1, n, R, y, z), m, 0.3));
    for (let i = 0; i < n; i++) {
      const p = arc(i, n, R, y - 0.35, z), u = i / (n - 1), c = i % 3 === 0 ? "#fff3dc" : "#ffbf5c";
      const t = i % 2 ? V3((u - 0.5) * 4, 1.3, -8 + r() * 3) : V3((u - 0.5) * 34, 0.3, 8 + r() * 16);
      scene.add(movingHead(p, t, c, m));
      scene.add(beam(p, t, { radius: 0.5 + r() * 0.3, color: c, intensity: 0.08 + r() * 0.04, haze: 0.8, falloff: 1.1 }));
    }
  }
  // Chandeliers down the hall
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
    const p = V3(sx * 7.5, 13.5, 6 + i * 9);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8, 6), iron); stem.position.set(p.x, p.y + 4.5, p.z); scene.add(stem);
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; scene.add(lens(p.clone().add(V3(Math.cos(a) * 0.8, (k % 2) * 0.35, Math.sin(a) * 0.8)), "#ffd49a", 0.08, 0.9)); }
    scene.add(lens(p, "#ffcf8f", 0.55, 0.35));
  }
  // Crowd at tables across the floor
  crowdTables(THREE, scene, { rows: 22, cols: 13, z0: 1.5, dz: 2.6, xSpan: HALL_W - 12, seed: 131 });
  scene.add(motes(3800, new THREE.Box3(V3(-18, 0, -8), V3(18, 16, 50)), "#ffd8a8", 0.06, 141, 0.45));
  scene.add(pool(V3(0, 1.32, boardZ + 2.6), V3(0, 1, 0), [6, 4], "#fff2dc", 0.35, 2));
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 400); camera.position.set(0, 9.5, 52); camera.lookAt(0, 5.2, -6);
  // Depth of field: aperture-jittered sub-frames, all converging on the oche.
  const focus = V3(0, 3, -9), eye = camera.position.clone(), right = V3(1, 0, 0), up = V3(0, 1, 0);
  const subframe = (u, i) => { const a = i * 2.39996, rad = 0.16 * Math.sqrt((i + 0.5) / 16);
    camera.position.copy(eye).addScaledVector(right, Math.cos(a) * rad).addScaledVector(up, Math.sin(a) * rad);
    camera.lookAt(focus.clone().add(V3(0, 2.2, 3))); };
  return { scene, camera, subframe };
} };

// Neutral broadcast studio: for saves with no event or venue metadata. Implies no particular venue.
SCENES["neutral"] = { ...SCENE_META["neutral"].render, build: ({ THREE, renderer }) => {
  const scene = new THREE.Scene(), r = rng(151), m = dark();
  scene.fog = new THREE.FogExp2(0x07090e, 0.035);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.08;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.22, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), new THREE.MeshStandardMaterial({ color: 0x0b0e15, roughness: 0.8 })); back.position.set(0, 12, -14); scene.add(back);
  // Vertical light slots on the back wall
  for (let i = -5; i <= 5; i++) { const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 9), new THREE.MeshBasicMaterial({ color: new THREE.Color("#4a6aa8").multiplyScalar(1.6 - Math.abs(i) * 0.1) }));
    sl.position.set(i * 3.2, 5.5, -13.9); scene.add(sl); }
  scene.add(truss(V3(-16, 10, -6), V3(16, 10, -6), m));
  for (let i = 0; i < 7; i++) { const x = -12 + i * 4, p = V3(x, 9.65, -6), t = V3(x * 0.4 + (r() - 0.5) * 2, -0.5, -2 + r() * 4);
    scene.add(movingHead(p, t, "#c9d6f0", m)); scene.add(beam(p, t, { radius: 1.0, color: "#b8c8ea", intensity: 0.17, haze: 0.8, falloff: 1.0 })); }
  scene.add(pool(V3(0, 0.02, -3), V3(0, 1, 0), [18, 9], "#9fb3dc", 0.3, 1.6));
  scene.add(pool(V3(0, 6, -13.8), V3(0, 0, 1), [34, 14], "#3c5a96", 0.22, 1.4));
  const key = new THREE.SpotLight(0xc8d6f5, 500, 40, 0.6, 0.9, 1.5); key.position.set(0, 12, 4); key.target.position.set(0, 0, -4); scene.add(key, key.target);
  scene.add(motes(1600, new THREE.Box3(V3(-16, 0, -10), V3(16, 10, 6)), "#b8c8ea", 0.04, 152, 0.45));
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200); camera.position.set(0, 3.2, 16); camera.lookAt(0, 4, -6);
  return { scene, camera };
} };

// Documentary film grain: tileable luminance noise with sparse dust, composited with overlay blend.
SCENES["grain"] = { ...SCENE_META["grain"].render, build: ({ THREE }) => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
  post: (o, W, H) => { const r = rng(161), img = o.createImageData(W, H), d = img.data;
    for (let k = 0; k < d.length; k += 4) { const g = 128 + (r() + r() + r() - 1.5) * 46; d[k] = d[k + 1] = d[k + 2] = g; d[k + 3] = 255; }
    o.putImageData(img, 0, 0);
    for (let i = 0; i < 26; i++) { o.fillStyle = `rgba(${r() < 0.5 ? "20,20,20" : "235,235,235"},${0.25 + r() * 0.3})`; o.beginPath(); o.arc(r() * W, r() * H, 0.6 + r() * 1.6, 0, 7); o.fill(); }
    for (let i = 0; i < 3; i++) { o.strokeStyle = "rgba(230,230,230,.18)"; o.lineWidth = 1; const x = r() * W; o.beginPath(); o.moveTo(x, 0); o.lineTo(x + (r() - 0.5) * 8, H); o.stroke(); } } }) };
