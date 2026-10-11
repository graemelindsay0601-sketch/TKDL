/**
 * Workstream F1 — adapters from existing Career reads to AtmosphereInput.
 * They copy fields; they never derive a level, venue or result themselves.
 */
import type { AtmosphereInput, AtmosphereVenue } from "./model";

type Venueish = AtmosphereVenue | null | undefined;

/** Tournament read (api-server tournament/service.ts → TournamentView.event). */
export function atmosphereFromTournament(e: {
  name?: string | null; definitionKey?: string | null; circuit?: string | null; classification?: string | null; level?: number | null;
  content?: { eventClass?: string | null } | null; venue?: Venueish; venueFallback?: { city?: string | null; country?: string | null } | null;
} | null | undefined): AtmosphereInput {
  if (!e) return {};
  return { eventName: e.name ?? null, definitionKey: e.definitionKey ?? null, eventClass: e.content?.eventClass ?? null, circuit: e.circuit ?? null,
    classification: e.classification ?? null, level: e.level ?? null, venue: e.venue ?? null, venueFallback: e.venueFallback ?? null };
}

/** Calendar/content event (presentation tier + content + venue content). */
export function atmosphereFromCalendarEvent(e: {
  name?: string | null; definitionKey?: string | null; circuit?: string | null; classification?: string | null;
  presentation?: { tier?: string | null } | null; content?: { eventClass?: string | null; venue?: Venueish } | null; venue?: Venueish;
} | null | undefined): AtmosphereInput {
  if (!e) return {};
  return { eventName: e.name ?? null, definitionKey: e.definitionKey ?? null, eventClass: e.content?.eventClass ?? null, circuit: e.circuit ?? null,
    classification: e.classification ?? null, presentationTier: e.presentation?.tier ?? null, venue: e.venue ?? e.content?.venue ?? null };
}

/** Documentary moment (legacy/player.ts Moment: label + presentation tier, no venue recorded). */
export function atmosphereFromLegacyMoment(m: { label?: string | null; tier?: string | null } | null | undefined): AtmosphereInput {
  if (!m) return {};
  return { eventName: m.label ?? null, presentationTier: m.tier ?? null };
}
