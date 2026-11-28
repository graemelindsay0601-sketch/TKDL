// Board Curse part 2 (app side): Curse a Friend, the Weekly Curse League card and the Curse Hall.
import { useEffect, useState } from "react";
import { Crown, Flame, Ghost, Send, Shield, Skull, Swords, Trophy } from "lucide-react";
import { CURSE_RANKS, LEAGUE_POINTS, nextRank, rankFor } from "@/lib/darts-rules";
import "./curse-run.css";

export type CurseChallenge = { id: number; fromId: number; fromName: string; toId: number; toName: string; gameType: "X01" | "CRICKET"; seed: string;
  fromVisits: number; toVisits: number | null; toWon: boolean | null; message: string | null; played: boolean };
const gameName = (g: string) => g === "X01" ? "501" : g === "CRICKET" ? "Cricket" : g === "ATW" ? "Around the World" : "Halve-It";

/** Curses other players have put on you, to play from the Board Curse page. Needs a login. */
export function IncomingCurses({ loggedIn, onPlay }: { loggedIn: boolean; onPlay: (c: CurseChallenge) => void }) {
  const [data, setData] = useState<{ incoming: CurseChallenge[]; sent: CurseChallenge[]; done: CurseChallenge[] } | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/board-curse/challenges", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setData).catch(() => setData(null));
  }, [loggedIn]);
  if (!data || (!data.incoming.length && !data.sent.some(s => s.played))) return null;
  const results = data.sent.filter(s => s.played).slice(0, 3);
  return (
    <div className="cs-curses">
      {data.incoming.length > 0 && <div className="cs-title"><Ghost size={14} />Curses on you</div>}
      {data.incoming.map(c => (
        <div key={c.id} className="cs-curse">
          <div><strong>{c.fromName}</strong><small>{gameName(c.gameType)} · beat {c.fromVisits} visits{c.message ? ` · "${c.message}"` : ""}</small></div>
          <button className="cs-play" onClick={() => onPlay(c)}><Swords size={13} />Break it</button>
        </div>
      ))}
      {results.length > 0 && <div className="cs-title" style={{ marginTop: data.incoming.length ? 10 : 0 }}><Send size={13} />Your curses</div>}
      {results.map(c => (
        <div key={c.id} className={`cs-curse done ${c.toWon ? "lost" : "held"}`}>
          <div><strong>{c.toName}</strong><small>{c.toWon ? `Broke it: ${c.toVisits} visits to your ${c.fromVisits}` : c.toVisits ? `Held: they needed ${c.toVisits} to your ${c.fromVisits}` : "Held: they couldn't clear it"}</small></div>
          {c.toWon ? <Skull size={16} /> : <Shield size={16} />}
        </div>
      ))}
    </div>
  );
}

/** After a cleared solo leg: send the exact same cursed leg to someone to beat. */
export function SendCurse({ gameType, seed, visits, players }: { gameType: "X01" | "CRICKET"; seed: string; visits: number; players: { id: number; name: string }[] }) {
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");
  const send = async () => {
    setState("sending");
    try {
      const r = await fetch("/api/board-curse/challenges", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: Number(to), gameType, seed, visits, message: msg || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error("Log in to send curses");
      if (!r.ok) throw new Error(d?.error ?? "Couldn't send it");
      setState("sent");
    } catch (e) { setState({ error: (e as Error).message }); }
  };
  if (state === "sent") return <div className="cs-send sent"><Flame size={14} />Curse sent to {players.find(p => String(p.id) === to)?.name}. They'll get a notification.</div>;
  return (
    <div className="cs-send">
      <div className="cs-title"><Ghost size={14} />Curse a friend</div>
      <p>Send them this exact leg, same curses in the same order. They have to clear it in fewer than {visits} visits.</p>
      <select className="bc-select" value={to} onChange={e => setTo(e.target.value)}>
        <option value="" style={{ color: "#111" }}>Pick a player…</option>
        {players.map(p => <option key={p.id} value={p.id} style={{ color: "#111" }}>{p.name}</option>)}
      </select>
      <input className="bc-select" style={{ marginTop: 8 }} maxLength={80} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Add a message (optional)" />
      {typeof state === "object" && <div className="cs-err">{state.error}</div>}
      <button className="bc-btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={!to || state === "sending"} onClick={send}>{state === "sending" ? "Sending…" : "Send the curse"}</button>
    </div>
  );
}

type League = { endsAt: string; table: { playerId: number; name: string; points: number; place: number; rank: string }[]; me: { points: number; place: number | null; rank: string } | null };
const RANK_ICON: Record<string, string> = { apprentice: "🕯️", hexer: "🔮", warlock: "💀" };

/** Weekly Curse League: your rank this week and the top of the table. */
export function CurseLeagueCard({ playerId }: { playerId: number | null }) {
  const [d, setD] = useState<League | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch(`/api/board-curse/league${playerId ? `?playerId=${playerId}` : ""}`).then(r => r.ok ? r.json() : null).then(setD).catch(() => setD(null));
  }, [playerId]);
  if (!d) return null;
  const pts = d.me?.points ?? 0, r = rankFor(pts), nx = nextRank(pts);
  const pct = nx ? ((pts - r.min) / (nx.min - r.min)) * 100 : 100;
  const days = Math.max(0, Math.ceil((new Date(d.endsAt.replace(" ", "T") + "Z").getTime() - Date.now()) / 86400000));
  return (
    <div className={`cs-league r-${r.id}`}>
      <button className="cs-league-head" onClick={() => setOpen(o => !o)}>
        <span className="cs-rank-icon">{RANK_ICON[r.id]}</span>
        <div>
          <small>Weekly Curse League · {days <= 1 ? "ends tonight" : `${days} days left`}</small>
          <strong>{r.name}</strong>
          <div className="cx-bar"><i style={{ width: `${pct}%` }} /></div>
          <em>{pts} pts{nx ? ` · ${nx.min - pts} to ${nx.name}` : " · top rank"}{d.me?.place ? ` · ${d.me.place}${["th", "st", "nd", "rd"][d.me.place % 10 > 3 || [11, 12, 13].includes(d.me.place % 100) ? 0 : d.me.place % 10]} this week` : ""}</em>
        </div>
      </button>
      {open && (
        <div className="cs-league-body">
          <div className="cs-ranks">{CURSE_RANKS.map(x => <span key={x.id} className={x.id === r.id ? "on" : ""}>{RANK_ICON[x.id]} {x.name} {x.min}+{x.coins ? ` · ${x.coins}c` : ""}</span>)}</div>
          <p className="cs-how">Wins {LEAGUE_POINTS.win} · losses {LEAGUE_POINTS.loss} · Daily Curse clear {LEAGUE_POINTS.dailyClear} · Curse Run legs {LEAGUE_POINTS.runLeg} each · new Codex curses {LEAGUE_POINTS.codexCurse} · breaking a friend's curse {LEAGUE_POINTS.challengeWon}. Games count up to {LEAGUE_POINTS.dailyArcadeCap} a day. Top Warlock on Sunday night gets WARLOCK SUPREME.</p>
          {!d.table.length ? <div className="bc-empty">No one's cursed yet this week.</div> : d.table.slice(0, 10).map(t => (
            <div key={t.playerId} className={`bc-lb-row ${t.playerId === playerId ? "me" : ""}`}>
              <span className={`bc-lb-rank ${t.place === 1 ? "gold" : t.place === 2 ? "silver" : t.place === 3 ? "bronze" : ""}`}>{t.place}</span>
              <span className="bc-lb-name">{RANK_ICON[t.rank]} {t.name}</span>
              <span className="bc-lb-value">{t.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type HallRow = { playerId: number; name: string; value: number; extra: string | null };
type Hall = Record<"bestRuns" | "fewestX01" | "fewestCricket" | "fewestAtw" | "longestStreak" | "codexLeaders" | "codexComplete" | "hexWins" | "cursesBroken" | "warlocks", HallRow[]> & { codexTotal: number };

export function CurseHall({ onBack }: { onBack: () => void }) {
  const [h, setH] = useState<Hall | null>(null);
  useEffect(() => { fetch("/api/board-curse/hall").then(r => r.ok ? r.json() : null).then(setH).catch(() => setH(null)); }, []);
  const sections: { key: keyof Hall; title: string; fmt: (r: HallRow) => string; icon: typeof Crown }[] = [
    { key: "bestRuns", title: "Best Curse Runs", fmt: r => `${r.value.toLocaleString("en-GB")} · ${r.extra}L`, icon: Flame },
    { key: "fewestX01", title: "Fewest visits · 501", fmt: r => `${r.value} visits`, icon: Trophy },
    { key: "fewestCricket", title: "Fewest visits · Cricket", fmt: r => `${r.value} visits`, icon: Trophy },
    { key: "fewestAtw", title: "Fewest visits · Around the World", fmt: r => `${r.value} visits`, icon: Trophy },
    { key: "longestStreak", title: "Longest Endless streak", fmt: r => `${r.value} legs`, icon: Crown },
    { key: "codexLeaders", title: "Curse Codex", fmt: r => `${r.value}/${h?.codexTotal ?? "?"}`, icon: Ghost },
    { key: "codexComplete", title: "Codex completed (first to finish)", fmt: r => r.extra ?? "", icon: Crown },
    { key: "hexWins", title: "Hex Duel wins", fmt: r => `${r.value}`, icon: Swords },
    { key: "cursesBroken", title: "Friends' curses broken", fmt: r => `${r.value}`, icon: Shield },
    { key: "warlocks", title: "Warlock Supremes", fmt: r => `${r.extra} · ${r.value} pts`, icon: Skull },
  ];
  return (
    <div className="bc-shell cr-shell">
      <div className="cr-lobby-head">
        <div className="bc-kicker"><i />Board Curse</div>
        <h1><Crown />Curse <span>Hall</span></h1>
        <p>The records. Everything here is real games played in the app.</p>
      </div>
      {!h ? <div className="bc-empty">Loading…</div> : (
        <div className="cr-boards">
          {sections.map(s => {
            const list = h[s.key] as HallRow[];
            return (
              <div key={s.key} className="cr-board">
                <div className="bc-lb-title"><s.icon size={12} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />{s.title}</div>
                {!list.length ? <div className="bc-empty">Nobody yet.</div> : list.map((r, i) => (
                  <div key={`${s.key}-${i}`} className="bc-lb-row">
                    <span className={`bc-lb-rank ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</span>
                    <span className="bc-lb-name">{r.name}</span>
                    <span className="bc-lb-value">{s.fmt(r)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <button className="bc-btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onBack}>Back</button>
    </div>
  );
}
