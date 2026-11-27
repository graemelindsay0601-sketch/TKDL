import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Lock, Vote } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import "../league-target/league-target.css";
import "./gaffer.css";

type Step = { hits: number; id: string; name: string; category: string; rarity: string; owned: boolean };
type Ladder = { hits: number; steps: Step[]; next: number | null };
type Option = { key: string; label: string; blurb: string; unit: string; locked?: string; targets?: [number, number, number]; games?: { param: string; label: string; targets: [number, number, number] }[] };
export type Gaffer = {
  available: boolean; live: boolean; month: string; daysLeft: number;
  gaffer: { id: number; name: string } | null; chosenBy: string; voided?: boolean; youAreGaffer: boolean; picking: boolean; pickBy: string;
  options: Option[] | null;
  challenge: null | { key: string; label: string; unit: string; blurb: string; contributes: string; level: number; levelName: string; target: number; value: number; paramLabel: string | null; contributors: number };
  me: null | { contributing: boolean; value: number };
  vote: null | { forMonth: string; candidates: { id: number; name: string; matches: number }[]; myVote: number | null; votesCast: number };
  ladders: null | { gaffer: Ladder; squad: Ladder };
  history: { month: string; gaffer: string | null; label: string | null; target: number | null; value: number | null; hit: boolean | null }[];
};

const MONTH = (k: string, short = false) => new Date(`${k}-01T12:00:00Z`).toLocaleString("en-GB", { month: short ? "short" : "long", timeZone: "UTC" });
const LEVELS = ["Steady", "Push", "All in"];
const KIND: Record<string, string> = { LEADERBOARD_TAG: "Tag", BANNER: "Banner", FRAME: "Frame", CLUBHOUSE_ROOM: "Room", NAME_STYLE: "Name" };
const post = (url: string, body: unknown) => fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Something went wrong"); });

/** Hub card for The Gaffer: who's in charge, this month's challenge, the pick, and next month's vote. */
export function GafferCard() {
  const { data } = useFetch<Gaffer>("/api/gaffer");
  const qc = useQueryClient();
  if (!data?.available) return null;
  return <GafferView g={data} onChange={() => void qc.invalidateQueries({ queryKey: ["raw-fetch", "/api/gaffer"] })} />;
}

export function GafferView({ g, onChange }: { g: Gaffer; onChange?: () => void }) {
  const c = g.challenge;
  const hit = !!c && c.value >= c.target;
  const pct = c ? Math.min(100, Math.round((c.value / Math.max(1, c.target)) * 100)) : 0;
  return (
    <section className={`lt-card gf-card${hit ? " is-hit" : ""}`} data-testid="gaffer">
      <span className="lt-sheen" aria-hidden />
      <header className="lt-head">
        <span className="lt-icon gf-icon"><Crown className="w-4 h-4" /></span>
        <span className="lt-kick">The Gaffer · {MONTH(g.month, true)}</span>
        {!g.live && <span className="lt-chip lt-preview">Preview</span>}
        <span className="lt-chip">{g.daysLeft} {g.daysLeft === 1 ? "day" : "days"} left</span>
      </header>

      <div className="gf-boss">
        <span className="gf-avatar">{g.gaffer ? g.gaffer.name.slice(0, 1) : "–"}</span>
        <div className="min-w-0">
          <div className="gf-name">{g.gaffer ? g.gaffer.name : "No Gaffer this month"}{g.youAreGaffer && <span className="gf-you">You</span>}</div>
          <div className="gf-how">{g.chosenBy === "vote" ? "Voted in by the league" : g.chosenBy === "admin" ? "Appointed by the league admin" : g.chosenBy === "most_matches" ? "No votes — most matches last month" : "Nobody played enough last month"}</div>
        </div>
      </div>

      {g.picking && g.youAreGaffer && g.options && <Picker options={g.options} pickBy={g.pickBy} onDone={onChange} />}
      {g.picking && !g.youAreGaffer && (
        <p className="gf-wait">{g.gaffer?.name} is picking this month's challenge — until {new Date(g.pickBy).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.</p>
      )}

      {g.voided && <p className="gf-wait">This month's challenge has been called off. Voting for next month still runs as normal.</p>}

      {c && !g.voided && (
        <>
          <div className="lt-main">
            <div className="lt-big"><b>{c.value}</b><span>/ {c.target}{c.key === "finishing" ? "%" : ""}</span></div>
            <div className="lt-what">
              <div className="lt-label">{c.label}{c.paramLabel ? `: ${c.paramLabel}` : ""}</div>
              <div className="lt-status"><span className={`gf-level l${c.level}`}>{c.levelName}</span>{hit ? " Challenge hit" : ` ${Math.max(0, c.target - c.value)}${c.key === "finishing" ? "%" : ` ${c.unit}`} to go`}</div>
            </div>
          </div>
          <div className="lt-bar"><span className="lt-fill" style={{ width: `${pct}%` }} />{[25, 50, 75].map(x => <span key={x} className="lt-tick" style={{ left: `${x}%` }} />)}</div>
          <p className="lt-blurb">{c.blurb}</p>
          {g.me && (
            <div className={`lt-me${g.me.contributing ? " in" : ""}`}>
              {g.me.contributing ? <><Check className="w-3.5 h-3.5" /> You're in the squad</> : <>To help: {c.contributes.toLowerCase()}</>}
              <span className="lt-sharing">{c.contributors} in the squad</span>
            </div>
          )}
        </>
      )}

      {g.vote && <VoteBox vote={g.vote} onDone={onChange} />}

      {g.ladders && (
        <div className="lt-ladder">
          <LadderRow title="Squad unlocks" sub={`${g.ladders.squad.hits} hit`} ladder={g.ladders.squad} />
          <LadderRow title="Gaffer unlocks" sub={`${g.ladders.gaffer.hits} as Gaffer`} ladder={g.ladders.gaffer} />
          <p className="lt-note">Only from The Gaffer — never in the Store.</p>
        </div>
      )}

      {g.history.length > 0 && (
        <div className="lt-history">
          {g.history.slice().reverse().map(h => (
            <span key={h.month} className={`lt-past${h.hit ? " hit" : ""}`} title={`${h.gaffer ?? "No Gaffer"} · ${h.label}: ${h.value ?? 0} / ${h.target}`}>
              {MONTH(h.month, true)} · {h.gaffer ?? "—"}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function LadderRow({ title, sub, ladder }: { title: string; sub: string; ladder: Ladder }) {
  return (
    <>
      <div className="lt-ladder-head gf-lhead"><span>{title}</span><span>{sub}</span></div>
      <div className="lt-steps" style={{ gridTemplateColumns: `repeat(${ladder.steps.length}, 1fr)` }}>
        {ladder.steps.map(s => {
          const next = !s.owned && ladder.next === s.hits;
          return (
            <div key={s.id} className={`lt-step r-${s.rarity.toLowerCase()}${s.owned ? " owned" : ""}${next ? " next" : ""}`}>
              <span className="lt-step-n">{s.owned ? <Check className="w-3 h-3" /> : s.hits}</span>
              <span className="lt-step-name">{s.name}</span>
              <span className="lt-step-kind">{KIND[s.category] ?? s.category}</span>
              {!s.owned && !next && <Lock className="lt-step-lock w-3 h-3" />}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Picker({ options, pickBy, onDone }: { options: Option[]; pickBy: string; onDone?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [game, setGame] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sel = options.find(o => o.key === open);
  const targets = sel?.games ? sel.games.find(x => x.param === game)?.targets : sel?.targets;
  const confirm = () => {
    if (!sel || !level) return;
    setBusy(true); setErr(null);
    post("/api/gaffer/pick", { challenge: sel.key, level, param: game }).then(() => onDone?.()).catch(e => setErr(e.message)).finally(() => setBusy(false));
  };
  return (
    <div className="gf-picker">
      <div className="gf-ptitle">You're the Gaffer. Pick this month's challenge</div>
      <div className="gf-psub">Until {new Date(pickBy).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} — otherwise Meet the League (Steady) runs.</div>
      {options.map(o => (
        <div key={o.key}>
        <button className={`gf-opt${open === o.key ? " on" : ""}${o.locked ? " locked" : ""}`} disabled={!!o.locked}
          onClick={() => { setOpen(o.key); setLevel(null); setGame(o.games?.[0]?.param ?? null); }}>
          <b>{o.label}{o.locked && <Lock className="w-3 h-3 inline ml-1.5 -mt-0.5" />}</b><span>{o.locked ?? o.blurb}</span>
        </button>
      {sel && open === o.key && (
        <div className="gf-dial">
          {sel.games && (
            <div className="gf-games">
              {sel.games.map(x => <button key={x.param} className={game === x.param ? "on" : ""} onClick={() => { setGame(x.param); setLevel(null); }}>{x.label}</button>)}
            </div>
          )}
          <div className="gf-levels">
            {targets?.map((t, i) => (
              <button key={i} className={`gf-lv l${i + 1}${level === i + 1 ? " on" : ""}`} onClick={() => setLevel(i + 1)}>
                <span>{LEVELS[i]}</span><b>{t}{sel.key === "finishing" ? "%" : ""}</b><em>{sel.key === "finishing" ? "checkout" : sel.unit}</em>
              </button>
            ))}
          </div>
          <button className="gf-go" disabled={!level || busy} onClick={confirm}>{busy ? "Locking in…" : "Lock it in"}</button>
          {err && <p className="gf-err">{err}</p>}
        </div>
      )}
        </div>
      ))}
    </div>
  );
}

function VoteBox({ vote, onDone }: { vote: NonNullable<Gaffer["vote"]>; onDone?: () => void }) {
  const [mine, setMine] = useState(vote.myVote);
  const [err, setErr] = useState<string | null>(null);
  const cast = (id: number) => { setErr(null); post("/api/gaffer/vote", { candidateId: id }).then(() => { setMine(id); onDone?.(); }).catch(e => setErr(e.message)); };
  return (
    <div className="gf-vote">
      <div className="gf-vtitle"><Vote className="w-4 h-4" /> Vote for {MONTH(vote.forMonth)}'s Gaffer<span>{vote.votesCast} {vote.votesCast === 1 ? "vote" : "votes"} so far</span></div>
      {vote.candidates.length === 0 ? <p className="gf-wait">Nobody has played enough this month to stand yet (3 matches).</p> : (
        <div className="gf-cands">
          {vote.candidates.map(c => (
            <button key={c.id} className={mine === c.id ? "on" : ""} onClick={() => cast(c.id)}>
              {mine === c.id && <Check className="w-3.5 h-3.5" />}<b>{c.name}</b><span>{c.matches} matches</span>
            </button>
          ))}
        </div>
      )}
      <p className="gf-vnote">One vote each; you can change it until the month ends. Ties go to whoever played more.</p>
      {err && <p className="gf-err">{err}</p>}
    </div>
  );
}
