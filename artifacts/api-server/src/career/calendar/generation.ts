import { createHash } from "node:crypto";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { catalogueFor, type EventDefinition, type ScheduleSlot } from "./catalogue.ts";
import { CALENDAR_GENERATION_VERSION, DAYS_PER_WEEK, WEEKS_PER_SEASON, groupingForWeek } from "./config.ts";
import { assessCapability, eventFormatSchema, type Capability } from "./formats.ts";
import { ruleSchema, type Rule } from "./eligibility.ts";
import { LOCALITIES, LOCALITIES_V1, venueByKey, localVenue, zoneOf, COUNTRIES, COUNTY_CATCHMENTS } from "./geography.ts";
import { venueContent } from "../content/world.ts";

/** Everything a season instance needs to stay historically truthful. */
export type InstanceSnapshot = Omit<EventDefinition, "schedule" | "eligibility"> & {
  eligibility: Rule;
  capability: Capability;
  resolvedFrom: { definitionKey: string; eventDatabaseVersion: number; definitionHash: string; calendarGenerationVersion: number };
};

export type EventInstanceDraft = {
  id: string; instanceKey: string; season: number; ordinal: number;
  definitionKey: string; eventDatabaseVersion: number; name: string; family: string;
  circuit: EventDefinition["circuit"]; classification: EventDefinition["classification"]; rankingCategory: string | null;
  presentationTier: EventDefinition["presentation"]["tier"]; featured: boolean; calendarPriority: number;
  venueKey: string; city: string; country: string; region: string; zone: string; localityKey: string | null;
  startWeek: number; endWeek: number; startDay: number; endDay: number;
  registrationOpensWeek: number; registrationClosesWeek: number;
  fieldSize: number; minimumEntrants: number; executable: boolean;
  seriesKey: string | null; seriesDay: number | null;
  snapshot: InstanceSnapshot;
};

export const absoluteDay = (week: number, day: number) => (week - 1) * DAYS_PER_WEEK + day;
export const weekOfDay = (absolute: number) => Math.floor((absolute - 1) / DAYS_PER_WEEK) + 1;

// Canonical JSON so definition hashes do not depend on key insertion order.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const calendarHashOf = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
export const definitionHash = (definition: EventDefinition) => createHash("sha256").update(canonicalJson(definition)).digest("hex");

type Placement = { slotKey: string; week: number; day: number; endWeek: number; endDay: number; venueKey: string; label: string | null; country: string; localityKey: string | null };

function placements(definition: EventDefinition, seed: string, season: number): Placement[] {
  const schedule = definition.schedule;
  if (schedule.kind === "FIXED") {
    return schedule.slots.map((slot: ScheduleSlot, index) => {
      const rotation = definition.content?.venueRotation;
      const venue = venueByKey(rotation?.length ? rotation[(season - 1 + index) % rotation.length] : slot.venue);
      return { slotKey: `s${index + 1}`, week: slot.week, day: slot.day, endWeek: slot.endWeek ?? slot.week, endDay: slot.endDay ?? slot.day,
        venueKey: venue.key, label: slot.label ?? null, country: slot.country ?? venue.country,
        localityKey: definition.eventDatabaseVersion >= 3 ? LOCALITIES.find(l => l.country === venue.country && l.region === venue.region)?.key ?? null : null };
    });
  }
  // Controlled deterministic rotation: stochastic rounding of locality density + seeded week choice.
  const out: Placement[] = [];
  for (const locality of definition.eventDatabaseVersion >= 3 ? LOCALITIES : LOCALITIES_V1) {
    if (schedule.countries && !schedule.countries.includes(locality.country)) continue;
    const rng = scopedRandom(seed, CALENDAR_GENERATION_VERSION, "calendar-rotation", season, definition.key, locality.key);
    const expected = locality.weight * schedule.perWeight;
    const count = Math.floor(expected) + (rng() < expected - Math.floor(expected) ? 1 : 0);
    const weeks = Array.from({ length: schedule.weekRange[1] - schedule.weekRange[0] + 1 }, (_, i) => schedule.weekRange[0] + i);
    for (let i = weeks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [weeks[i], weeks[j]] = [weeks[j], weeks[i]]; }
    const venue = localVenue(locality.key, schedule.venueKind);
    for (const week of weeks.slice(0, Math.min(count, weeks.length)).sort((a, b) => a - b)) {
      out.push({ slotKey: `${locality.key}-w${week}`, week, day: schedule.day, endWeek: week, endDay: schedule.day, venueKey: venue.key, label: null, country: locality.country, localityKey: locality.key });
    }
  }
  return out.sort((a, b) => a.week - b.week || a.day - b.day || (a.slotKey < b.slotKey ? -1 : 1));
}

function resolveText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Deterministic season generation. Inputs: world seed, event database version,
 * calendar generation version and season. No clock, no Math.random().
 */
export function generateSeason(seed: string, eventDatabaseVersion: number, season: number): EventInstanceDraft[] {
  if (!Number.isSafeInteger(season) || season < 1) throw new Error("Invalid season");
  const drafts: EventInstanceDraft[] = [];
  for (const definition of catalogueFor(eventDatabaseVersion)) {
    // New v5 careers establish themselves after the initial Q-School window.
    // Do not move the clock, invent results, or rewrite any v1–v4 edition.
    if(eventDatabaseVersion>=5 && season===1 && definition.circuit==="Q_SCHOOL")continue;
    const hash = definitionHash(definition);
    const { schedule: _schedule, eligibility: rawEligibility, ...rest } = definition;
    placements(definition, seed, season).forEach((placement, index) => {
      const venue = venueByKey(placement.venueKey);
      const locality = placement.localityKey ? LOCALITIES.find(l => l.key === placement.localityKey)! : null;
      const values: Record<string, string> = {
        n: String(index + 1), city: placement.label && !locality ? placement.label : venue.city, label: placement.label ?? venue.city,
        region: locality?.region ?? venue.region, country: placement.country, countryName: COUNTRIES[placement.country]?.name ?? placement.country,
        zone: zoneOf(placement.country), locality: placement.localityKey ?? "",
      };
      const catchment = placement.localityKey ? COUNTY_CATCHMENTS[placement.localityKey] ?? [placement.localityKey] : [];
      // "{catchment}" expands to a list inside LOCALITY rules; other placeholders are plain text.
      const expanded = JSON.stringify(rawEligibility).replace('["{catchment}"]', JSON.stringify(catchment));
      const eligibility = ruleSchema.parse(JSON.parse(resolveText(expanded, values)));
      const format = eventFormatSchema.parse(definition.format);
      const startDay = absoluteDay(placement.week, placement.day);
      const endDay = absoluteDay(placement.endWeek, placement.endDay);
      if (placement.week < 1 || placement.endWeek > WEEKS_PER_SEASON || endDay < startDay) throw new Error(`Invalid event window for ${definition.key}`);
      groupingForWeek(placement.week);
      const instanceKey = `${definition.key}:${placement.slotKey}`;
      const capability = assessCapability(format, definition.eventDatabaseVersion >= 4);
      const snapshot: InstanceSnapshot = { ...structuredClone(rest), eligibility, capability,
        resolvedFrom: { definitionKey: definition.key, eventDatabaseVersion, definitionHash: hash, calendarGenerationVersion: CALENDAR_GENERATION_VERSION } };
      if (snapshot.content) snapshot.content.venue = venueContent(venue.key);
      drafts.push({
        id: stableUuid(seed, CALENDAR_GENERATION_VERSION, "event-instance", eventDatabaseVersion, season, instanceKey),
        instanceKey, season, ordinal: index + 1, definitionKey: definition.key, eventDatabaseVersion,
        name: resolveText(definition.name, values), family: definition.family,
        circuit: definition.circuit, classification: definition.classification,
        rankingCategory: definition.classification === "RANKING" ? definition.rankingCategory : null,
        presentationTier: definition.presentation.tier, featured: definition.presentation.featured, calendarPriority: definition.presentation.calendarPriority,
        venueKey: venue.key, city: venue.city, country: placement.country, region: locality?.region ?? venue.region, zone: zoneOf(placement.country), localityKey: placement.localityKey,
        startWeek: placement.week, endWeek: placement.endWeek, startDay, endDay,
        registrationOpensWeek: Math.max(1, placement.week - definition.registrationLeadWeeks), registrationClosesWeek: placement.week,
        fieldSize: definition.fieldSize, minimumEntrants: definition.minimumEntrants, executable: capability.executable,
        seriesKey: definition.series?.key ?? null, seriesDay: definition.series?.day ?? null, snapshot,
      });
    });
  }
  validateDrafts(drafts);
  return drafts.sort((a, b) => a.startDay - b.startDay || b.calendarPriority - a.calendarPriority || (a.instanceKey < b.instanceKey ? -1 : 1));
}

export function validateDrafts(drafts: readonly EventInstanceDraft[]): void {
  const keys = new Set<string>();
  for (const draft of drafts) {
    if (keys.has(draft.instanceKey)) throw new Error(`Duplicate event instance key ${draft.instanceKey}`);
    keys.add(draft.instanceKey);
    if ((draft.classification === "SPECIAL") !== (draft.circuit === "SPECIAL") || (draft.classification === "SPECIAL" && draft.rankingCategory !== null)) throw new Error(`SPECIAL ${draft.instanceKey} cannot carry ranking`);
    if (draft.classification === "RANKING" && !draft.rankingCategory) throw new Error(`RANKING ${draft.instanceKey} needs a category`);
    if (!Number.isInteger(draft.fieldSize) || draft.fieldSize < 2 || draft.fieldSize > 128) throw new Error(`Invalid field size for ${draft.instanceKey}`);
  }
}
