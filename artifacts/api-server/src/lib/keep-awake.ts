/**
 * Keeps the free Render web service awake during the day, so players don't wait about a minute for a sleeping server.
 *
 * Render spins a free web service down after 15 minutes without inbound requests. Between KEEP_AWAKE_FROM and
 * KEEP_AWAKE_UNTIL (London time, default 08:00 to midnight) the server requests its own public /api/healthz every
 * 10 minutes. That route never touches the database, so Neon still scales to zero.
 *
 * Budget (free tier): 16 hours a day is about 496 of the workspace's 750 free instance hours a month, leaving room for
 * night-time visits; each ping is well under 1 KB, a few MB a month in all. Outside the window the server sleeps as
 * before. The GitHub workflow keep-awake.yml wakes it at the start of the window (a sleeping server can't ping itself).
 *
 * Off when not on Render (no RENDER_EXTERNAL_URL) or when KEEP_AWAKE=0.
 */
const INTERVAL_MS = 10 * 60 * 1000;

export function londonHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(hour);
}

export function withinWindow(hour: number, from: number, until: number): boolean {
  return from <= until ? hour >= from && hour < until : hour >= from || hour < until;
}

export function startKeepAwake(log: (message: string) => void = () => {}) {
  const base = process.env.RENDER_EXTERNAL_URL;
  if (!base || process.env.KEEP_AWAKE === "0") return null;
  const from = Number(process.env.KEEP_AWAKE_FROM ?? 8), until = Number(process.env.KEEP_AWAKE_UNTIL ?? 24);
  const url = `${base.replace(/\/$/, "")}/api/healthz`;
  const timer = setInterval(() => {
    if (!withinWindow(londonHour(), from, until)) return;
    fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "tkdl-keep-awake" } })
      .then(res => res.body?.cancel())
      .catch(error => log(`keep-awake ping failed: ${(error as Error).message}`));
  }, INTERVAL_MS);
  timer.unref();
  log(`keep-awake on: ${url} every 10 minutes, ${from}:00 to ${until}:00 London time`);
  return timer;
}
