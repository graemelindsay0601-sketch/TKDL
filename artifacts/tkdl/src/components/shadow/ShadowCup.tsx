// The weekly Shadow Cup on the Shadow Bot page: the bracket (rounds revealed
// through the week, final on Friday), a dart-by-dart replay of any revealed
// match, and the Shadow Slayer table.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Trophy, Play, X, FastForward, Ghost, Swords } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import "./shadow-cup.css";

type Side = { id: number; name: string; avg: number } | null;
type CupView = {
  week: string; championId: number | null;
  rounds: { round: number; name: string; revealAt: string; revealed: boolean;
    matches: { id: number; slot: number; p1: Side; p2: Side; bye: boolean; winnerId: number | null; score: string | null; avgs: [number, number] | null }[] }[];
};
type CupDart = { seg: number; mult: number; val: number };
type CupVisit = { p: 0 | 1; darts: CupDart[]; score: number; left: number; bust?: boolean; checkout?: boolean };
type MatchView = { id: number; round: number; p1: { id: number; name: string }; p2: { id: number; name: string };
  result: { legs: { starter: 0 | 1; visits: CupVisit[]; winner: 0 | 1 }[]; score: [number, number]; winner: 0 | 1; avgs: [number, number]; best: [number, number]; checkouts: [number, number] } };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit" });
const label = (d: CupDart) => d.val === 0 ? "Miss" : d.seg === 25 ? (d.mult === 2 ? "Bull" : "25") : `${d.mult === 3 ? "T" : d.mult === 2 ? "D" : ""}${d.seg}`;

function call(name: string, v: CupVisit): string | null {
  if (v.checkout) return v.score >= 100 ? `${name} takes out ${v.score}!` : `${name} checks out ${v.score}.`;
  if (v.bust) return `${name} busts.`;
  if (v.score === 180) return `ONE HUNDRED AND EIGHTY! ${name}.`;
  if (v.score >= 140) return `${name} hits ${v.score}.`;
  if (v.score >= 100) return `Ton-plus for ${name}: ${v.score}.`;
  return null;
}

function Replay({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useFetch<MatchView>(`/api/shadow-cup/matches/${id}`);
  const steps = useMemo(() => {
    if (!data) return [];
    const out: { leg: number; v: CupVisit; legs: [number, number] }[] = [];
    const won: [number, number] = [0, 0];
    data.result.legs.forEach((leg, i) => {
      for (const v of leg.visits) out.push({ leg: i, v, legs: [...won] as [number, number] });
      won[leg.winner]++;
      out[out.length - 1].legs = [...won] as [number, number];
    });
    return out;
  }, [data]);
  const [i, setI] = useState(0);
  const [fast, setFast] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!steps.length || i >= steps.length - 1) return;
    timer.current = window.setTimeout(() => setI(n => n + 1), fast ? 220 : steps[i].v.score >= 100 || steps[i].v.checkout ? 1700 : 950);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, steps, fast]);
  if (!data) return <div className="sc-overlay"><div className="sc-replay"><p className="sc-dim">Loading the match…</p></div></div>;
  const names = [`Shadow ${data.p1.name}`, `Shadow ${data.p2.name}`];
  const s = steps[i];
  // Score left for each player as of this visit, in this leg.
  const left: [number, number] = [501, 501];
  for (const st of steps.slice(0, i + 1)) if (st.leg === s.leg) left[st.v.p] = st.v.left;
  const done = i >= steps.length - 1;
  const line = done ? `${names[data.result.winner]} wins ${Math.max(...data.result.score)}-${Math.min(...data.result.score)}.` : call(names[s.v.p], s.v);
  return (
    <div className="sc-overlay" role="dialog" aria-label="Shadow Cup replay">
      <div className="sc-replay">
        <div className="sc-top"><span className="sc-tag"><Ghost size={12} /> Shadow Cup · replay</span><button className="sc-x" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="sc-board">
          {[0, 1].map(p => (
            <div key={p} className={`sc-side${s.v.p === p && !done ? " on" : ""}${done && data.result.winner === p ? " won" : ""}`}>
              <span className="sc-n">{names[p]}</span>
              <b className="sc-left">{left[p]}</b>
              <span className="sc-legs">{done ? data.result.score[p] : s.legs[p]} legs</span>
            </div>
          ))}
        </div>
        <div className="sc-visit">
          <span className="sc-who">{names[s.v.p]}</span>
          <span className="sc-darts">{s.v.darts.map((d, k) => <i key={k} className={d.mult === 3 ? "t" : d.mult === 2 ? "d" : ""}>{label(d)}</i>)}</span>
          <b className={`sc-score${s.v.score >= 100 ? " big" : ""}${s.v.bust ? " bust" : ""}`}>{s.v.bust ? "BUST" : s.v.score}</b>
        </div>
        <p className={`sc-call${line ? "" : " quiet"}`}>{line ?? " "}</p>
        <div className="sc-foot">
          <span className="sc-dim">Leg {s.leg + 1}</span>
          {!done && <button className="sc-btn" onClick={() => setFast(f => !f)}><FastForward size={14} /> {fast ? "Normal speed" : "Faster"}</button>}
          {!done && <button className="sc-btn" onClick={() => setI(steps.length - 1)}>Skip to result</button>}
          {done && <span className="sc-dim">Averages {data.result.avgs[0]} · {data.result.avgs[1]}</span>}
        </div>
      </div>
    </div>
  );
}

export function ShadowCup() {
  const { data } = useFetch<CupView | null>("/api/shadow-cup");
  const { data: slayers } = useFetch<{ playerId: number; name: string; wins: number; played: number; shadowsBeaten: number }[]>("/api/shadow-bot/slayers");
  const [watch, setWatch] = useState<number | null>(null);
  // Open on the round people care about: the latest one played, or the first one if nothing's out yet.
  const latest = data ? Math.max(1, ...data.rounds.filter(r => r.revealed).map(r => r.round)) : 1;
  const [pick, setPick] = useState<number | null>(null);
  const shown = data?.rounds.find(r => r.round === (pick ?? latest));
  const champion = data?.championId != null ? data.rounds[data.rounds.length - 1].matches[0] : null;
  const champName = champion ? (champion.winnerId === champion.p1?.id ? champion.p1?.name : champion.p2?.name) : null;
  return (
    <div className="space-y-4">
      <div className="sc-card">
        <div className="sc-top"><span className="sc-tag"><Trophy size={12} /> The Shadow Cup</span><span className="sc-dim">{data ? `Week of ${new Date(`${data.week}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span></div>
        <p className="sc-sub">Every unlocked shadow, one knockout a week, played dart by dart. Rounds are revealed through the week, the final on Friday. The winner's owner gets the Shadow Cup Champion tag.</p>
        {!data && <p className="sc-dim">The first cup starts on Monday once there are 4 or more unlocked shadows.</p>}
        {champName && <div className="sc-champ"><Trophy size={16} /> Shadow {champName} is this week's champion</div>}
        {data && (
          <div className="sc-tabs">
            {data.rounds.map(r => (
              <button key={r.round} className={`sc-tab${r.round === shown?.round ? " on" : ""}${r.revealed ? "" : " later"}`} onClick={() => setPick(r.round)}>
                {r.name.replace("Round of ", "Last ").replace("Quarter-finals", "QF").replace("Semi-finals", "SF")}
              </button>
            ))}
          </div>
        )}
        {shown && (
          <div className="sc-round">
            <div className="sc-rhead"><b>{shown.name}</b><span className="sc-dim">{shown.revealed ? "Played" : `Revealed ${when(shown.revealAt)}`}</span></div>
            {shown.matches.map(m => (
              <div key={m.id} className="sc-match">
                {[m.p1, m.p2].map((s, k) => (
                  <div key={k} className={`sc-row${m.winnerId != null && s && m.winnerId === s.id ? " w" : ""}${m.winnerId != null && s && m.winnerId !== s.id ? " l" : ""}`}>
                    {s ? <Link href={`/shadow-bot/${s.id}`} className="sc-nm">Shadow {s.name}</Link> : <span className="sc-nm sc-dim">{m.bye ? "Bye" : "To be decided"}</span>}
                    <span className="sc-avg">{m.avgs ? `${m.avgs[k]} avg` : ""}</span>
                    <b className="sc-sc">{m.score ? m.score.split("-")[k] : ""}</b>
                  </div>
                ))}
                {shown.revealed && m.score && <button className="sc-watch" onClick={() => setWatch(m.id)}><Play size={12} /> Watch it dart by dart</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {!!slayers?.length && (
        <div className="sc-card">
          <div className="sc-top"><span className="sc-tag"><Swords size={12} /> Shadow Slayers</span><span className="sc-dim">Wins against other players' shadows</span></div>
          {slayers.slice(0, 8).map((r, i) => (
            <Link key={r.playerId} href={`/players/${r.playerId}`} className="sc-slay">
              <span className="sc-rk">{i + 1}</span><span className="sc-nm">{r.name}</span>
              <span className="sc-dim">{r.shadowsBeaten} shadow{r.shadowsBeaten === 1 ? "" : "s"} beaten</span>
              <b>{r.wins}<small>/{r.played}</small></b>
            </Link>
          ))}
        </div>
      )}
      {watch != null && <Replay id={watch} onClose={() => setWatch(null)} />}
    </div>
  );
}
