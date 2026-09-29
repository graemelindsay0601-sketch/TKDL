import { useState } from "react";
import { ArrowLeft, Award, Crosshair, ExternalLink, MessageSquareQuote, Shield, Swords, Target, Trophy, UserRound } from "lucide-react";
import "./player-focus.css";

export type PlayerFocus = {
  id: number; name: string; elo: number; points: number; rank: number;
  seasonWins: number; seasonLosses: number; careerWins: number; careerLosses: number; careerGamesPlayed: number;
  careerPeakElo: number; currentWinStreak: number; currentLossStreak: number; longestWinStreak: number;
  eliminationsCount: number; championshipCount: number; achievementCount: number; total180s: number;
  avatarUpdatedAt: string | null; recentForm: Array<"W" | "L">; titleProbability: number | null;
  standoutAchievement: null | { name: string; icon: string; rarity: string };
  mainRivalry: null | { opponentId: number; opponentName: string; meetings: number; wins: number; losses: number };
  latestQuote: null | { text: string; createdAt: string };
  seasonStory: string; pundits: { chalky: string; ton: string };
};

function pct(value: number) { return `${Math.round(value * 100)}%`; }
function winRate(player: PlayerFocus) { const played = player.careerWins + player.careerLosses; return played ? Math.round(player.careerWins / played * 100) : 0; }
function tier(elo: number) { return elo >= 1400 ? "Diamond" : elo >= 1250 ? "Platinum" : elo >= 1100 ? "Gold" : elo >= 950 ? "Silver" : "Bronze"; }

function PlayerPortrait({ player, large = false }: { player: PlayerFocus; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const hasAvatar = !!player.avatarUpdatedAt && !failed;
  return <div className={`focus-portrait ${large ? "is-large" : ""}`}>
    {hasAvatar ? <img src={`/api/players/${player.id}/avatar-image?v=${encodeURIComponent(player.avatarUpdatedAt!)}`} alt={player.name} onError={() => setFailed(true)} /> : <span>{player.name.slice(0, 1).toUpperCase()}</span>}
  </div>;
}

function FormDots({ form }: { form: Array<"W" | "L"> }) {
  return <div className="focus-form" aria-label={`Recent form ${form.join(", ") || "unavailable"}`}>{form.length ? form.map((result, index) => <i className={result === "W" ? "is-win" : "is-loss"} key={index}>{result}</i>) : <small>No recent games</small>}</div>;
}

function FocusCard({ player, onOpen }: { player: PlayerFocus; onOpen: () => void }) {
  return <button className="focus-card" onClick={onOpen}>
    <div className="focus-card__rank"><small>Rank</small><strong>{player.rank}</strong></div>
    <PlayerPortrait player={player} />
    <div className="focus-card__identity"><small>{tier(player.elo)} · {player.elo} Elo</small><strong>{player.name}</strong><span>{player.seasonWins}W — {player.seasonLosses}L this season</span></div>
    <FormDots form={player.recentForm} />
    <div className="focus-card__footer"><span>{player.titleProbability === null ? "Title chance pending" : `${pct(player.titleProbability)} title chance`}</span><b>View focus <ExternalLink /></b></div>
  </button>;
}

function ProfileDetail({ player, onBack }: { player: PlayerFocus; onBack: () => void }) {
  return <div className="focus-detail">
    <button className="focus-detail__back" onClick={onBack}><ArrowLeft /> All players</button>
    <section className="focus-detail__hero">
      <div className="focus-detail__rank"><small>Singles rank</small><strong>#{player.rank}</strong></div>
      <PlayerPortrait player={player} large />
      <div className="focus-detail__identity"><span>TKDL LIVE · Player Focus</span><h2>{player.name}</h2><p>{tier(player.elo)} player · {player.elo} Elo · Peak {player.careerPeakElo}</p><FormDots form={player.recentForm} /></div>
      <a href={`/players/${player.id}`}>Full player profile <ExternalLink /></a>
    </section>
    <div className="focus-detail__stats">
      <div><small>Career record</small><strong>{player.careerWins}–{player.careerLosses}</strong><span>{winRate(player)}% win rate</span></div>
      <div><small>Current season</small><strong>{player.seasonWins}–{player.seasonLosses}</strong><span>{player.points} points</span></div>
      <div><small>Best win streak</small><strong>{player.longestWinStreak}</strong><span>matches</span></div>
      <div><small>180s recorded</small><strong>{player.total180s}</strong><span>league matches</span></div>
      <div><small>Championships</small><strong>{player.championshipCount}</strong><span>Singles titles</span></div>
      <div><small>Achievements</small><strong>{player.achievementCount}</strong><span>{player.standoutAchievement?.name ?? "Still building"}</span></div>
    </div>
    <div className="focus-detail__editorial">
      <section className="focus-story"><div className="focus-section-label"><Target /> Season story</div><h3>{player.seasonStory}</h3><div className="focus-story__meter"><span style={{ width: player.titleProbability === null ? "0%" : pct(player.titleProbability) }} /><b>{player.titleProbability === null ? "Title predictor waiting for data" : `${pct(player.titleProbability)} current title chance`}</b></div></section>
      <section className="focus-rivalry"><div className="focus-section-label"><Swords /> Rivalry file</div>{player.mainRivalry ? <><h3>{player.mainRivalry.opponentName}</h3><div><span>{player.name}<b>{player.mainRivalry.wins}</b></span><small>{player.mainRivalry.meetings} meetings</small><span><b>{player.mainRivalry.losses}</b>{player.mainRivalry.opponentName}</span></div><a href={`/h2h?p1=${player.id}&p2=${player.mainRivalry.opponentId}`}>Open full rivalry <ExternalLink /></a></> : <p>No recorded Singles rivalry yet.</p>}</section>
      <section className="focus-honour"><div className="focus-section-label"><Award /> Defining mark</div>{player.standoutAchievement ? <><span>{player.standoutAchievement.icon}</span><h3>{player.standoutAchievement.name}</h3><p>{player.standoutAchievement.rarity} achievement</p></> : <><Shield /><h3>The story is still being written</h3><p>No achievement unlocked yet.</p></>}</section>
      <section className="focus-quote"><div className="focus-section-label"><MessageSquareQuote /> League Voices</div>{player.latestQuote ? <blockquote>“{player.latestQuote.text}”</blockquote> : <p>No completed interview is in the archive yet.</p>}</section>
    </div>
    <section className="focus-pundits"><div className="focus-section-label"><Crosshair /> From the desk</div><div><article className="is-chalky"><small>Chalky's take</small><p>{player.pundits.chalky}</p></article><article className="is-ton"><small>Ton's take</small><p>{player.pundits.ton}</p></article></div></section>
  </div>;
}

export function PlayerFocusPanel({ players, loading, error }: { players: PlayerFocus[]; loading: boolean; error: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = players.find(player => player.id === selectedId) ?? null;
  if (loading) return <div className="live-extras__state"><UserRound /><strong>Preparing the player profiles…</strong></div>;
  if (error) return <div className="live-extras__state"><UserRound /><strong>Player Focus is temporarily unavailable.</strong></div>;
  if (selected) return <ProfileDetail player={selected} onBack={() => setSelectedId(null)} />;
  return <div className="focus-library"><div className="focus-library__intro"><span>Beyond the results</span><h2>Player Focus</h2><p>Every active player’s season, career, rivalry and voice brought together as a TKDL LIVE profile.</p><div><Trophy /><strong>{players.length}</strong><small>active stories</small></div></div>{players.length === 0 ? <div className="live-extras__state"><UserRound /><strong>No active players are available.</strong></div> : <div className="focus-grid">{players.map(player => <FocusCard key={player.id} player={player} onOpen={() => setSelectedId(player.id)} />)}</div>}</div>;
}
