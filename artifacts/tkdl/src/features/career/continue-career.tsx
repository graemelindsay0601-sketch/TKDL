import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAdvance, useActiveTournament, useTournamentAction, errorMessage } from "./api";
import { advanceStopLabel, weekLabel } from "./model";
import type { AdvanceResult, CareerSave } from "./types";

export type NextEntry = { name: string; week: number } | null;
export type ContinueOutcome = { tone: "info" | "error"; headline: string; detail: string };

/**
 * The one "move time forward" action, shared by the header button and Home's next-move panel.
 * With an event booked it plays on to that event's first match (and opens it); otherwise it stops
 * at the next notable date. A finished tournament is filed away first; it never blocks the server.
 */
export function useContinueCareer(save: CareerSave, nextEntry: NextEntry) {
  const advance = useAdvance(save.id);
  const tournament = useActiveTournament(save.id);
  const finished = tournament.data?.tournaments.filter(t => t.terminal) ?? [];
  const dismiss = useTournamentAction(save.id, finished[0]?.eventId ?? "");
  const [, navigate] = useLocation();
  const [outcome, setOutcome] = useState<ContinueOutcome | null>(null);

  const run = async () => {
    setOutcome(null);
    if (finished.length) await dismiss.mutateAsync({ action: "dismiss" }).catch(() => undefined);
    advance.mutate({ season: save.currentSeason, week: save.currentWeek, target: { kind: nextEntry ? "NEXT_MATCH" : "NEXT_MEANINGFUL" } }, {
      onSuccess: r => {
        const matchId = r.stop.reason === "HUMAN_MATCH_PENDING" ? (r.stop.detail as { matchIds?: string[] } | undefined)?.matchIds?.[0] : undefined;
        if (matchId) navigate(`/career/${save.id}/matches/${matchId}/play`);
        else setOutcome(describe(r));
      },
      onError: e => setOutcome({ tone: "error", headline: "Couldn't continue", detail: errorMessage(e) }),
    });
  };
  return { run, pending: advance.isPending || dismiss.isPending, outcome, clear: () => setOutcome(null),
    blocked: tournament.isLoading || !!tournament.error, from: { season: save.currentSeason, week: save.currentWeek } };
}

function describe(r: AdvanceResult): ContinueOutcome {
  const weeks = r.weeksPlayed === 1 ? "1 week played" : `${r.weeksPlayed} weeks played`;
  const next = r.stop.reason === "TARGET_REACHED" || r.stop.reason === "MEANINGFUL_DATE" ? " Pick an event to enter, or continue again." : "";
  return { tone: "info", headline: `Now ${weekLabel(r.to.season, r.to.week)}`, detail: `${advanceStopLabel(r.stop.reason)} · ${weeks}.${next}` };
}

/** Clear result of a continue: where the Career now is and why it stopped. */
export function ContinueOutcomeCard({ outcome, onClose }: { outcome: ContinueOutcome; onClose: () => void }) {
  return <div role="status" className={`career-continue-outcome career-continue-outcome--${outcome.tone}`}>
    <div><strong>{outcome.headline}</strong><span>{outcome.detail}</span></div>
    <button type="button" onClick={onClose} aria-label="Dismiss">✕</button>
  </div>;
}

/**
 * While weeks are simulated (every event in the darts world is played, which can take a while on
 * a phone connection) a visible overlay says so, instead of a button that seems to do nothing.
 */
export function ContinueProgress({ from, toEvent }: { from: { season: number; week: number }; toEvent: NextEntry }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const t = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(t); }, []);
  return createPortal(<div className="career-continue-overlay" role="alertdialog" aria-live="polite" aria-label="Playing on">
    <div className="career-continue-overlay__card">
      <Loader2 className="career-continue-overlay__spin" aria-hidden />
      <strong>{toEvent ? `Playing on to ${toEvent.name}` : "Playing on"}</strong>
      <span>From {weekLabel(from.season, from.week)}{toEvent && toEvent.week !== from.week ? ` to week ${toEvent.week}` : ""}: every event in the darts world is being played.</span>
      <small>{seconds}s</small>
    </div>
  </div>, document.body);
}
