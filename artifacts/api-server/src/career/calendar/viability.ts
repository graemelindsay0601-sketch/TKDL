import { runsWith, type InstanceRow } from "./engine.ts";

/**
 * "Will this small event go ahead?" — the facts a player needs for local events that are cancelled
 * when too few players enter (club, county and regional events). Before the field is set: the minimum
 * it needs and the week the field is set. After: going ahead with N players, or cancelled.
 *
 * Deliberately no prediction: season simulations showed a static forecast (local pool, same-day
 * competition) cannot tell which of these events will be the few that cancel, so a "likely" badge
 * would mislead. Event database v10 cut those cancellations to about 3% of small local events.
 */
export type Viability = { status: "PENDING" | "CONFIRMED" | "CANCELLED"; minimum: number; fieldSetWeek: number; entrants: number | null;
  /** v14+: the event runs with whoever enters; byes fill the draw. */ byes?: true } | null;

const LOCAL_CIRCUITS = new Set(["GRASSROOTS", "COUNTY", "REGIONAL"]);
/** Statuses after the field locked with enough players. */
const SETTLED = new Set(["DRAW_PENDING", "DRAWN", "IN_PROGRESS", "COMPLETED"]);

export function viabilityOf(event: Pick<InstanceRow, "status" | "status_reason" | "circuit" | "classification" | "minimum_entrants" | "entrant_count" | "registration_closes_week">
  & Partial<Pick<InstanceRow, "event_database_version" | "snapshot">>): Viability {
  if (!LOCAL_CIRCUITS.has(event.circuit) || event.classification === "SPECIAL") return null;
  const minimum = event.event_database_version !== undefined && event.snapshot ? runsWith(event as Pick<InstanceRow, "event_database_version" | "minimum_entrants" | "snapshot">) : Number(event.minimum_entrants);
  const base = { minimum, fieldSetWeek: Number(event.registration_closes_week), ...(minimum < Number(event.minimum_entrants) ? { byes: true as const } : {}) };
  if (event.status === "CANCELLED") return event.status_reason === "INSUFFICIENT_ENTRANTS" ? { ...base, status: "CANCELLED", entrants: null } : null;
  if (SETTLED.has(event.status)) return { ...base, status: "CONFIRMED", entrants: Number(event.entrant_count) || null };
  return { ...base, status: "PENDING", entrants: null };
}
