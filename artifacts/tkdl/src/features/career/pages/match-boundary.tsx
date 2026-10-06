import { Info, Play, RotateCcw, Swords } from "lucide-react";
import { Link } from "wouter";
import { useEvent, useLiveSession, useWithdrawEvent, errorMessage } from "../api";
import { ConfirmButton, Label, OSWALD, StatusBadge } from "../components";
import { useState } from "react";
import { MATCH_PLAY_STATUS } from "../model";

/**
 * HUMAN MATCH-PLAY BOUNDARY (A6.5: connected).
 *
 * "Play match" opens the live Career session for this match and launches TKDL's
 * existing GameScorer (see pages/live-match.tsx). The server owns the session,
 * replays every dart with the shared rules, and records the result through A3's
 * `recordHumanMatchResult` — the client never reports a winner. If a session is
 * already in progress the action is "Resume match". Formats the live scorer cannot
 * play show the honest reason instead. Withdraw remains the other legal action.
 */

export function MatchBoundaryNotice({ saveId, eventId, compact }: { saveId: string; eventId: string; compact?: boolean }) {
  const event = useEvent(saveId, eventId);
  const withdraw = useWithdrawEvent(saveId);
  const [msg, setMsg] = useState<string | null>(null);
  const match = event.data?.human.nextMatch ?? null;
  const opponent = match ? (match.a?.key === "HUMAN" ? match.b : match.a) : null;
  const playable = !!event.data?.event.capability.executable && match?.status === "AWAITING_HUMAN";
  const live = useLiveSession(saveId, playable ? match?.id : null);
  const resumable = !!live.data && (live.data.status === "BULL_UP" || live.data.status === "IN_PLAY");
  const reason = playable ? MATCH_PLAY_STATUS.reason : MATCH_PLAY_STATUS.unsupportedReason;
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
        <span>{reason} The Career calendar cannot move past a pending match, so it waits here.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {playable && match ? (
          <Link href={`/career/${saveId}/tournaments/${eventId}/matches/${match.id}`} className="career-btn career-btn-gold">
            {resumable ? <RotateCcw className="w-4 h-4" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />} {resumable ? "Resume match" : "Play match"}
          </Link>
        ) : match && <button className="career-btn career-btn-gold" disabled aria-disabled title={reason}><Swords className="w-4 h-4" aria-hidden /> Intentionally benched</button>}
        {!compact && <ConfirmButton label="Withdraw (concede)" confirmLabel="Withdraw from event" danger busy={withdraw.isPending}
          description="Withdrawing concedes this match as a walkover and ends your event. Late withdrawals are not refunded (A4 policy)."
          onConfirm={() => withdraw.mutate(eventId, { onSuccess: r => setMsg(r.withdrawn ? "Withdrawn. The Career calendar can continue." : `Not withdrawn: ${r.denials.join(", ")}`), onError: e => setMsg(errorMessage(e)) })} />}
      </div>
      {msg && <p role="status" className="text-sm" style={{ color: "#fff" }}>{msg}</p>}
    </div>
  );
}
