import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAdvance, useActiveTournament, useTournamentAction, useCalendar, errorMessage } from "./api";
import { circuitLabel, continueOutcome, weekLabel } from "./model";
import type { AdvanceResult, CareerSave } from "./types";

export type NextEntry = { name: string; week: number } | null;
export type ContinueOutcome = { tone: "info" | "error"; headline: string; detail: string; results?: NonNullable<AdvanceResult["headlines"]> };

/**
 * The one "move time forward" action, shared by the header button and Home's next-move panel.
 * With an event booked it plays on to that event's first match (and opens it); otherwise it stops
 * at the next notable date. A finished tournament is filed away first; it never blocks the server.
 */
/**
 * The last continue result per save, kept outside the component: the week change it causes reloads the
 * Career shell (new header calendar), which remounts the screen that asked, so local state would be lost.
 */
const outcomes = new Map<string, ContinueOutcome | null>();
const listeners = new Set<() => void>();
const setStoredOutcome = (saveId: string, value: ContinueOutcome | null) => { outcomes.set(saveId, value); listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useContinueCareer(save: CareerSave, nextEntry: NextEntry) {
  const advance = useAdvance(save.id);
  const tournament = useActiveTournament(save.id);
  const finished = tournament.data?.tournaments.filter(t => t.terminal) ?? [];
  const dismiss = useTournamentAction(save.id, finished[0]?.eventId ?? "");
  const [, navigate] = useLocation();
  const outcome = useSyncExternalStore(subscribe, () => outcomes.get(save.id) ?? null, () => null);
  const setOutcome = (value: ContinueOutcome | null) => setStoredOutcome(save.id, value);

  const run = async () => {
    setOutcome(null);
    let dismissWarning: string | undefined;
    if (finished.length) {
      try { await dismiss.mutateAsync({ action: "dismiss" }); }
      catch (e) { dismissWarning = errorMessage(e); }
    }
    // mutateAsync, not mutate(..., callbacks): per-call callbacks are dropped if the screen remounts mid-advance.
    try {
      const r = await advance.mutateAsync({ season: save.currentSeason, week: save.currentWeek, target: { kind: nextEntry ? "NEXT_MATCH" : "NEXT_MEANINGFUL" } });
      const matchId = r.stop.reason === "HUMAN_MATCH_PENDING" ? (r.stop.detail as { matchIds?: string[] } | undefined)?.matchIds?.[0] : undefined;
      if (matchId) navigate(`/career/${save.id}/matches/${matchId}/play`);
      else setOutcome({ ...continueOutcome(r, dismissWarning), results: r.headlines });
    } catch (e) {
      setOutcome({ tone: "error", headline: "Couldn't continue",
        detail: dismissWarning ? `Finished event cleanup also failed: ${dismissWarning}. ${errorMessage(e)}` : errorMessage(e) });
    }
  };
  return { run, pending: advance.isPending || dismiss.isPending, outcome, clear: () => setOutcome(null),
    blocked: tournament.isLoading || !!tournament.error, from: { season: save.currentSeason, week: save.currentWeek } };
}

/** Clear result of a continue: where the Career now is and why it stopped. */
export function ContinueOutcomeCard({ outcome, onClose }: { outcome: ContinueOutcome; onClose: () => void }) {
  return <div role="status" className={`career-continue-outcome career-continue-outcome--${outcome.tone}`}>
    <div><strong>{outcome.headline}</strong><span>{outcome.detail}</span>
      {!!outcome.results?.length && <ul className="career-continue-outcome__results" aria-label="Results while you were away">
        {outcome.results.map((r, i) => <li key={i} className={r.you ? "is-you" : undefined}>
          <span>{r.you ? "🏆 You won" : r.champion ? `${r.champion} won` : "Completed"}</span> <b>{r.name}</b> <small>{circuitLabel(r.circuit)}</small>
        </li>)}
      </ul>}
    </div>
    <button type="button" onClick={onClose} aria-label="Dismiss">✕</button>
  </div>;
}

/**
 * While weeks are simulated (every event in the darts world is played, which can take a while on
 * a phone connection) a visible overlay says so, instead of a button that seems to do nothing.
 */
export function ContinueProgress({ saveId, from, toEvent }: { saveId: string; from: { season: number; week: number }; toEvent: NextEntry }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const t = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(t); }, []);
  // The week being played (same query as the Career header, so usually already cached): a live ticker of real events.
  const week = useCalendar(saveId, { scope: "WORLD", fromWeek: from.week, toWeek: from.week });
  const playing = (week.data?.events ?? []).filter(e => e.status !== "CANCELLED" && e.capability.executable)
    .sort((a, b) => b.presentation.calendarPriority - a.presentation.calendarPriority).slice(0, 12);
  const now = playing.length ? playing[Math.floor(seconds / 2) % playing.length] : null;
  return createPortal(<div className="career-continue-overlay" role="alertdialog" aria-live="polite" aria-label="Playing on">
    <div className="career-continue-overlay__card">
      <Loader2 className="career-continue-overlay__spin" aria-hidden />
      <strong>{toEvent ? `Playing on to ${toEvent.name}` : "Playing on"}</strong>
      <span>From {weekLabel(from.season, from.week)}{toEvent && toEvent.week !== from.week ? ` to week ${toEvent.week}` : ""}: every event in the darts world is being played.</span>
      {now && <p className="career-continue-overlay__ticker" key={now.id}><i>Now playing</i> <b>{now.name}</b> <em>{now.venue.city} · {circuitLabel(now.circuit)}</em></p>}
      <small>{seconds}s</small>
    </div>
  </div>, document.body);
}
