import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, MessageSquareQuote, Mic2, Radio, Target, Trophy, UserRound, X } from "lucide-react";
import { humanizeStoryType } from "./theme";
import { PlayerFocusPanel, type PlayerFocus } from "./PlayerFocusPanel";
import "./live-extras.css";

type Pick = { playerId: number; playerName: string; probability: number };
type ScoredPick = Pick & { correct: boolean };
type Scoreboard = {
  totals: { chalky: number; ton: number; seasonsScored: number };
  current: null | { seasonId: number; seasonName: string; generatedAt: string; chalky: Pick; ton: Pick };
  history: Array<{ seasonId: number; seasonName: string; champion: { playerName: string }; generatedAt: string; chalky: ScoredPick; ton: ScoredPick }>;
};
type Voice = {
  id: number; triggerType: string; createdAt: string; playerName: string;
  opener: { presenter: string; question: string; answer: string };
  followup: null | { presenter: string; question: string; answer: string };
};

function pct(value: number) { return `${Math.round(value * 100)}%`; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }

function PunditCard({ name, colour, score, pick }: { name: string; colour: string; score: number; pick: Pick | null }) {
  return (
    <article className="pundit-card" style={{ "--pundit-colour": colour } as React.CSSProperties}>
      <div className="pundit-card__name"><span>{name.slice(0, 1)}</span><div><small>TKDL pundit</small><strong>{name}</strong></div></div>
      <div className="pundit-card__score"><strong>{score}</strong><span>correct calls</span></div>
      <div className="pundit-card__pick"><small>Current title call</small><strong>{pick?.playerName ?? "Waiting for data"}</strong>{pick && <span>{pct(pick.probability)} model chance</span>}</div>
    </article>
  );
}

function ScoreboardPanel({ data, loading, error }: { data: Scoreboard | null; loading: boolean; error: boolean }) {
  if (loading) return <div className="live-extras__state"><Target /><strong>Checking the pundits' records…</strong></div>;
  if (error || !data) return <div className="live-extras__state"><Target /><strong>The scoreboard is temporarily unavailable.</strong></div>;
  return (
    <div className="pundit-board">
      <div className="pundit-board__intro"><div><span>Season-long bragging rights</span><h2>The Pundit Scoreboard</h2><p>Their title calls are locked from the first predictor snapshot of each Singles season, then checked against the real champion.</p></div><div className="pundit-board__played"><strong>{data.totals.seasonsScored}</strong><span>seasons scored</span></div></div>
      <div className="pundit-board__cards">
        <PunditCard name="Chalky" colour="#ff005c" score={data.totals.chalky} pick={data.current?.chalky ?? null} />
        <PunditCard name="Ton" colour="#0066ff" score={data.totals.ton} pick={data.current?.ton ?? null} />
      </div>
      <section className="pundit-history">
        <h3><Trophy /> The scorecard</h3>
        {data.history.length === 0 ? <p className="pundit-history__empty">The first score will land when a season with a saved opening call is completed.</p> : data.history.map(item => (
          <div className="pundit-history__row" key={item.seasonId}>
            <div><small>{item.seasonName}</small><strong>Champion: {item.champion.playerName}</strong></div>
            <span className={item.chalky.correct ? "is-correct" : ""}>{item.chalky.correct && <Check />} Chalky: {item.chalky.playerName}</span>
            <span className={item.ton.correct ? "is-correct" : ""}>{item.ton.correct && <Check />} Ton: {item.ton.playerName}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function VoicesPanel({ voices, loading, error }: { voices: Voice[]; loading: boolean; error: boolean }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (loading) return <div className="live-extras__state"><Mic2 /><strong>Opening the interview archive…</strong></div>;
  if (error) return <div className="live-extras__state"><Mic2 /><strong>The interview archive is temporarily unavailable.</strong></div>;
  return (
    <div className="voices-panel">
      <div className="voices-panel__intro"><span>In their own words</span><h2>League Voices</h2><p>Completed interviews from Season Launch and After the Oche, saved together as the league's spoken history.</p></div>
      {voices.length === 0 ? <div className="live-extras__state"><MessageSquareQuote /><strong>The archive will fill as players complete real interviews.</strong></div> : (
        <div className="voices-list">{voices.map(voice => {
          const open = voice.id === openId;
          return <article className={`voice-card ${open ? "is-open" : ""}`} key={voice.id}>
            <button onClick={() => setOpenId(open ? null : voice.id)}>
              <span className="voice-card__monogram">{voice.playerName.slice(0, 1)}</span>
              <span className="voice-card__title"><small>{humanizeStoryType(voice.triggerType)} · {dateLabel(voice.createdAt)}</small><strong>{voice.playerName}</strong><em>{voice.opener.answer}</em></span>
              {open ? <ChevronUp /> : <ChevronDown />}
            </button>
            {open && <div className="voice-card__transcript">
              <div className="is-host"><small>{voice.opener.presenter}</small><p>{voice.opener.question}</p></div>
              <div className="is-player"><small>{voice.playerName}</small><p>{voice.opener.answer}</p></div>
              {voice.followup && <><div className="is-host"><small>{voice.followup.presenter}</small><p>{voice.followup.question}</p></div><div className="is-player"><small>{voice.playerName}</small><p>{voice.followup.answer}</p></div></>}
            </div>}
          </article>;
        })}</div>
      )}
    </div>
  );
}

export function LiveExtras({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"focus" | "scoreboard" | "voices">("focus");
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [players, setPlayers] = useState<PlayerFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreError, setScoreError] = useState(false);
  const [voicesError, setVoicesError] = useState(false);
  const [playersError, setPlayersError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch("/api/broadcast/pundit-scoreboard", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch("/api/broadcast/voices", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch("/api/broadcast/player-focus", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()),
    ]).then(([scoreResult, voicesResult, playersResult]) => {
      if (cancelled) return;
      if (scoreResult.status === "fulfilled") setScoreboard(scoreResult.value as Scoreboard); else setScoreError(true);
      if (voicesResult.status === "fulfilled") setVoices((voicesResult.value as { voices: Voice[] }).voices); else setVoicesError(true);
      if (playersResult.status === "fulfilled") setPlayers((playersResult.value as { players: PlayerFocus[] }).players); else setPlayersError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  return <div className="live-extras" role="dialog" aria-label="TKDL LIVE features">
    <header className="live-extras__header"><div className="live-extras__brand"><span>TKDL</span> LIVE</div><div className="live-extras__label"><Radio /> Inside the League</div><button onClick={onClose} aria-label="Return to TKDL LIVE"><X /></button></header>
    <nav className="live-extras__tabs"><button className={tab === "focus" ? "is-active" : ""} onClick={() => setTab("focus")}><UserRound /> Player Focus</button><button className={tab === "scoreboard" ? "is-active" : ""} onClick={() => setTab("scoreboard")}><Target /> Pundit Scoreboard</button><button className={tab === "voices" ? "is-active" : ""} onClick={() => setTab("voices")}><Mic2 /> League Voices</button></nav>
    <main className="live-extras__content">{tab === "focus" ? <PlayerFocusPanel players={players} loading={loading} error={playersError} /> : tab === "scoreboard" ? <ScoreboardPanel data={scoreboard} loading={loading} error={scoreError} /> : <VoicesPanel voices={voices} loading={loading} error={voicesError} />}</main>
  </div>;
}
