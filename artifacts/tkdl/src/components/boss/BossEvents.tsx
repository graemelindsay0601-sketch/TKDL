// Boss Battle events panel: the Daily and Weekly Boss (same for everyone, with a twist and a
// fastest-kill board), the monthly League Raid, and Be the Boss.
import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, Swords, Crown, Send, Timer, Users } from "lucide-react";
import { BossPortrait } from "./BossPortrait";
import { getBossById, customBoss, BOSSES, moveForPhase, type Boss } from "@/lib/boss-battles-data";
import type { TwistId } from "@/lib/darts-rules";
import "./boss.css";

type Board = { playerId: number; name: string; best: number | null; tries: number; won: boolean };
type Ev = { kind: "daily" | "weekly"; period: string; bossId: string; twist: TwistId; twistInfo: { name: string; description: string };
  board: Board[]; fighters: number; mine: Board | null; endsAt: string };
type Raid = { month: string; boss: { name: string; title: string; lore: string; portrait: Boss["portrait"] }; hp: number; damage: number; health: number;
  killed: boolean; contributors: number; top: { playerId: number; name: string; damage: number }[]; mine: { damage: number; rank: number } | null; endsAt: string };
type Custom = { id: number; fromId: number; fromName: string; toId: number; toName: string; curses: string[]; message: string | null; played: boolean; targetWon: boolean | null; seconds: number | null };

export type EventFight = { kind: "daily" | "weekly"; twist: TwistId } | { kind: "custom"; customId: number; fromId: number };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const left = (iso: string) => { const ms = new Date(iso).getTime() - Date.now(); const h = Math.max(0, Math.floor(ms / 3600000)); return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h}h left` : "ending soon"; };

export function BossEvents({ playerId, meId, defeated, onFight, refreshKey }: {
  playerId: number | null; meId: number | null; defeated: Set<string>; onFight: (boss: Boss, ev: EventFight) => void; refreshKey: number;
}) {
  const [data, setData] = useState<{ daily: Ev; weekly: Ev; raid: Raid } | null>(null);
  useEffect(() => {
    fetch(`/api/boss-battles/events${playerId ? `?playerId=${playerId}` : ""}`, { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, [playerId, refreshKey]);
  if (!data) return null;
  return (
    <div className="bev">
      <div className="bev-grid">
        {(["daily", "weekly"] as const).map(k => <EventCard key={k} ev={data[k]} playerId={playerId} onFight={onFight} />)}
      </div>
      <RaidCard raid={data.raid} />
      {meId && <BeTheBoss meId={meId} defeated={defeated} onFight={onFight} refreshKey={refreshKey} />}
    </div>
  );
}

function EventCard({ ev, playerId, onFight }: { ev: Ev; playerId: number | null; onFight: (b: Boss, e: EventFight) => void }) {
  const boss = getBossById(ev.bossId)!;
  return (
    <div className={`bev-card ${ev.kind}`}>
      <div className="bev-head">{ev.kind === "daily" ? <CalendarDays size={13} /> : <CalendarRange size={13} />}<span>{ev.kind === "daily" ? "Daily Boss" : "Weekly Boss"}</span><small>{left(ev.endsAt)}</small></div>
      <div className="bev-body">
        <BossPortrait spec={boss.portrait} size={64} mood="talk" id={`ev-${ev.kind}-${boss.id}`} />
        <div>
          <b className="bev-name">{boss.name}</b>
          <span className="bev-twist">⚡ {ev.twistInfo.name}</span>
          <small className="bev-desc">{ev.twistInfo.description}</small>
        </div>
      </div>
      <div className="bev-board">
        {ev.board.length ? ev.board.slice(0, 3).map((r, i) => (
          <div key={r.playerId} className={r.playerId === playerId ? "me" : ""}><span>{i + 1}</span><b>{r.name}</b><em><Timer size={10} /> {r.best != null ? fmt(r.best) : "-"}</em></div>
        )) : <p>No kills yet. Fastest kill wins{ev.kind === "weekly" ? " the Weekly Slayer tag" : " the day"}.</p>}
        {ev.mine && !ev.board.slice(0, 3).some(r => r.playerId === playerId) && <div className="me"><span>·</span><b>You</b><em>{ev.mine.won && ev.mine.best != null ? fmt(ev.mine.best) : `${ev.mine.tries} tries`}</em></div>}
      </div>
      <button className="bev-fight" disabled={!playerId} onClick={() => onFight(boss, { kind: ev.kind, twist: ev.twist })}><Swords size={14} /> Fight</button>
      <small className="bev-foot">{ev.fighters} fighting · open to everyone</small>
    </div>
  );
}

function RaidCard({ raid }: { raid: Raid }) {
  const pct = Math.round(raid.health * 100);
  return (
    <div className={`bev-raid ${raid.killed ? "down" : ""}`}>
      <div className="bev-head"><Crown size={13} /><span>League Raid · {new Date(`${raid.month}-15`).toLocaleDateString("en-GB", { month: "long" })}</span><small>{raid.killed ? "Defeated" : left(raid.endsAt)}</small></div>
      <div className="bev-raid-main">
        <div className="bev-raid-port"><BossPortrait spec={raid.boss.portrait as Boss["portrait"]} size={96} mood={raid.killed ? "beaten" : raid.health < 0.34 ? "angry" : "talk"} id="raid" /></div>
        <div className="bev-raid-txt">
          <b>{raid.boss.name}</b><small>{raid.boss.title}</small>
          <p>{raid.boss.lore}</p>
        </div>
      </div>
      <div className="bev-raid-bar"><i style={{ width: `${pct}%` }} /><span>{raid.killed ? "DEFEATED" : `${raid.damage.toLocaleString("en-GB")} / ${raid.hp.toLocaleString("en-GB")} damage`}</span></div>
      <p className="bev-raid-how">Every league match hits it (more for a win, more again for each 180), and so does every boss fight. Everyone who hits it gets the Raider tag when it falls; the top hitter becomes Raid Leader.</p>
      <div className="bev-raid-top">
        {raid.top.slice(0, 3).map((r, i) => <div key={r.playerId}><span>{["🥇", "🥈", "🥉"][i]}</span><b>{r.name}</b><em>{r.damage.toLocaleString("en-GB")}</em></div>)}
        {raid.mine && <div className="me"><span><Users size={11} /></span><b>You{raid.mine.rank ? ` · #${raid.mine.rank}` : ""}</b><em>{raid.mine.damage.toLocaleString("en-GB")}</em></div>}
      </div>
    </div>
  );
}

function BeTheBoss({ meId, defeated, onFight, refreshKey }: { meId: number; defeated: Set<string>; onFight: (b: Boss, e: EventFight) => void; refreshKey: number }) {
  const [mine, setMine] = useState<{ incoming: Custom[]; sent: Custom[] } | null>(null);
  const [players, setPlayers] = useState<{ id: number; name: string; isActive?: boolean }[]>([]);
  const [target, setTarget] = useState("");
  const [curses, setCurses] = useState<string[]>(["", "", ""]);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => fetch("/api/boss-battles/custom/mine", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setMine).catch(() => {});
  useEffect(() => { void load(); fetch("/api/players").then(r => r.json()).then(setPlayers).catch(() => {}); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = BOSSES.filter(b => b.gameMode === "X01" && defeated.has(b.id)).flatMap(b => ([1, 2, 3] as const).map(ph => ({ ref: `${b.id}:${ph}`, label: `${moveForPhase(b, ph).name} (${b.name})`, desc: moveForPhase(b, ph).description })));
  const send = async () => {
    setNote(null);
    const r = await fetch("/api/boss-battles/custom", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: Number(target), curses, message: msg }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setNote({ ok: true, text: "Sent. They'll get a notification." }); setTarget(""); setCurses(["", "", ""]); setMsg(""); void load(); }
    else setNote({ ok: false, text: j.error ?? "Couldn't send that" });
  };
  const waiting = mine?.incoming.filter(c => !c.played) ?? [];
  return (
    <div className="bev-btb">
      <div className="bev-head"><Crown size={13} /><span>Be the Boss</span><small>Pick three curses and dare a mate</small></div>
      {waiting.map(c => (
        <button key={c.id} className="bev-incoming" onClick={() => onFight(customBoss(c), { kind: "custom", customId: c.id, fromId: c.fromId })}>
          <span>👑 <b>Boss {c.fromName}</b> wants a fight{c.message ? `: "${c.message}"` : ""}</span><em>Fight →</em>
        </button>
      ))}
      {options.length < 3 ? <p className="bev-dim">Beat some 501 bosses first: their curses become yours to use.</p> : (
        <>
          <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Who to challenge">
            <option value="">Who are you challenging?</option>
            {players.filter(p => p.id !== meId && p.isActive !== false).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {["Phase 1", "Phase 2", "Enraged"].map((label, i) => (
            <select key={label} value={curses[i]} onChange={e => setCurses(cs => cs.map((c, j) => j === i ? e.target.value : c))} aria-label={`${label} curse`}>
              <option value="">{label} curse…</option>
              {options.map(o => <option key={o.ref} value={o.ref}>{o.label}</option>)}
            </select>
          ))}
          <input value={msg} maxLength={80} onChange={e => setMsg(e.target.value)} placeholder="A line for your boss (optional)" />
          <button className="bev-fight" disabled={!target || curses.some(c => !c)} onClick={send}><Send size={13} /> Send your boss</button>
          {note && <p className={note.ok ? "bev-ok" : "bev-bad"}>{note.text}</p>}
          <p className="bev-dim">They fight a 501 boss version of you: it throws your shadow's darts if it's unlocked, and uses your three curses.</p>
        </>
      )}
      {!!mine?.sent.length && <div className="bev-sent">{mine.sent.slice(0, 5).map(c => (
        <div key={c.id}><span>vs {c.toName}</span><em className={c.played ? (c.targetWon ? "l" : "w") : ""}>{!c.played ? "Waiting" : c.targetWon ? "They beat you" : "Your boss won"}</em></div>
      ))}</div>}
    </div>
  );
}

/** Hub: the month's League Raid at a glance. */
export function RaidHubCard() {
  const [raid, setRaid] = useState<Raid | null>(null);
  useEffect(() => { fetch("/api/boss-battles/raid", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setRaid).catch(() => {}); }, []);
  if (!raid) return null;
  const pct = Math.round(raid.health * 100);
  return (
    <a href="/boss-battle" className={`bev-raid bev-raid-hub ${raid.killed ? "down" : ""}`}>
      <div className="bev-head"><Crown size={13} /><span>League Raid</span><small>{raid.killed ? "Defeated" : left(raid.endsAt)}</small></div>
      <div className="bev-raid-main">
        <div className="bev-raid-port"><BossPortrait spec={raid.boss.portrait as Boss["portrait"]} size={64} mood={raid.killed ? "beaten" : "talk"} id="raid-hub" /></div>
        <div className="bev-raid-txt" style={{ flex: 1 }}>
          <b style={{ fontSize: 20 }}>{raid.boss.name}</b>
          <small>{raid.killed ? `Brought down by ${raid.contributors} players` : `${raid.contributors} players hitting it${raid.mine?.damage ? ` · you: ${raid.mine.damage.toLocaleString("en-GB")}` : ""}`}</small>
        </div>
      </div>
      <div className="bev-raid-bar"><i style={{ width: `${pct}%` }} /><span>{raid.killed ? "DEFEATED" : `${pct}% health left`}</span></div>
    </a>
  );
}
