// Curse Run: solo 501 legs back to back. Clear a leg inside its visit limit, then take a Blessing
// or a Dark Pact. Rules in lib/curse-run.ts; each leg is a fresh BoardCurseScorer.
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Crown, Flame, Shuffle, Skull, Sparkles, Trophy } from "lucide-react";
import { BoardCurseScorer, type BoardCurseResult } from "@/components/BoardCurseScorer";
import { legScore, multiplierOf, newRun, runChoices, runEffects, runRules, runVisitLimit, takeChoice, blessingById, PACT_BONUS, type RunChoice, type RunState } from "@/lib/curse-run";
import "./curse-run.css";

type Board = { date: string; daily: Entry[]; allTime: Entry[]; myBest: number | null; dailyDone: boolean };
type Entry = { playerName: string; playerId: number; score: number; legs: number };
type Reward = { id: string; name: string; category: string };
type Screen =
  | { kind: "lobby" }
  | { kind: "leg" }
  | { kind: "choose"; gained: number; visits: number; limit: number }
  | { kind: "over"; reason: "cursed" | "stopped" };

export function logCodex(playerId: number | null, gameType: "X01" | "CRICKET", ids: string[]): Promise<{ fresh: string[]; rewards: Reward[] } | null> {
  if (!playerId || !ids.length) return Promise.resolve(null);
  return fetch("/api/board-curse/codex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, gameType, curseIds: ids }) })
    .then(r => r.ok ? r.json() : null).catch(() => null);
}

export function CurseRun({ playerId, playerName, onExit }: { playerId: number | null; playerName: string; onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "lobby" });
  const [board, setBoard] = useState<Board | null>(null);
  const [run, setRun] = useState<RunState>(newRun());
  const [seed, setSeed] = useState("");
  const [daily, setDaily] = useState(false);
  const [legKey, setLegKey] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [maxPactsCleared, setMaxPactsCleared] = useState(0);
  const [freshCurses, setFreshCurses] = useState<string[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [outcome, setOutcome] = useState<{ counted?: boolean; personalBest?: boolean; record?: boolean } | null>(null);

  const loadBoard = () => fetch(`/api/board-curse/run/leaderboard${playerId ? `?playerId=${playerId}` : ""}`).then(r => r.ok ? r.json() : null).then(setBoard).catch(() => setBoard(null));
  useEffect(() => { void loadBoard(); }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (isDaily: boolean) => {
    const date = new Date().toISOString().slice(0, 10);
    setSeed(isDaily ? `run:${date}` : `run:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
    setDaily(isDaily); setRun(newRun()); setPicks([]); setMaxPactsCleared(0); setFreshCurses([]); setRewards([]); setSave("idle"); setOutcome(null);
    setLegKey(k => k + 1); setScreen({ kind: "leg" });
  };

  const finish = async (reason: "cursed" | "stopped", s: RunState) => {
    setScreen({ kind: "over", reason });
    if (!playerId || (s.leg === 1 && !daily)) return; // nothing to save from an empty free run
    setSave("saving");
    try {
      const r = await fetch("/api/board-curse/run", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, daily, legs: s.leg - 1, score: s.score, pacts: s.pacts.length, maxPactsCleared, picks }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error();
      setOutcome(d); setRewards(x => [...x, ...(d.rewards ?? [])]); setSave("saved"); void loadBoard();
    } catch { setSave("error"); }
  };

  const limit = runVisitLimit(run);
  const onLeg = async (result: BoardCurseResult) => {
    if (result.endedByVisitLimit) {
      if (run.blessings.includes("insurance") && !run.insuranceUsed) {
        setRun({ ...run, insuranceUsed: true }); setLegKey(k => k + 1); return; // one more go at the same leg
      }
      await finish("cursed", run); return;
    }
    const gained = legScore(result.visitsTaken, limit, multiplierOf(run));
    const next = { ...run, score: run.score + gained, leg: run.leg + 1 };
    setRun(next);
    setMaxPactsCleared(m => Math.max(m, run.pacts.length));
    const c = await logCodex(playerId, "X01", result.cursesFaced);
    if (c) { setFreshCurses(f => [...f, ...c.fresh]); setRewards(x => [...x, ...c.rewards]); }
    setScreen({ kind: "choose", gained, visits: result.visitsTaken, limit });
  };

  const choose = (c: RunChoice) => {
    setPicks(p => [...p, c.kind === "pact" ? `pact:${c.pact.id}` : c.blessing.id]);
    setRun(takeChoice(run, c)); setLegKey(k => k + 1); setScreen({ kind: "leg" });
  };

  const choices = useMemo(() => screen.kind === "choose" ? runChoices(seed, { ...run, leg: run.leg - 1 }) : [], [screen.kind, seed, run]);
  const rules = runRules(run);

  if (screen.kind === "leg") {
    const banner = (
      <div className="cr-hud">
        <div className="cr-hud-top">
          <span><Flame size={14} />{daily ? "Daily Run" : "Curse Run"} · Leg {run.leg}</span>
          <b>{run.score.toLocaleString("en-GB")}</b>
        </div>
        <div className="cr-hud-row">
          <span className="cr-chip mult">×{multiplierOf(run)}</span>
          <span className="cr-chip">{limit} visits</span>
          {run.pacts.map((p, i) => <span key={`p${i}`} className="cr-chip pact">{p.name}</span>)}
          {[...new Set([...run.blessings, ...run.legBlessings])].map(id => <span key={id} className="cr-chip bless">{blessingById(id)?.name}</span>)}
        </div>
      </div>
    );
    return (
      <BoardCurseScorer key={legKey} gameMode="X01" format="solo" p1Name={playerName || "You"} p2Name="The Board" legs={1}
        topBanner={banner} visitLimit={limit} challengeSeed={`${seed}:leg${run.leg}:${run.insuranceUsed ? "b" : "a"}`}
        extraEffects={runEffects(run)} maxTier={rules.maxTier} strikeEvery={rules.strikeEvery} wards={rules.wards} autoWardFirst={rules.autoWardFirst}
        onMatchComplete={onLeg} onAbandon={() => finish("stopped", run)} />
    );
  }

  if (screen.kind === "choose") {
    return (
      <div className="bc-shell cr-shell">
        <div className="cr-cleared">
          <small>Leg {run.leg - 1} cleared · {screen.visits} of {screen.limit} visits</small>
          <h1>+{screen.gained.toLocaleString("en-GB")}</h1>
          <p>Run total {run.score.toLocaleString("en-GB")} · ×{multiplierOf(run)}</p>
          {freshCurses.length > 0 && <div className="cr-codex-note"><Sparkles size={13} />{freshCurses.length} new in your Curse Codex</div>}
        </div>
        <div className="cr-pick-title">Choose one for leg {run.leg}</div>
        <div className="cr-cards">
          {choices.map((c, i) => c.kind === "blessing" ? (
            <button key={i} className="cr-card bless" onClick={() => choose(c)}>
              <span className="cr-card-kind">Blessing · {c.blessing.lasts === "run" ? "rest of run" : "next leg"}</span>
              <strong>{c.blessing.name}</strong>
              <p>{c.blessing.description}</p>
            </button>
          ) : (
            <button key={i} className="cr-card pact" onClick={() => choose(c)}>
              <span className="cr-card-kind">Dark Pact · +{PACT_BONUS}× score</span>
              <strong>{c.pact.name}</strong>
              <p>{c.pact.description} Lasts the rest of the run.</p>
            </button>
          ))}
        </div>
        <button className="bc-btn-ghost cr-bank" onClick={() => finish("stopped", run)}>Bank {run.score.toLocaleString("en-GB")} and stop</button>
      </div>
    );
  }

  if (screen.kind === "over") {
    const legs = run.leg - 1;
    return (
      <div className="bc-shell cr-shell">
        <div className="bc-result" style={{ "--glow": screen.reason === "cursed" ? "#ff1744" : "#ffd24a" } as React.CSSProperties}>
          <div className="bc-result-glow" />
          <div className="bc-result-icon">{screen.reason === "cursed" ? <Skull /> : <Trophy />}</div>
          <h1>{run.score.toLocaleString("en-GB")}</h1>
          <p>{screen.reason === "cursed" ? `The board beat you on leg ${run.leg}.` : "Run banked."} {legs} leg{legs === 1 ? "" : "s"} cleared · ×{multiplierOf(run)} · {run.pacts.length} Dark Pact{run.pacts.length === 1 ? "" : "s"}</p>
          {outcome?.record ? <div className="cr-flag gold"><Crown size={13} />New all-time Curse Run record</div>
            : outcome?.personalBest ? <div className="cr-flag"><Trophy size={13} />New personal best</div> : null}
          {daily && outcome && <div className="cr-flag dim">{outcome.counted ? "Counted for today's Daily Run" : "Practice go: only your first Daily Run each day counts"}</div>}
          {rewards.length > 0 && <div className="cr-rewards">{rewards.map(r => <div key={r.id}><Sparkles size={13} />Unlocked: <b>{r.name}</b></div>)}</div>}
          <div className={`bc-save-state ${save}`}>{save === "saving" ? "Saving run…" : save === "saved" ? "Run saved" : save === "error" ? "Run shown, but it could not be saved" : !playerId ? "Pick your name to save runs" : run.leg === 1 && !daily ? "No legs cleared, nothing saved" : "Arcade run"}</div>
          <div className="bc-result-actions">
            <button className="bc-btn-ghost" onClick={() => setScreen({ kind: "lobby" })}>Curse Run home</button>
            <button className="bc-btn-primary" onClick={() => start(false)}>New run</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bc-shell cr-shell">
      <div className="cr-lobby-head">
        <div className="bc-kicker"><i />Board Curse · Run mode</div>
        <h1><Flame />Curse <span>Run</span></h1>
        <p>501 legs, one after another, each inside a visit limit that keeps tightening. Clear a leg and choose: a Blessing to help you, or a Dark Pact, an extra curse for the rest of the run that adds +{PACT_BONUS}× to your score. Fail a leg and the run is over.</p>
      </div>
      <div className="cr-modes">
        <button className="cr-mode daily" onClick={() => start(true)}>
          <CalendarDays size={20} />
          <div><strong>Daily Run</strong><small>{board?.dailyDone ? "You've had today's counted go. Play again for practice." : "Same curses and choices for everyone today. Your first go counts."}</small></div>
        </button>
        <button className="cr-mode" onClick={() => start(false)}>
          <Shuffle size={20} />
          <div><strong>Free Run</strong><small>A fresh random run. Counts for the all-time board.</small></div>
        </button>
      </div>
      {board?.myBest ? <div className="bc-note">Your best run: {board.myBest.toLocaleString("en-GB")}</div> : null}
      <div className="cr-boards">
        {([["Today's Daily Run", board?.daily], ["All-time", board?.allTime]] as const).map(([title, list]) => (
          <div key={title} className="cr-board">
            <div className="bc-lb-title">{title}</div>
            {!board ? <div className="bc-empty">Loading…</div> : !list?.length ? <div className="bc-empty">No runs yet.</div> : list.map((e, i) => (
              <div key={`${title}-${i}`} className={`bc-lb-row ${e.playerId === playerId ? "me" : ""}`}>
                <span className={`bc-lb-rank ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</span>
                <span className="bc-lb-name">{e.playerName}</span>
                <span className="bc-lb-value">{e.score.toLocaleString("en-GB")} · {e.legs}L</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button className="bc-btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onExit}>Back to Board Curse</button>
    </div>
  );
}
