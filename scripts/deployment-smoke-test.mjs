#!/usr/bin/env node

/** Read-only production smoke test. It deliberately never submits a score,
 * edits a player, regenerates a programme or sends a notification. */
const baseUrl = (process.argv[2] || "https://tkdl-wt7y.onrender.com").replace(/\/$/, "");
const timeoutMs = 90_000; // Render's free-tier cold start can exceed a minute.

const checks = [
  { name: "Web app", path: "/", kind: "html" },
  { name: "Health", path: "/api/healthz", kind: "json" },
  { name: "Startup state", path: "/api/startup", kind: "json" },
  { name: "Players", path: "/api/players", kind: "json" },
  { name: "Leaderboard", path: "/api/leaderboard", kind: "json" },
  { name: "Seasons", path: "/api/seasons", kind: "json" },
  { name: "Match Centre", path: "/api/match-centre", kind: "json" },
  { name: "Doubles chemistry", path: "/api/doubles/chemistry", kind: "json" },
  { name: "Shift Wars teams", path: "/api/shift-wars/teams", kind: "json" },
  { name: "Shift Wars matches", path: "/api/shift-wars/matches", kind: "json" },
  { name: "TKDL Live status", path: "/api/broadcast/status", kind: "json" },
  { name: "TKDL Live channel", path: "/api/broadcast/channel", kind: "json" },
  { name: "TKDL Live archive", path: "/api/broadcast/archive", kind: "json" },
];

async function runCheck(check) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${check.path}`, {
    headers: { accept: check.kind === "html" ? "text/html" : "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (check.kind === "json") {
    if (!contentType.includes("application/json")) throw new Error(`expected JSON, received ${contentType || "unknown content type"}`);
    await response.json();
  } else {
    const text = await response.text();
    if (!text.toLowerCase().includes("<html")) throw new Error("response was not an HTML page");
  }
  return elapsedMs;
}

console.log(`TKDL read-only deployment smoke test\n${baseUrl}\n`);
let failures = 0;
for (const check of checks) {
  try {
    const elapsedMs = await runCheck(check);
    const speed = elapsedMs > 10_000 ? " (cold/slow)" : "";
    console.log(`PASS  ${check.name.padEnd(22)} ${String(elapsedMs).padStart(6)} ms${speed}`);
  } catch (error) {
    failures++;
    console.error(`FAIL  ${check.name.padEnd(22)} ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${checks.length - failures}/${checks.length} checks passed.`);
if (failures > 0) process.exitCode = 1;
