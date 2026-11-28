// Curse Codex: every curse you've beaten (it hit you in a leg you won), with the unlocks for
// completing each board.
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Lock, Sparkles } from "lucide-react";
import { getCursePool, type CurseGameMode, type CurseTier } from "@/lib/board-curse-data";
import { CURSE_REWARDS } from "@/lib/darts-rules";
import "./curse-run.css";

const TIER_NAME: Record<CurseTier, string> = { 1: "Mild", 2: "Medium", 3: "Severe" };

export function CurseCodex({ playerId, onBack }: { playerId: number | null; onBack: () => void }) {
  const [mode, setMode] = useState<CurseGameMode>("X01");
  const [beaten, setBeaten] = useState<{ X01: string[]; CRICKET: string[] } | null>(null);
  useEffect(() => {
    if (!playerId) { setBeaten({ X01: [], CRICKET: [] }); return; }
    fetch(`/api/board-curse/codex/${playerId}`).then(r => r.ok ? r.json() : { X01: [], CRICKET: [] }).then(setBeaten).catch(() => setBeaten({ X01: [], CRICKET: [] }));
  }, [playerId]);
  const pools = useMemo(() => ({ X01: getCursePool("X01"), CRICKET: getCursePool("CRICKET") }), []);
  const samples = useMemo(() => Object.fromEntries([...pools.X01, ...pools.CRICKET].map(c => [`${c.gameMode}:${c.id}`, c.build().description])), [pools]);
  const got = (m: CurseGameMode) => new Set(beaten?.[m] ?? []);
  const count = (m: CurseGameMode) => pools[m].filter(c => got(m).has(c.id)).length;
  const total = pools.X01.length + pools.CRICKET.length, done = count("X01") + count("CRICKET");
  const rewardRows = [
    { r: CURSE_REWARDS[0], have: count("X01"), of: pools.X01.length },
    { r: CURSE_REWARDS[1], have: count("CRICKET"), of: pools.CRICKET.length },
    { r: CURSE_REWARDS[2], have: done, of: total },
  ];

  return (
    <div className="bc-shell cr-shell">
      <div className="cr-lobby-head">
        <div className="bc-kicker"><i />Board Curse</div>
        <h1><BookOpen />Curse <span>Codex</span></h1>
        <p>A curse goes in your Codex once it hits you in a leg you go on to win, in any Board Curse mode. Beat a whole board for an exclusive unlock.</p>
      </div>
      <div className="cx-total"><div><b>{done}</b> of {total} curses beaten</div><div className="cx-bar"><i style={{ width: `${(done / total) * 100}%` }} /></div></div>
      <div className="cx-rewards">
        {rewardRows.map(({ r, have, of }) => (
          <div key={r.id} className={`cx-reward ${have >= of ? "won" : ""}`}>
            <Sparkles size={14} />
            <div><strong>{r.name}</strong><small>{r.earnedBy}</small></div>
            <span>{have >= of ? "Unlocked" : `${have}/${of}`}</span>
          </div>
        ))}
      </div>
      <div className="bc-tabs tkdl-tab-rail tkdl-tab-rail--amber" style={{ margin: "18px 0 14px" }}>
        {(["X01", "CRICKET"] as CurseGameMode[]).map(m => (
          <button key={m} type="button" className={`bc-tab tkdl-tab-trigger ${mode === m ? "active" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "X01" ? "501" : "Cricket"} · {count(m)}/{pools[m].length}
          </button>
        ))}
      </div>
      {!beaten ? <div className="bc-empty">Loading…</div> : ([1, 2, 3] as CurseTier[]).map(t => (
        <div key={t} className={`cx-tier t${t}`}>
          <div className="cx-tier-head">{TIER_NAME[t]}</div>
          <div className="cx-grid">
            {pools[mode].filter(c => c.tier === t).map(c => {
              const ok = got(mode).has(c.id);
              return (
                <div key={c.id} className={`cx-curse ${ok ? "ok" : ""}`}>
                  <div className="cx-curse-name">{ok ? <Check size={13} /> : <Lock size={12} />}{c.name}</div>
                  <div className="cx-curse-desc">{samples[`${mode}:${c.id}`]}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button className="bc-btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onBack}>Back</button>
    </div>
  );
}
