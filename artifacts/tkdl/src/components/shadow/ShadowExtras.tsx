// Shadow Ladder (nightly ranking of every shadow) and Haunt a friend, on the Shadow Bot page.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ListOrdered, ChevronUp, ChevronDown, Minus, Play, Skull, Send } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { useCurrentPlayer } from "@/context/auth";
import { Replay } from "./ShadowCup";
import "./shadow-cup.css";

type LadderRow = { playerId: number; name: string; rating: number; rank: number; move: number | null; played: number; won: number; form: string;
  lastNight: { id: number; opp: string; won: boolean; score: string }[] };

export function ShadowLadder() {
  const { data } = useFetch<{ night: string | null; rows: LadderRow[] }>("/api/shadow-ladder");
  const me = useCurrentPlayer()?.playerId ?? null;
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [watch, setWatch] = useState<number | null>(null);
  const rows = data?.rows ?? [];
  const mineIdx = rows.findIndex(r => r.playerId === me);
  const shown = all ? rows : rows.filter((r, i) => i < 10 || i === mineIdx);
  return (
    <div className="sc-card">
      <div className="sc-top"><span className="sc-tag"><ListOrdered size={12} /> Shadow Ladder</span>
        <span className="sc-dim">{data?.night ? `Played ${new Date(`${data.night}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : ""}</span></div>
      <p className="sc-sub">Every night each shadow plays the shadows ranked either side of it. Practise better and your shadow climbs.</p>
      {!rows.length && <p className="sc-dim">The first night is played once Shadow League is on and two or more shadows are unlocked.</p>}
      {shown.map(r => (
        <div key={r.playerId} className={`sc-lad${r.playerId === me ? " me" : ""}`}>
          <button className="sc-lad-row" onClick={() => setOpen(o => o === r.playerId ? null : r.playerId)}>
            <span className="sc-rk">{r.rank}</span>
            <span className={`sc-mv ${r.move == null || r.move === 0 ? "" : r.move > 0 ? "up" : "down"}`}>
              {r.move == null ? <span className="sc-new">NEW</span> : r.move > 0 ? <><ChevronUp size={13} />{r.move}</> : r.move < 0 ? <><ChevronDown size={13} />{-r.move}</> : <Minus size={12} />}
            </span>
            <span className="sc-nm">Shadow {r.name}</span>
            <span className="sc-form">{r.form.split("").map((c, i) => <i key={i} className={c === "W" ? "w" : "l"} />)}</span>
            <b className="sc-rt">{r.rating}</b>
          </button>
          {open === r.playerId && (
            <div className="sc-lad-more">
              <div className="sc-dim">{r.won}/{r.played} won all-time · last night:</div>
              {r.lastNight.length ? r.lastNight.map(m => (
                <div key={m.id} className="sc-lad-res">
                  <span className={m.won ? "sc-w" : "sc-l"}>{m.won ? "W" : "L"} {m.score}</span>
                  <span>vs Shadow {m.opp}</span>
                  <button className="sc-mini" onClick={() => setWatch(m.id)}><Play size={11} /> Watch</button>
                </div>
              )) : <div className="sc-dim">Sat out last night.</div>}
            </div>
          )}
        </div>
      ))}
      {rows.length > 10 && <button className="sc-more" onClick={() => setAll(a => !a)}>{all ? "Top 10 only" : `All ${rows.length} shadows`}</button>}
      {watch != null && <Replay id={watch} onClose={() => setWatch(null)} src="/api/shadow-ladder/matches" tag="Shadow Ladder" />}
    </div>
  );
}

type Haunts = {
  incoming: { id: number; fromId: number; name: string; createdAt: string }[];
  sent: { id: number; toId: number; name: string; status: "waiting" | "won" | "lost"; score: string | null }[];
  record: { won: number; lost: number; victims: string[] };
};

export function HauntAFriend() {
  const me = useCurrentPlayer()?.playerId ?? null;
  const qc = useQueryClient();
  const { data } = useFetch<Haunts>(me ? "/api/shadow-haunts" : null);
  const { data: players } = useFetch<{ id: number; name: string; isActive?: boolean }[]>("/api/players");
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shadow-haunts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: Number(target) }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setMsg({ ok: true, text: "Sent. They've got 7 days to play your shadow." }); setTarget(""); void qc.invalidateQueries({ queryKey: ["raw-fetch", "/api/shadow-haunts"] }); }
      else setMsg({ ok: false, text: j.error ?? "Couldn't send that" });
    } finally { setBusy(false); }
  };
  const others = (players ?? []).filter(p => p.id !== me && p.isActive !== false);
  return (
    <div className="sc-card">
      <div className="sc-top"><span className="sc-tag"><Skull size={12} /> Haunt a friend</span>
        {data && (data.record.won + data.record.lost > 0) && <span className="sc-dim">Your shadow: {data.record.won} won · {data.record.lost} lost</span>}</div>
      <p className="sc-sub">Send your shadow after someone. They play it from Practice whenever they like (7 days). If your shadow wins, it goes on your profile.</p>

      {!!data?.incoming.length && (
        <div className="sc-haunt-in">
          {data.incoming.map(h => (
            <Link key={h.id} href={`/practice?shadow=${h.fromId}`} className="sc-haunt-row in">
              <span>👻 <b>{h.name}'s shadow</b> is haunting you</span><span className="sc-go">Play it →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="sc-haunt-send">
        <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Who to haunt">
          <option value="">Who should your shadow haunt?</option>
          {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="sc-send" disabled={!target || busy} onClick={send}><Send size={13} /> Haunt</button>
      </div>
      {msg && <p className={`sc-msg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}

      {!!data?.sent.length && (
        <div className="mt-3">
          {data.sent.map(h => (
            <div key={h.id} className="sc-haunt-row">
              <span>Haunting <b>{h.name}</b></span>
              <span className={h.status === "won" ? "sc-w" : h.status === "lost" ? "sc-l" : "sc-dim"}>
                {h.status === "waiting" ? "Waiting" : h.status === "won" ? `Your shadow won${h.score ? ` ${h.score}` : ""}` : `${h.name} saw it off${h.score ? ` ${h.score}` : ""}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
