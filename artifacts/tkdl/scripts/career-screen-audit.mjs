#!/usr/bin/env node
/**
 * DEV-ONLY Career screen audit (F2). Drives the REAL built TKDL frontend served by
 * artifacts/api-server/scripts/career-certification-server.ts (production Career
 * routers over PGlite, fixed signed-in player) and records, for every route at
 * 390px and 1440px:
 *   - console errors and page errors, failed API calls (status >= 400)
 *   - images that failed to load, images without alt, unlabelled buttons/links
 *   - horizontal overflow (document and offending elements)
 *   - cumulative layout shift (PerformanceObserver) and image bytes transferred
 *   - a full-page screenshot (height-capped)
 * Every route is opened by direct navigation, so deep links are exercised too.
 *
 *   node scripts/career-screen-audit.mjs --base=http://localhost:8790 --out=DIR [--only=substring]
 */
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg("base", "http://localhost:8790"), OUT = path.resolve(arg("out", "career-audit")), ONLY = arg("only", "");
fs.mkdirSync(OUT, { recursive: true });
const PW = process.env.PLAYWRIGHT ?? "/opt/node-tools/node_modules/playwright";
const { chromium } = await import(path.join(PW, "index.mjs"));
const api = async p => { const r = await fetch(`${BASE}/api/career${p}`); if (!r.ok) throw new Error(`${p} → ${r.status}`); return r.json(); };
const state = await (await fetch(`${BASE}/__cert/state`)).json();

// ---------------------------------------------------------------- discover real ids
async function ids(saveId) {
  const out = {};
  try {
    const hist = await api(`/saves/${saveId}/history?participant=HUMAN`);
    const won = hist.find(r => r.champion), lost = [...hist].reverse().find(r => !r.champion && r.losses > 0);
    out.title = won?.eventId; out.lost = lost?.eventId; out.tournament = (hist.at(-1) ?? hist[0])?.eventId;
    out.history = { rows: hist.length, titles: hist.filter(r => r.champion).length, won: won && `${won.name} (${won.definitionKey})`, lost: lost && `${lost.name} (${lost.definitionKey}) pos ${lost.position}` };
  } catch (e) { out.historyError = String(e.message); }
  try { const cab = await api(`/saves/${saveId}/trophy-cabinet?offset=0&limit=50`); out.cabinetTotal = cab.total; } catch (e) { out.cabinetError = String(e.message); }
  try { const cal = await api(`/saves/${saveId}/calendar`); const ev = (cal.events ?? []); out.upcoming = ev.find(e => e.status === "REGISTRATION_OPEN")?.id ?? ev[0]?.id; } catch (e) { out.calendarError = String(e.message); }
  try { const life = await api(`/saves/${saveId}/life`);
    const all = JSON.stringify(life); const m = all.match(/"id":"(story[^"]*|news[^"]*|[a-z]+:[^"]{6,})"/); out.story = m?.[1];
    const npc = all.match(/"npcId":"([0-9a-f-]{36})"/); out.npc = npc?.[1]; } catch (e) { out.lifeError = String(e.message); }
  if (!out.npc) try { const p = await api(`/saves/${saveId}/world-players?offset=0&limit=5&search=&status=ACTIVE`); out.npc = (p.players ?? p.items ?? [])[0]?.id; } catch { /* recorded below */ }
  try { const rel = await api(`/saves/${saveId}/relationships`); out.rival = rel.opponents?.[0]?.player?.id ?? out.npc; } catch (e) { out.relError = String(e.message); }
  return out;
}

const routesFor = (s, x) => [
  ["home", `/career/${s}`], ["play", `/career/${s}/play`], ["calendar", `/career/${s}/calendar`],
  ["health", `/career/${s}/health`], ["map", `/career/${s}/map`], ["guide", `/career/${s}/guide`],
  ...(x.tournament ? [["tournament-hub", `/career/${s}/tournaments/${x.tournament}`]] : []),
  ...(x.title ? [["tournament-won", `/career/${s}/tournaments/${x.title}`]] : []),
  ...(x.lost ? [["tournament-lost", `/career/${s}/tournaments/${x.lost}`]] : []),
  ...(x.upcoming ? [["event-entry", `/career/${s}/events/${x.upcoming}`]] : []),
  ["rankings", `/career/${s}/rankings`], ["world", `/career/${s}/world`], ["world-events", `/career/${s}/world/events`],
  ["world-venues", `/career/${s}/world/venues`], ["world-history", `/career/${s}/world/history`], ["world-trophies", `/career/${s}/world/trophies`],
  ["newsroom", `/career/${s}/world/news`], ...(x.story ? [["news-story", `/career/${s}/world/news/${encodeURIComponent(x.story)}`]] : []),
  ["players", `/career/${s}/world/players`], ...(x.npc ? [["npc-profile", `/career/${s}/world/players/${x.npc}/profile`]] : []),
  ...(x.rival ? [["rivalry", `/career/${s}/world/rivalries/${x.rival}`]] : []),
  ["sponsors", `/career/${s}/sponsors`], ["kit-room", `/career/${s}/presentation`], ["finances", `/career/${s}/finances`],
  ["nights", `/career/${s}/nights`], ["club", `/career/${s}/club`], ["money-matches", `/career/${s}/money-matches`],
  ["road-trips", `/career/${s}/road-trips`], ["pro-am", `/career/${s}/pro-am`], ["cam-league", `/career/${s}/cam-league`],
  ["streaming", `/career/${s}/streaming`],
  ["my-career", `/career/${s}/my-career`], ["achievements", `/career/${s}/my-career/achievements`], ["performance", `/career/${s}/my-career/performance`],
  ["my-career-life", `/career/${s}/my-career/life`],
  ["season-history", `/career/${s}/my-career/history`], ["remembered", `/career/${s}/my-career/remembered`], ["legacy", `/career/${s}/history`],
  ["journey", `/career/${s}/journey`], ["road-to-tour", `/career/${s}/road-to-the-tour`], ["goals", `/career/${s}/goals`],
  ["relationships", `/career/${s}/relationships`], ["recognition", `/career/${s}/recognition`], ["stories", `/career/${s}/stories`],
  ["world-search", `/career/${s}/world/search`], ["world-records", `/career/${s}/world/records`],
  ["history-facts", `/career/${s}/history/facts`],
  ["q-school", `/career/${s}/q-school`], ["palace", `/career/${s}/world-championship`],
];

const report = { base: BASE, generated: new Date().toISOString(), state, saves: {} };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const plan = [
  ["season", state.season, null], ["retired", state.retired, ["home", "my-career", "remembered", "legacy", "achievements", "world-trophies", "tournament-won", "calendar"]],
  ["legacy-v2", state.legacy, ["home", "calendar", "tournament-hub", "rankings", "my-career", "world-trophies"]], ["new", state.fresh, ["home", "calendar", "my-career", "world-trophies", "sponsors", "remembered"]],
];
for (const [label, saveId, subset] of plan) {
  const x = await ids(saveId);
  const routes = routesFor(saveId, x).filter(([n]) => (!subset || subset.includes(n)) && (!ONLY || n.includes(ONLY)));
  report.saves[label] = { saveId, ids: x, routes: {} };
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {} });
    for (const [name, route] of routes) {
      const page = await ctx.newPage();
      const errors = [], failed = [], images = [];
      page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
      page.on("pageerror", e => errors.push(`PAGEERROR ${e.message.slice(0, 300)}`));
      page.on("response", async r => { const u = r.url();
        if (r.status() >= 400 && !u.includes("favicon")) failed.push(`${r.status()} ${u.replace(BASE, "")}`);
        if (r.request().resourceType() === "image") { let bytes = 0; try { bytes = (await r.body()).length; } catch {} images.push({ url: u.replace(BASE, ""), bytes, status: r.status() }); } });
      const t0 = Date.now();
      // Do not wait for networkidle: the app shell polls notification and live
      // endpoints, which can keep a page "busy" long after its Career view renders.
      try { await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 }); } catch (e) { errors.push(`NAV ${e.message.slice(0, 120)}`); }
      await page.waitForTimeout(1100);
      // Several Career destinations load their main content after the shell.
      // Wait for blocking skeletons to clear; small inline status messages can
      // remain while unrelated summaries refresh and should not stall the audit.
      try {
        await page.waitForFunction(() => {
          const busy = [...document.querySelectorAll(".career-loading")].filter(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
          });
          return busy.length === 0;
        }, null, { timeout: 9000 });
      } catch { /* keep the loading state in the audit and screenshot */ }
      await page.waitForTimeout(350);
      // The first-visit push prompt is part of the product, but it obscures the
      // underlying route in every screenshot. Dismiss it once and measure the
      // settled page layout separately from its entrance animation.
      try {
        const dismiss = page.getByRole("button", { name: "Not now", exact: true });
        if (await dismiss.count()) await dismiss.first().click({ timeout: 1200 });
      } catch { /* prompt may not be present on this save or route */ }
      await page.evaluate(() => { window.__cls = 0; });
      await page.waitForTimeout(250);
      const info = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1) && getComputedStyle(el).position !== "fixed"; })
          .filter(el => !el.closest("[data-scroll-x], .overflow-x-auto, .overflow-auto, [style*='overflow-x']"))
          .slice(0, 6).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
        const text = document.body.innerText;
        return {
          title: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null,
          overflow: document.documentElement.scrollWidth - vw, offenders,
          brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src).map(i => i.src.replace(location.origin, "")).slice(0, 8),
          imagesNoAlt: [...document.images].filter(i => !i.hasAttribute("alt")).length,
          unlabelled: [...document.querySelectorAll("button, a[href]")].filter(b => {
            const style = getComputedStyle(b), r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none"
              && !(b.textContent?.trim() || b.getAttribute("aria-label") || b.getAttribute("title") || b.querySelector("img[alt]:not([alt=''])"));
          }).length,
          loadingLeft: [...document.querySelectorAll(".career-loading")].some(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
          }),
          errorShown: /Something went wrong|couldn.t load|Could not load|Request failed|Unexpected error/i.test(text),
          cls: Math.round((window.__cls ?? 0) * 1000) / 1000, height: document.documentElement.scrollHeight, textLength: text.length,
        };
      });
      const file = `${label}-${name}-${width}.png`;
      const h = Math.min(info.height, 7000);
      await page.setViewportSize({ width, height: Math.max(900, Math.min(h, 7000)) }); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, file), fullPage: false });
      report.saves[label].routes[`${name}@${width}`] = { route, ms: Date.now() - t0, ...info, errors: [...new Set(errors)].slice(0, 6), failed: [...new Set(failed)].slice(0, 8),
        imageBytes: images.reduce((a, i) => a + i.bytes, 0), imageCount: images.length, imageFailures: images.filter(i => i.status >= 400).map(i => i.url).slice(0, 5), screenshot: file };
      const r = report.saves[label].routes[`${name}@${width}`];
      const flags = [r.overflow > 0 && `overflow+${r.overflow}`, r.errors.length && `errors:${r.errors.length}`, r.failed.length && `failed:${r.failed.length}`, r.brokenImages.length && `broken:${r.brokenImages.length}`, r.errorShown && "ERROR-SHOWN", r.loadingLeft && "STILL-LOADING", r.cls > 0.1 && `cls:${r.cls}`].filter(Boolean);
      console.log(`${label.padEnd(9)} ${String(width).padEnd(4)} ${name.padEnd(16)} ${flags.join(" ") || "ok"}  img=${Math.round(r.imageBytes / 1024)}KB`);
      await page.close();
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, "audit-report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(`Report: ${path.join(OUT, "audit-report.json")}`);
