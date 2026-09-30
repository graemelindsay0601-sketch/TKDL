import { Award, ChevronRight, Radio, Target, Trophy, X, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import "./match-night-presentation.css";

export type MatchNightSide = {
  title: string;
  members: string[];
  players?: Array<{ id: number; name: string; avatarUpdatedAt?: string | null; tagline?: string | null }>;
  points?: number;
  elo?: number;
};

type MatchNightPresentationProps = {
  mode: "intro" | "result";
  sides: MatchNightSide[];
  format: string;
  game: string;
  stake: number;
  stakeMode?: "per-player" | "total";
  winnerIndex?: number;
  resultDetail?: string;
  onContinue: () => void;
  onCancel?: () => void;
};

export function MatchNightPresentation({ mode, sides, format, game, stake, stakeMode, winnerIndex, resultDetail, onContinue, onCancel }: MatchNightPresentationProps) {
  const isResult = mode === "result";
  const winner = winnerIndex === undefined ? undefined : sides[winnerIndex];
  const isFreeForAll = sides.length > 2;

  return (
    <div className={`match-night match-night--${mode}`} role="dialog" aria-label={isResult ? "Match result presentation" : "Match introduction"}>
      <div className="match-night__beam match-night__beam--a" />
      <div className="match-night__beam match-night__beam--b" />
      <div className="match-night__scan" />
      <header className="match-night__header">
        <div className="match-night__brand"><span>TKDL</span> LIVE</div>
        <div className="match-night__strap"><Radio /> Player Walk-On</div>
        {onCancel && <button onClick={onCancel} aria-label="Cancel match"><X /></button>}
      </header>

      <main className="match-night__stage">
        {isResult && winner ? (
          <section className="match-night__result" key={winner.title}>
            <div className="match-night__result-icon"><Trophy /></div>
            <div className="match-night__kicker"><span /> Final result <span /></div>
            <small>{format} · {game}</small>
            <h1>{winner.title}</h1>
            <h2>{winner.members.length > 1 ? "Winning team" : isFreeForAll ? "Last player standing" : "Match winner"}</h2>
            {resultDetail && <p>{resultDetail}</p>}
            <div className="match-night__result-ribbon"><Award /> Victory confirmed</div>
          </section>
        ) : (
          <section className="match-night__intro">
            <div className="match-night__kicker"><span /> Enter the oche <span /></div>
            <div className="match-night__meta"><b>{format}</b><i /><span>{game}</span><i /><span>{stake} pts {stakeMode === "total" ? "total" : "each"}</span></div>
            <div className={`match-night__sides ${isFreeForAll ? "match-night__sides--ffa" : ""}`}>
              {sides.map((side, index) => (
                <div className="match-night__side-wrap" key={`${side.title}-${index}`}>
                  {!isFreeForAll && index === 1 && <div className="match-night__versus"><span>VS</span></div>}
                  <article className="match-night__side" style={{ "--side-accent": index % 2 === 0 ? "#ff005c" : "#0066ff" } as CSSProperties}>
                    <div className="match-night__side-index">{String(index + 1).padStart(2, "0")}</div>
                    {side.players?.length ? (
                      <div className="match-night__portraits">
                        {side.players.slice(0, 3).map(player => (
                          <div className="match-night__portrait" key={player.id} title={player.name}>
                            {player.avatarUpdatedAt
                              ? <img src={`/api/players/${player.id}/avatar-image?v=${encodeURIComponent(player.avatarUpdatedAt)}`} alt={player.name} />
                              : <span>{player.name.slice(0, 1).toUpperCase()}</span>}
                          </div>
                        ))}
                      </div>
                    ) : <Target />}
                    <small>{isFreeForAll ? `Player ${index + 1}` : index === 0 ? "Side A" : "Side B"}</small>
                    <h1>{side.title}</h1>
                    {side.members.length > 1 && <p>{side.members.join(" · ")}</p>}
                    {side.members.length === 1 && side.players?.[0]?.tagline && <blockquote>“{side.players[0].tagline}”</blockquote>}
                    <div className="match-night__numbers">
                      {side.points !== undefined && <span><b>{side.points}</b> points</span>}
                      {side.elo !== undefined && side.elo > 0 && <span><b>{side.elo}</b> Elo</span>}
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="match-night__footer">
        <div className="match-night__progress"><span /></div>
        <button onClick={onContinue}>{isResult ? "Match summary" : "Enter scorer now"}<ChevronRight /></button>
        <div className="match-night__bug"><Zap /> TKDL Match Centre</div>
      </footer>
    </div>
  );
}
