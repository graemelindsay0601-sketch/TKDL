// Off the Oche cards the app posts itself: league moments, the Monday round-up,
// and call-outs (with accept / decline and predictions). Reactions and comments
// still come from the PostCard they sit in.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Swords, Trophy, Flame, Zap, Crown, Target, Skull, TrendingUp, Award, CalendarDays, ChevronRight, Check, X, Crosshair, Coins, Star, Ghost } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useBounties } from "./WantedChip";
import { useToast } from "@/hooks/use-toast";
import "./league-cards.css";

export type MomentMeta = {
  kind: string; title: string; line: string; stat?: string | number | null; statLabel?: string | null;
  players?: number[]; matchId?: number | null; link?: string | null;
};
type Who = { playerId: number; name: string; value: number } | null;
export type RoundupMeta = {
  label: string; matches: number; oneEighties: number; players: number;
  topWinner: Who; mostActive: Who; climber: Who; bestFinish: Who;
  moments: number; records: { title: string; name: string; value: number }[];
};
export type CalloutMeta = {
  challengerId: number; challengerName: string; targetId: number; targetName: string;
  game: string | null; message: string | null;
  status: "open" | "accepted" | "declined" | "settled" | "expired";
  winnerId?: number | null; matchId?: number | null;
};

const KIND: Record<string, { icon: typeof Trophy; colour: string; tag: string }> = {
  max:            { icon: Zap,        colour: "#ff005c", tag: "180" },
  big_finish:     { icon: Target,     colour: "#22c55e", tag: "Finish" },
  upset:          { icon: TrendingUp, colour: "#a855f7", tag: "Upset" },
  record:         { icon: Award,      colour: "#ffd24a", tag: "Record" },
  streak:         { icon: Flame,      colour: "#ff8a1f", tag: "Form" },
  elimination:    { icon: Skull,      colour: "#ef4444", tag: "Out" },
  target_hit:     { icon: Target,     colour: "#19c3c8", tag: "League Target" },
  gaffer:         { icon: Crown,      colour: "#ffd24a", tag: "The Gaffer" },
  callout_result: { icon: Swords,     colour: "#ff005c", tag: "Call-out" },
  callout_streak: { icon: Swords,     colour: "#ff5c93", tag: "Call-out run" },
  motm:           { icon: Star,       colour: "#ffd24a", tag: "Moment of the Month" },
  bounty_on:      { icon: Crosshair,  colour: "#ff3b3b", tag: "Bounty" },
  bounty_claimed: { icon: Coins,      colour: "#ffd24a", tag: "Bounty" },
  shadow_cup:     { icon: Ghost,      colour: "#a78bfa", tag: "Shadow Cup" },
  legend_slain:   { icon: Crown,      colour: "#ffd24a", tag: "Legend slain" },
  boss_world:     { icon: Swords,     colour: "#ff7a45", tag: "Boss Battle" },
  boss_revenge:   { icon: Flame,      colour: "#ff2d55", tag: "Revenge" },
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export function MomentBody({ meta, at }: { meta: MomentMeta; at: string }) {
  const k = KIND[meta.kind] ?? KIND.record;
  const Icon = k.icon;
  return (
    <div className="lc-moment" style={{ ["--lc" as any]: k.colour }}>
      <div className="lc-top"><span className="lc-tag"><Icon size={12} /> League moment · {k.tag}</span><span className="lc-ago">{ago(at)}</span></div>
      <div className="lc-row">
        <div className="lc-copy">
          <div className="lc-title">{meta.title}</div>
          <p className="lc-line">{meta.line}</p>
        </div>
        {meta.stat != null && meta.stat !== "" && (
          <div className="lc-stat"><b className={typeof meta.stat === "string" && isNaN(Number(meta.stat)) ? "word" : ""}>{meta.stat}</b>{meta.statLabel ? <small>{meta.statLabel}</small> : null}</div>
        )}
      </div>
      {meta.link && <Link href={meta.link} className="lc-link">{meta.matchId ? "See the match" : "See more"} <ChevronRight size={13} /></Link>}
    </div>
  );
}

export function RoundupBody({ meta, at }: { meta: RoundupMeta; at: string }) {
  const tiles: { label: string; who: Who; unit: string; icon: typeof Trophy }[] = [
    { label: "Most wins", who: meta.topWinner, unit: "wins", icon: Trophy },
    { label: "Most matches", who: meta.mostActive, unit: "played", icon: Swords },
    { label: "Biggest climber", who: meta.climber, unit: "pts", icon: TrendingUp },
    { label: "Best finish", who: meta.bestFinish, unit: "checkout", icon: Target },
  ];
  return (
    <div className="lc-roundup">
      <div className="lc-top"><span className="lc-tag"><CalendarDays size={12} /> The weekly round-up</span><span className="lc-ago">{ago(at)}</span></div>
      <div className="lc-title">Week of {meta.label}</div>
      <div className="lc-nums">
        <div><b>{meta.matches}</b><small>matches</small></div>
        <div><b>{meta.oneEighties}</b><small>180s</small></div>
        <div><b>{meta.players}</b><small>players</small></div>
        <div><b>{meta.moments}</b><small>moments</small></div>
      </div>
      <div className="lc-tiles">
        {tiles.filter(t => t.who).map(t => { const Icon = t.icon; return (
          <Link key={t.label} href={`/players/${t.who!.playerId}`} className="lc-tile">
            <span className="lc-tile-l"><Icon size={12} /> {t.label}</span>
            <span className="lc-tile-n">{t.who!.name}</span>
            <span className="lc-tile-v">{t.label === "Biggest climber" ? "+" : ""}{t.who!.value} {t.unit}</span>
          </Link>
        ); })}
      </div>
      {meta.records.length > 0 && (
        <div className="lc-records">
          {meta.records.map((r, i) => <div key={i}><Award size={12} /> <b>{r.name}</b> set a new record: {r.title.toLowerCase()} ({r.value})</div>)}
        </div>
      )}
    </div>
  );
}

export function CalloutBody({ postId, meta: initial, picks: initialPicks, myPick: initialMine, me, at, streaks }: {
  postId: number; meta: CalloutMeta; picks: Record<string, number> | null; myPick: number | null; me: number | null; at: string;
  streaks?: { challenger: number; target: number } | null;
}) {
  const { toast } = useToast();
  const [meta, setMeta] = useState(initial);
  const [picks, setPicks] = useState<Record<string, number>>(initialPicks ?? {});
  const [mine, setMine] = useState<number | null>(initialMine);
  const [busy, setBusy] = useState(false);
  const call = async (path: string, body: object) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/community/callouts/${postId}/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: j.error ?? "That didn't work", variant: "destructive" }); return false; }
      return true;
    } finally { setBusy(false); }
  };
  const answer = async (accept: boolean) => { if (await call("respond", { accept })) setMeta(m => ({ ...m, status: accept ? "accepted" : "declined" })); };
  const tip = async (pickId: number) => {
    if (await call("predict", { pickId })) {
      setPicks(p => { const n = { ...p }; if (mine) n[mine] = Math.max(0, (n[mine] ?? 1) - 1); n[pickId] = (n[pickId] ?? 0) + 1; return n; });
      setMine(pickId);
    }
  };
  const total = Object.values(picks).reduce((a, b) => a + b, 0);
  const sides = [{ id: meta.challengerId, name: meta.challengerName, role: "Called out", run: streaks?.challenger ?? 0 },
    { id: meta.targetId, name: meta.targetName, role: "Called", run: streaks?.target ?? 0 }];
  const live = meta.status === "open" || meta.status === "accepted";
  const involved = me === meta.challengerId || me === meta.targetId;
  const statusText: Record<CalloutMeta["status"], string> = {
    open: `Waiting for ${meta.targetName} to answer`, accepted: "Accepted · settles on their next league match",
    declined: `${meta.targetName} declined`, settled: "Settled", expired: "Lapsed: never played",
  };
  return (
    <div className={`lc-callout is-${meta.status}`}>
      <div className="lc-top"><span className="lc-tag"><Swords size={12} /> Call-out{meta.game ? ` · ${meta.game}` : ""}</span><span className="lc-ago">{ago(at)}</span></div>
      <div className="lc-vs">
        {sides.map((s, i) => {
          const won = meta.status === "settled" && meta.winnerId === s.id;
          const lost = meta.status === "settled" && meta.winnerId !== s.id;
          const share = total ? Math.round(((picks[s.id] ?? 0) / total) * 100) : 0;
          return (
            <div key={s.id} className={`lc-side${won ? " won" : ""}${lost ? " lost" : ""}${mine === s.id ? " mine" : ""}`}>
              <small>{s.role}{s.run >= 2 && <span className="lc-streak" title={`${s.run} call-outs won in a row`}><Flame size={11} />{s.run}</span>}</small>
              <Link href={`/players/${s.id}`} className="lc-name">{s.name}</Link>
              {won && <span className="lc-won"><Trophy size={11} /> Won</span>}
              {total > 0 && <div className="lc-share"><i style={{ width: `${share}%` }} /><span>{share}% backing</span></div>}
              {live && me && !involved && (
                <button disabled={busy} onClick={() => tip(s.id)} className="lc-tip">{mine === s.id ? <><Check size={12} /> Your pick</> : "Back them"}</button>
              )}
              {i === 0 && <span className="lc-vs-badge">VS</span>}
            </div>
          );
        })}
      </div>
      {meta.message && <p className="lc-quote">“{meta.message}”</p>}
      <div className="lc-status">
        <span>{statusText[meta.status]}</span>
        {meta.status === "settled" && meta.matchId && <Link href={`/match-centre/league-${meta.matchId}`} className="lc-link">See the match <ChevronRight size={13} /></Link>}
      </div>
      {meta.status === "open" && me === meta.targetId && (
        <div className="lc-answer">
          <button disabled={busy} onClick={() => answer(true)} className="go"><Check size={14} /> Accept</button>
          <button disabled={busy} onClick={() => answer(false)} className="no"><X size={14} /> Decline</button>
        </div>
      )}
    </div>
  );
}

/** The "Call someone out" sheet. */
export function CalloutComposer({ players, me, onDone, onClose }: {
  players: { id: number; name: string }[]; me: number; onDone: () => void; onClose: () => void;
}) {
  const { toast } = useToast();
  const [opts, setOpts] = useState<{ lines: string[]; games: string[] } | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [game, setGame] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/community/callouts/options").then(r => r.json()).then(setOpts).catch(() => setOpts({ lines: [], games: [] })); }, []);
  const send = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await fetch("/api/community/callouts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: target, game, line }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ title: j.error ?? "Couldn't send the call-out", variant: "destructive" }); return; }
      toast({ title: "Call-out sent", description: "They've been notified." });
      onDone();
    } finally { setBusy(false); }
  };
  return (
    <div className="lc-composer">
      <div className="lc-top"><span className="lc-tag"><Swords size={12} /> Call someone out</span><button className="lc-x" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <label>Who?</label>
      <div className="lc-chips">{players.filter(p => p.id !== me).map(p => <button key={p.id} className={target === p.id ? "on" : ""} onClick={() => setTarget(p.id)}>{p.name}</button>)}</div>
      <label>What at? <small>optional</small></label>
      <div className="lc-chips">{(opts?.games ?? []).map(g => <button key={g} className={game === g ? "on" : ""} onClick={() => setGame(game === g ? null : g)}>{g}</button>)}</div>
      <label>Say something <small>optional</small></label>
      <div className="lc-chips">{(opts?.lines ?? []).map(l => <button key={l} className={line === l ? "on" : ""} onClick={() => setLine(line === l ? null : l)}>{l}</button>)}</div>
      <button className="lc-send" disabled={!target || busy} onClick={send}><Swords size={15} /> Send the call-out</button>
      <p className="lc-help">It settles on your next league match against them. Everyone else can back a winner.</p>
    </div>
  );
}

/** Tipster table: who calls the call-outs right. */
export function TipsterTable({ rows }: { rows: { playerId: number; name: string; right: number; total: number }[] }) {
  if (!rows.length) return null;
  return (
    <div className="lc-tipsters">
      <div className="lc-top"><span className="lc-tag"><Target size={12} /> Tipster table</span><small>Call-outs called right</small></div>
      {rows.slice(0, 5).map((r, i) => (
        <Link key={r.playerId} href={`/players/${r.playerId}`} className="lc-tip-row"><span className="lc-rk">{i + 1}</span><span className="lc-nm">{r.name}</span><b>{r.right}/{r.total}</b></Link>
      ))}
    </div>
  );
}

/** Moment of the Month: the vote while it's open, then the winner for a few days. */
export function MotmCard({ me }: { me: number | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useFetch<null | {
    month: string; label: string; closesAt: string; open: boolean; winnerPostId: number | null; myVote: number | null;
    options: { postId: number; players: number[]; kind: string; title: string; line: string; stat: string | number | null; statLabel: string | null; votes: number }[];
  }>("/api/community/motm");
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const total = data.options.reduce((a: number, o: any) => a + o.votes, 0);
  const daysLeft = Math.max(0, Math.ceil((new Date(data.closesAt).getTime() - Date.now()) / 86400000));
  const vote = async (postId: number) => {
    setBusy(true);
    try {
      const r = await fetch("/api/community/motm/vote", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast({ title: j.error ?? "Couldn't vote", variant: "destructive" });
      else await qc.invalidateQueries({ queryKey: ["raw-fetch", "/api/community/motm"] });
    } finally { setBusy(false); }
  };
  return (
    <div className="lc-motm">
      <div className="lc-top"><span className="lc-tag"><Star size={12} /> Moment of the Month</span><span className="lc-ago">{data.open ? (daysLeft ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Closes today") : "Result"}</span></div>
      <div className="lc-title">{data.label}</div>
      <p className="lc-motm-sub">{data.open ? "Pick the league's favourite moment. One vote each, and not your own." : "The league has spoken."}</p>
      {data.options.map((o: any) => {
        const k = KIND[o.kind] ?? KIND.record;
        const share = total ? Math.round((o.votes / total) * 100) : 0;
        const mine = data.myVote === o.postId, win = data.winnerPostId === o.postId;
        const canVote = data.open && me && !o.players.includes(me);
        return (
          <button key={o.postId} disabled={!canVote || busy} onClick={() => vote(o.postId)} className={`lc-opt${mine ? " mine" : ""}${win ? " win" : ""}`} style={{ ["--k" as any]: k.colour }}>
            {(total > 0 || !data.open) && <i style={{ width: `${share}%` }} />}
            <span style={{ minWidth: 0 }}>
              <span className="ot">{win && <Trophy size={12} style={{ display: "inline", marginRight: 4 }} />}{o.title}</span>
              <span className="ol" style={{ display: "block" }}>{o.line}</span>
            </span>
            <span className="ov">{o.votes}<small>{mine ? "your vote" : o.votes === 1 ? "vote" : "votes"}</small></span>
          </button>
        );
      })}
    </div>
  );
}

/** The Wanted board: everyone with a live bounty on them. */
export function WantedBoard() {
  const list = useBounties();
  if (!list.length) return null;
  return (
    <div className="lc-board">
      <div className="lc-top"><span className="lc-tag"><Crosshair size={12} /> Wanted</span><small style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Beat them in a league match to claim it</small></div>
      <div className="lc-board-row">
        {list.map(b => (
          <Link key={b.id} href={`/players/${b.playerId}`} className="lc-poster">
            <span className="w">WANTED</span>
            <span className="n">{b.name}</span>
            <span className="r">{b.reasonText}</span>
            <span className={`lc-wanted l${b.level} lv`}><Coins className="w-2.5 h-2.5" />{b.levelName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
