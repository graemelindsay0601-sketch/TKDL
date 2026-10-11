#!/usr/bin/env node
/**
 * DEV-ONLY: labelled contact sheets of every shirt in CAREER_KIT_DESIGNS, grouped by asset collection.
 *   node scripts/kit-audit/contact-sheets.mjs --out=DIR [--cell=180]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(arg("out", "kit-contact-sheets")), CELL = Number(arg("cell", 180));
fs.mkdirSync(OUT, { recursive: true });
const { CAREER_KIT_DESIGNS } = await import(pathToFileURL(path.join(ROOT, "src/features/career/kit-catalog.ts")).href);
const groups = { "original-50": k => k.id.startsWith("kit-50-"), "pro-10": k => k.id.startsWith("kit-pro-"),
  "next-40": k => k.id.startsWith("kit-100-"), "expanded-150": k => k.id.startsWith("kit-250-") };
const { chromium } = await import(path.join(process.env.PLAYWRIGHT ?? "/opt/node-tools/node_modules/playwright", "index.mjs"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [name, test] of Object.entries(groups)) {
  const kits = CAREER_KIT_DESIGNS.filter(test);
  for (let page = 0; page * 50 < kits.length; page++) {
    const slice = kits.slice(page * 50, page * 50 + 50);
    const cells = slice.map(k => `<figure><img src="${pathToFileURL(path.join(ROOT, "public/assets/career-kit-library", k.image)).href}"><figcaption><b>${k.id}</b> ${k.name}<br><i>${k.cut ?? ""}${k.makerBrandId ? " · " + k.makerBrandId : ""}</i></figcaption></figure>`).join("");
    const html = `<!doctype html><style>body{margin:0;background:#151a22;font:11px system-ui;color:#dfe6ee}h1{font-size:15px;margin:10px}
      main{display:grid;grid-template-columns:repeat(10,${CELL}px);gap:6px;padding:8px}figure{margin:0;background:#1f2631;border-radius:6px;padding:4px}
      img{width:100%;aspect-ratio:1;object-fit:contain;display:block;background:linear-gradient(135deg,#2a3340,#11161d)}figcaption{height:30px;overflow:hidden;line-height:1.25}i{color:#93a3b5}</style>
      <h1>${name} · ${slice[0].id} – ${slice.at(-1).id} (${slice.length})</h1><main>${cells}</main>`;
    const file = path.join(OUT, `${name}-${page + 1}.html`); fs.writeFileSync(file, html);
    const p = await browser.newPage({ viewport: { width: 10 * (CELL + 6) + 16, height: 600 } });
    await p.goto(pathToFileURL(file).href); await p.waitForLoadState("networkidle");
    await p.screenshot({ path: file.replace(/\.html$/, ".png"), fullPage: true }); await p.close();
    console.log(file.replace(/\.html$/, ".png"));
  }
}
await browser.close();
