import { Info, Swords } from "lucide-react";
import { useEvent, useWithdrawEvent, errorMessage } from "../api";
import { ConfirmButton, Label, OSWALD, StatusBadge } from "../components";
import { useState } from "react";
import { MATCH_PLAY_STATUS } from "../model";

/**
 * HUMAN MATCH-PLAY BOUNDARY (A6 → integration checkpoint).
 *
 * The Career backend records a human match result only through the server-side
 * `recordHumanMatchResult` boundary (A3), which is deliberately NOT exposed over
 * HTTP so a client cannot self-report results. Launching TKDL's real GameScorer
 * against the A2 opponent and returning a server-verified result is the
 * integration-checkpoint work. Until then this UI:
 *   - shows the real pending match (opponent, round, best-of) from A3;
 *   - does NOT launch a scorer and does NOT fabricate or simulate a result;
 *   - offers the one legal backend action: withdraw (the match is conceded as a
 *     walkover by A3, with A4's refund policy applying).
 * While a human match is pending the Career calendar cannot advance (A3 rule).
 */

export function MatchBoundaryNotice({ saveId, eventId, compact }: { saveId: string; eventId: string; compact?: boolean }) {
  const event = useEvent(saveId, eventId);
  const withdraw = useWithdrawEvent(saveId);
  const [msg, setMsg] = useState<string | null>(null);
  const match = event.data?.human.nextMatch ?? null;
  const opponent = match ? (match.a?.key === "HUMAN" ? match.b : match.a) : null;
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.35)" }} role="region" aria-label="Your match">
      <div className="flex items-center gap-2 flex-wrap">
        <Swords className="w-4 h-4" style={{ color: "#ffd24a" }} aria-hidden />
        <Label color="#ffd24a">Your match</Label>
        {match && <StatusBadge label={`${match.roundName ? match.roundName.replace(/_/g, " ") : `Round ${match.round}`} · best of ${match.bestOf}`} tone="gold" />}
      </div>
      {match ? (
        <div className="font-black uppercase" style={{ ...OSWALD, color: "#fff", fontSize: compact ? "1rem" : "1.2rem" }}>You vs {opponent?.name ?? "TBC"}</div>
      ) : event.isLoading ? null : <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Match details unavailable.</div>}
      <div className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
        <span>{MATCH_PLAY_STATUS.reason} The Career calendar cannot move past a pending match, so it waits here.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="career-btn career-btn-gold" disabled aria-disabled title={MATCH_PLAY_STATUS.reason}><Swords className="w-4 h-4" aria-hidden /> Play match — not connected yet</button>
        {!compact && <ConfirmButton label="Withdraw (concede)" confirmLabel="Withdraw from event" danger busy={withdraw.isPending}
          description="Withdrawing concedes this match as a walkover and ends your event. Late withdrawals are not refunded (A4 policy)."
          onConfirm={() => withdraw.mutate(eventId, { onSuccess: r => setMsg(r.withdrawn ? "Withdrawn. The Career calendar can continue." : `Not withdrawn: ${r.denials.join(", ")}`), onError: e => setMsg(errorMessage(e)) })} />}
      </div>
      {msg && <p role="status" className="text-sm" style={{ color: "#fff" }}>{msg}</p>}
    </div>
  );
}
