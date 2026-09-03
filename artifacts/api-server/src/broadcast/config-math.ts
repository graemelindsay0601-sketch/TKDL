// TKDL LIVE — pure parts of the broadcast settings resolver (handover doc
// section 16.1). Split out of config.ts for the same reason story-engine-
// math.ts is split from story-engine.ts and title-predictor-math.ts from
// title-predictor.ts: this file has zero `@workspace/db` imports (not even
// its `/schema` subpath — see story-engine-math.ts's own header for exactly
// why that specific import breaks `node --test`'s direct module resolution),
// so it stays directly unit-testable the same way every other pure file in
// this folder is. config.ts layers the actual settingsTable read/write on
// top of the types and validation logic defined here.

export const BROADCAST_SETTING_KEYS = [
  "broadcast_midday_time",
  "broadcast_evening_time",
  "broadcast_night_time",
  "broadcast_timezone",
  "broadcast_change_threshold",
  "broadcast_simulation_count",
  "broadcast_live_poll_seconds",
  "broadcast_banter_level",
  "broadcast_commentary_version",
  "broadcast_programme_version",
] as const;
export type BroadcastSettingKey = (typeof BROADCAST_SETTING_KEYS)[number];

/** Every default value exactly as listed in section 16.1's own table. */
export const BROADCAST_SETTING_DEFAULTS: Record<BroadcastSettingKey, string> = {
  broadcast_midday_time: "11:30",
  broadcast_evening_time: "19:00",
  broadcast_night_time: "00:00",
  broadcast_timezone: "Europe/London",
  broadcast_change_threshold: "30",
  broadcast_simulation_count: "2500",
  broadcast_live_poll_seconds: "30",
  broadcast_banter_level: "1",
  broadcast_commentary_version: "1",
  broadcast_programme_version: "1",
};

export type BroadcastConfig = {
  /** "HH:MM", validated but intentionally left as a string — edition-slots.ts is what interprets it against a specific calendar day/timezone. */
  middayTime: string;
  eveningTime: string;
  nightTime: string;
  /** An IANA zone name (e.g. "Europe/London") — passed straight to Intl.DateTimeFormat by edition-slots.ts, never parsed here. */
  timezone: string;
  /** 10.1: generate a new Edition when the Edition Change Score reaches this at a slot check. */
  changeThreshold: number;
  /** 8.2: Title Predictor Monte Carlo run count. */
  simulationCount: number;
  /** 14.4/15.4: how often the frontend polls GET /api/broadcast/live. */
  livePollSeconds: number;
  /** 12.7's "banter level" knob — 0 currently reads as a lighter/quieter tone and 2 a livelier one, with 1 ("balanced") as the doc's own named default; the exact tone difference between levels is the Commentary Engine's (12.7's) concern, not this file's. */
  banterLevel: number;
  /** 12.5: part of the seeded-PRNG key, so bumping this deliberately re-shuffles phrase selection without changing any code. */
  commentaryVersion: number;
  /** 14.4's channel.programmeVersion — bumping this signals a running-order/template change to clients, independent of commentaryVersion. */
  programmeVersion: number;
};

function warnAndFallback(key: BroadcastSettingKey, raw: string, reason: string): string {
  console.warn(`broadcast/config: setting "${key}" has an invalid stored value "${raw}" (${reason}) — using the default "${BROADCAST_SETTING_DEFAULTS[key]}" instead`);
  return BROADCAST_SETTING_DEFAULTS[key];
}

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHHMM(key: BroadcastSettingKey, raw: string): string {
  if (!HHMM_PATTERN.test(raw)) return warnAndFallback(key, raw, "not a valid 24-hour HH:MM time");
  return raw;
}

/** `min` defaults to 1 (most of these settings are counts/thresholds that make no sense at 0); banterLevel is the one caller that passes 0, since a "quietest" tone level is a legitimate setting. */
export function parseSettingInt(key: BroadcastSettingKey, raw: string, min = 1): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
    return Number(warnAndFallback(key, raw, `expected an integer >= ${min}`));
  }
  return n;
}

/**
 * A STRICT counterpart to parseHHMM/parseSettingInt, for PATCH
 * /api/admin/broadcast/settings (14.2): those two exist for the tolerant
 * read path (getBroadcastConfig), where an already-bad stored value should
 * warn-and-fall-back rather than ever fail a whole Edition build — but an
 * admin actively submitting a new value should get an immediate, honest
 * rejection instead of having it silently replaced by a default it never
 * asked for. Returns null when `raw` is valid for `key`, or a human-
 * readable reason string when it isn't.
 */
export function validateBroadcastSettingValue(key: BroadcastSettingKey, raw: string): string | null {
  if (key === "broadcast_midday_time" || key === "broadcast_evening_time" || key === "broadcast_night_time") {
    return HHMM_PATTERN.test(raw) ? null : "must be a 24-hour HH:MM time (e.g. \"19:00\")";
  }
  if (key === "broadcast_timezone") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw });
      return null;
    } catch {
      return "must be a valid IANA timezone name (e.g. \"Europe/London\")";
    }
  }
  const min = key === "broadcast_banter_level" ? 0 : 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) return `must be an integer >= ${min}`;
  return null;
}

/** Turns a raw {key -> stored value} lookup into the fully typed, validated BroadcastConfig — shared by config.ts's real DB read and by tests that want to exercise this without a database. */
export function resolveBroadcastConfig(raw: (key: BroadcastSettingKey) => string): BroadcastConfig {
  return {
    middayTime: parseHHMM("broadcast_midday_time", raw("broadcast_midday_time")),
    eveningTime: parseHHMM("broadcast_evening_time", raw("broadcast_evening_time")),
    nightTime: parseHHMM("broadcast_night_time", raw("broadcast_night_time")),
    timezone: raw("broadcast_timezone") || BROADCAST_SETTING_DEFAULTS.broadcast_timezone,
    changeThreshold: parseSettingInt("broadcast_change_threshold", raw("broadcast_change_threshold")),
    simulationCount: parseSettingInt("broadcast_simulation_count", raw("broadcast_simulation_count")),
    livePollSeconds: parseSettingInt("broadcast_live_poll_seconds", raw("broadcast_live_poll_seconds")),
    banterLevel: parseSettingInt("broadcast_banter_level", raw("broadcast_banter_level"), 0),
    commentaryVersion: parseSettingInt("broadcast_commentary_version", raw("broadcast_commentary_version")),
    programmeVersion: parseSettingInt("broadcast_programme_version", raw("broadcast_programme_version")),
  };
}
