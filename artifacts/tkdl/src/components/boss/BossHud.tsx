// In-fight boss banner (sits above the scorer pad) and the entrance scene.
import { useEffect, useState } from "react";
import { Zap, ZapOff, ShieldOff } from "lucide-react";
import { BossPortrait } from "./BossPortrait";
import { worldOf, type Boss, type BossMove } from "@/lib/boss-battles-data";
import "./boss.css";

export type CurseState = "on" | "stunned" | "broken" | "none";

export function BossHud({ boss, health, phase, move, curse, bubble, mood, possessedBy }: {
  boss: Boss; health: number; phase: 1 | 2 | 3; move: BossMove; curse: CurseState;
  bubble: { text: string; key: number } | null; mood: "idle" | "hurt" | "angry" | "talk";
  possessedBy?: string;
}) {
  const w = worldOf(boss.world);
  const pct = Math.round(health * 100);
  const [lag, setLag] = useState(health);
  useEffect(() => { const t = setTimeout(() => setLag(health), 450); return () => clearTimeout(t); }, [health]);
  return (
    <div className={`bh phase-${phase}`} style={{ ["--bw" as string]: w.colour, ["--bg2" as string]: w.glow }}>
      <div className="bh-port"><BossPortrait spec={boss.portrait} size={54} mood={phase === 3 && mood === "idle" ? "angry" : mood} id={`hud-${boss.id}`} /></div>
      <div className="bh-main">
        <div className="bh-top">
          <span className="bh-name">{possessedBy ? "👻 " : ""}{boss.name}</span>
          <span className="bh-phase">{[1, 2, 3].map(n => <i key={n} className={n <= phase ? "on" : ""} />)}{phase === 3 ? "ENRAGED" : `PHASE ${phase}`}</span>
        </div>
        <div className="bh-bar" aria-label={`Boss health ${pct}%`}>
          <div className="bh-lag" style={{ width: `${Math.max(lag, health) * 100}%` }} />
          <div className="bh-fill" style={{ width: `${health * 100}%` }} />
          <span className="bh-cut" style={{ left: "33.3%" }} /><span className="bh-cut" style={{ left: "66.6%" }} />
          <b className="bh-pct">{pct}%</b>
        </div>
        <div className={`bh-move ${curse}`}>
          {curse === "broken" ? <ShieldOff size={12} /> : curse === "stunned" ? <ZapOff size={12} /> : <Zap size={12} />}
          <span className="bh-mn">{move.name}</span>
          <span className="bh-ms">{curse === "broken" ? "broken by your 180" : curse === "stunned" ? "stunned for this visit" : move.description}</span>
        </div>
      </div>
      {bubble && <div key={bubble.key} className="bh-bubble">{bubble.text}</div>}
    </div>
  );
}

/** Full-screen entrance before a fight: the boss slams in with a line. Tap to skip. */
export function BossEntrance({ boss, line, onDone, possessedBy }: { boss: Boss; line: string; onDone: () => void; possessedBy?: string }) {
  const w = worldOf(boss.world);
  useEffect(() => { const t = setTimeout(onDone, 3400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="be" style={{ ["--bw" as string]: w.colour, ["--bg2" as string]: w.glow }} onClick={onDone} role="dialog" aria-label={`${boss.name} enters`}>
      <div className="be-rays" />
      <div className="be-port"><BossPortrait spec={boss.portrait} size={190} mood="talk" id={`ent-${boss.id}`} /></div>
      <div className="be-kicker">{w.name} · Boss {boss.order} of 20</div>
      <h1 className="be-name">{boss.name}</h1>
      {possessedBy && <div className="be-poss">👻 Possessed by Shadow {possessedBy}</div>}
      <p className="be-line">"{line}"</p>
      <span className="be-skip">Tap to fight</span>
    </div>
  );
}

/** Banner when the boss changes phase. */
export function PhaseBanner({ boss, phase, move, line }: { boss: Boss; phase: 2 | 3; move: BossMove; line: string }) {
  return (
    <div className={`bpb p${phase}`}>
      <div className="bpb-k">{phase === 3 ? `${boss.name} is enraged` : `${boss.name} changes tactics`}</div>
      <div className="bpb-line">"{line}"</div>
      <div className="bpb-move"><Zap size={13} /> {move.name}: <span>{move.description}</span></div>
    </div>
  );
}
