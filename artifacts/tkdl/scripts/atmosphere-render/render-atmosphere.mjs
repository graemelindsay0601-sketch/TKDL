#!/usr/bin/env node
/**
 * Workstream F1 — offline atmosphere renderer (build-time only; three.js is never shipped).
 * Renders scripts/atmosphere-render/scenes.mjs in headless Chromium (WebGL 2 via SwiftShader)
 * to public/assets/career-atmosphere/<id>.webp and writes atmosphere-renders.json.
 *
 *   node scripts/atmosphere-render/render-atmosphere.mjs [ids...]
 *
 * three.js: set THREE_DIR to a three@0.170.0 package directory, or it is installed once into
 * node_modules/.cache/atmosphere-render. Chromium: Playwright's (PLAYWRIGHT_CORE / CHROMIUM_PATH overrides).
 */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const HERE = import.meta.dirname, ROOT = path.resolve(HERE, "../.."), OUT = path.join(ROOT, "public/assets/career-atmosphere");
let THREE_DIR = process.env.THREE_DIR;
if (!THREE_DIR) { const cache = path.join(ROOT, "node_modules/.cache/atmosphere-render"); THREE_DIR = path.join(cache, "node_modules/three");
  if (!fs.existsSync(THREE_DIR)) { fs.mkdirSync(cache, { recursive: true }); execFileSync("npm", ["install", "--prefix", cache, "three@0.170.0", "--no-audit", "--no-fund"], { stdio: "inherit" }); } }
const PW = process.env.PLAYWRIGHT_CORE ?? "/opt/node-tools/node_modules/playwright-core";
const { chromium } = await import(path.join(PW, "index.mjs"));
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };
const server = http.createServer((q, r) => {
  const url = decodeURIComponent(q.url.split("?")[0]);
  const p = url.startsWith("/three/") ? path.join(THREE_DIR, url.slice(7)) : path.join(HERE, url);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); fs.createReadStream(p).pipe(r);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const { SCENE_META } = await import(path.join(HERE, "scene-meta.mjs"));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENE_META);
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, "atmosphere-renders.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { version: 1, renderer: "three.js · additive volumetric light / PBR · UnrealBloom · SwiftShader WebGL2", images: {} };
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on("pageerror", e => console.error(id, e.message)); page.on("console", m => { if (m.type() === "error") console.error(id, m.text()); });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/render.html?id=${id}`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__result, null, { timeout: 900000 });
  const res = await page.evaluate(() => window.__result);
  const file = `${id}.webp`, buf = Buffer.from(res.webp.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, file), buf);
  manifest.images[id] = { file, width: res.size[0], height: res.size[1], ...SCENE_META[id] };
  console.log(`${id}: ${(buf.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.close();
}
manifest.images = Object.fromEntries(Object.entries(manifest.images).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
await browser.close(); server.close();
