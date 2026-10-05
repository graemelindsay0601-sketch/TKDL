import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Home, ListOrdered, Swords, Trophy } from "lucide-react";
import { GameScorer, BullUpBoard, type GameTypeOption } from "@/components/game-scorer";
import { resolveBullUp, type Dart, type X01Format } from "@/lib/darts-rules";
import { useWakeLock, useZoomLock } from "@/lib/nativeParity";
import { liveApi, errorMessage } from "../api";
import { OSWALD, Label, StatusBadge } from "../components";
import { adoptLiveCursor, careerGameType, careerBotVisit, recoveryFromLog, scorerLength, scoreLine, shouldCheckpoint } from "../live-model";
import type { ShellContext } from "../shell";
import type { LiveSession } from "../types";

/**
 * A6.5 Career live match. An integration layer around the EXISTING GameScorer (X01):
 *  - the server issues one session per match (opponent, format, A2 bot, bull-up);
 *  - the bull-up uses the shared BullUpBoard; every throw is recorded server-side;
 *  - GameScorer runs the match with the session's bot (seeded) and starts with the
 *    bull-up winner; after every visit the dart log is checkpointed to the server,
 *    which replays it with the shared rules — so refresh/route change resumes here;
 *  - the server derives the result and records it through A3. The browser never
 *    sends a winner.
 */
export function LiveMatchPage({ ctx, matchId }: { ctx: ShellContext; matchId: string }) {
  const saveId = ctx.save.id;
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"loading" | "bull" | "play" | "submitting" | "done" | "error">("loading");
  const [scorerKey, setScorerKey] = useState(0);
  const playing = phase === "play" || phase === "submitting";
  useWakeLock(playing);
  useZoomLock(playing);

  const cursorRef = useRef<{ revision: number; darts: Dart[] }>({ revision: 0, darts: [] });
  const epochRef = useRef(0);
  const adopt = useCallback((s: LiveSession) => {
    adoptLiveCursor(cursorRef.current, s);
    epochRef.current++;
    setSession(s);
    setPhase(s.status === "COMPLETED" ? "done" : s.status === "BULL_UP" ? "bull" : s.status === "IN_PLAY" ? "play" : "error");
    if (s.status === "SUPERSEDED") setError("This match is no longer waiting for you (it was withdrawn or already decided).");
  }, []);

  useEffect(() => {
    let cancelled = false;
    epochRef.current++;
    setPhase("loading");
    setError(null);
    liveApi.open(saveId, matchId).then(s => { if (!cancelled) adopt(s); }).catch(e => { if (!cancelled) { setError(errorMessage(e)); setPhase("error"); } });
    return () => { cancelled = true; };
  }, [saveId, matchId, adopt]);

  // ---------------------------------------------------------------- checkpoints (serialised)
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const checkpoint = useCallback((darts: Dart[]) => {
    const epoch = epochRef.current;
    queueRef.current = queueRef.current.then(async () => {
      if (epoch !== epochRef.current) return; // discard queued logs from a replaced/restored session
      try {
        const res = await liveApi.darts(saveId, matchId, { darts: darts.map(d => ({ segment: d.segment, multiplier: d.multiplier, value: d.value, label: d.label })), expectedRevision: cursorRef.current.revision });
        if (epoch !== epochRef.current) return;
        cursorRef.current.revision = res.revision;
        if (res.status === "COMPLETED") {
          setSession(res); setPhase("done");
          await client.invalidateQueries({ queryKey: ["career", saveId] });
          await client.invalidateQueries({ queryKey: ["career", "saves"] });
        }
      } catch (e) {
        if (epoch !== epochRef.current) return;
        // Out of step with the server (e.g. another tab): reload the authoritative log and remount the scorer on it.
        const fresh = await liveApi.read(saveId, matchId).catch(() => null);
        if (epoch !== epochRef.current) return;
        if (fresh) {
          setError(`${errorMessage(e)} — reloaded the match from the server.`);
          adopt(fresh); setScorerKey(k => k + 1);
        } else {
          setError(`${errorMessage(e)} — unable to restore this match. Reopen it from Career.`);
          setPhase("error");
        }
      }
    });
  }, [saveId, matchId, client, adopt]);

  const format = session?.format as X01Format | undefined;
  const onDartLog = useCallback((darts: Dart[]) => {
    cursorRef.current.darts = darts;
    if (!session || session.firstThrower === null || !format) return;
    if (shouldCheckpoint(format, session.firstThrower, darts)) checkpoint(darts);
  }, [session, format, checkpoint]);

  const botVisitPlanner = useCallback((ctx2: { remaining: number; opened: boolean }) =>
    careerBotVisit(session!, session!.firstThrower!, cursorRef.current.darts, ctx2), [session]);

  const initialRecovery = useMemo(() => session && session.firstThrower !== null && format
    ? recoveryFromLog(format, session.firstThrower, session.darts as Dart[]) : null, [session?.sessionId, session?.firstThrower, format, scorerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- render
  if (phase === "loading") return <Overlay><p role="status" style={{ ...OSWALD, color: "#fff", textAlign: "center" }}>Preparing your match…</p></Overlay>;
  if (phase === "error" || !session) return (
    <Overlay>
      <div className="pdc-card p-5 space-y-3" style={{ maxWidth: 420 }}>
        <Label color="#ff8fb4">Match unavailable</Label>
        <p className="text-sm" style={{ color: "#fff" }}>{error ?? "This match cannot be played right now."}</p>
        <Link href={`/career/${saveId}`} className="career-btn career-btn-ghost"><ArrowLeft className="w-4 h-4" aria-hidden /> Back to Career</Link>
      </div>
    </Overlay>
  );

  if (phase === "bull") {
    const state = resolveBullUp(session.bullUp.firstOrder, session.bullUp.throws);
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e", overflowY: "auto" }}>
        <BullUpBoard names={[session.player.name, session.opponent.name]} state={state} isHuman={idx => idx === 0} busy={busy} error={error}
          subtitle={state.rounds.length > 1 ? undefined : "Nearest the bull throws first"}
          onThrow={async (_, t) => {
            setBusy(true); setError(null);
            try { adopt(await liveApi.bull(saveId, matchId, { throw: t, expectedRevision: session.revision })); setPhase("bull"); }
            catch (e) { setError(errorMessage(e)); const fresh = await liveApi.read(saveId, matchId).catch(() => null); if (fresh) adopt(fresh); }
            finally { setBusy(false); }
          }}
          onContinue={() => setPhase("play")} />
        {session.firstThrower !== null && <span className="sr-only" role="status">{session.firstThrower === 0 ? "You throw first" : `${session.opponent.name} throws first`}</span>}
      </div>, document.body);
  }

  if (phase === "done" && session.result) return <PostMatch saveId={saveId} session={session} onNext={id => navigate(`/career/${saveId}/tournaments/${session.eventId}/matches/${id}`)} />;

  const gameType = careerGameType(session.format) as unknown as GameTypeOption;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e" }}>
      <GameScorer key={`${session.sessionId}:${scorerKey}`}
        p1Name={session.player.name} p2Name={session.opponent.name} gameType={gameType}
        botConfig={session.bot.config} firstThrower={session.firstThrower ?? 0}
        {...scorerLength(session.format)}
        initialRecovery={initialRecovery} onRecoveryState={() => { /* the server log is the recovery source */ }}
        botVisitPlanner={botVisitPlanner} onDartLog={onDartLog}
        onWin={() => setPhase(p => (p === "done" ? p : "submitting"))}
        onAbandon={() => navigate(`/career/${saveId}/tournaments/${session.eventId}`)} />
      {phase === "submitting" && (
        <div role="status" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,4,10,0.85)" }}>
          <p style={{ ...OSWALD, color: "#fff", letterSpacing: "0.08em" }}>Recording the result…</p>
        </div>
      )}
      {error && phase === "play" && (
        <div role="alert" style={{ position: "fixed", left: 12, right: 12, top: 12, zIndex: 10001, padding: "8px 12px", borderRadius: 10, background: "rgba(255,0,92,0.18)", border: "1px solid rgba(255,0,92,0.5)", color: "#fff", fontSize: 13 }}>
          {error} <button className="underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>, document.body);
}

function Overlay({ children }: { children: React.ReactNode }) {
  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(4,4,10,0.96)" }}>{children}</div>, document.body);
}

/** Concise Career result transition: opponent, score, win/loss, what happens next. No narrative (A7). */
function PostMatch({ saveId, session, onNext }: { saveId: string; session: LiveSession; onNext: (matchId: string) => void }) {
  const r = session.result!;
  const next = r.nextHumanMatchIds?.[0] ?? null;
  const nextState = next ? "Your next fixture is ready." : r.eventCompleted ? "The event is complete. View your tournament summary." : "Result saved. The Tournament Hub shows your group, bracket and next session; a group loss does not automatically eliminate you.";
  return (
    <Overlay>
      <div className="pdc-card career-hero p-5 space-y-4 w-full" style={{ maxWidth: 440 }} role="dialog" aria-label="Match result">
        <div className="flex items-center gap-2"><Swords className="w-4 h-4" style={{ color: "#ffd24a" }} aria-hidden /><Label color="#ffd24a">Match result</Label>
          <StatusBadge label={r.humanWon ? "Won" : "Lost"} tone={r.humanWon ? "success" : "danger"} /></div>
        <div className="font-black uppercase leading-tight" style={{ ...OSWALD, color: "#fff", fontSize: "1.4rem" }}>
          {session.player.name} {scoreLine(session)} {session.opponent.name}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt><Label>Your average</Label></dt><dd style={{ color: "#fff" }}>{r.facts?.human.average.toFixed(2)}</dd></div>
          <div><dt><Label>Opponent average</Label></dt><dd style={{ color: "#fff" }}>{r.facts?.opponent.average.toFixed(2)}</dd></div>
        </dl>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{nextState}</p>
        <div className="flex flex-wrap gap-2">
          {next && <button className="career-btn career-btn-gold" onClick={() => onNext(next)}><Swords className="w-4 h-4" aria-hidden /> Next match</button>}
          <Link href={`/career/${saveId}/tournaments/${session.eventId}`} className="career-btn career-btn-primary"><Trophy className="w-4 h-4" aria-hidden /> Tournament progress &amp; summary</Link>
          <Link href={`/career/${saveId}`} className="career-btn career-btn-ghost"><Home className="w-4 h-4" aria-hidden /> Career Home</Link>
          <Link href={`/career/${saveId}/calendar`} className="career-btn career-btn-ghost"><ListOrdered className="w-4 h-4" aria-hidden /> Calendar</Link>
        </div>
      </div>
    </Overlay>
  );
}
