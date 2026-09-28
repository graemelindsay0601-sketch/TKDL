import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Award, ChevronLeft, ChevronRight, Crown, Pause, Play, Target, Trophy, Users, X } from "lucide-react";
import "./league-awards-show.css";
import { ShareCardButton } from "@/components/ShareCardButton";

type LeagueType = "singles" | "doubles" | "shift_wars";

type Season = {
  id: number;
  name: string;
  isActive: boolean;
  championName: string | null;
  leagueType: LeagueType;
  endDate: string | null;
};

type Standing = {
  playerId: number;
  playerName: string;
  position: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  points: number;
};

type SeasonMatch = {
  winnerId: number;
  winnerName: string;
  loserId: number;
  loserName: string;
  stake: number;
  wasUpsetWin: boolean;
  winner180s: number | null;
  loser180s: number | null;
};

type AwardCard = {
  key: string;
  title: string;
  recipient: string;
  stat: string;
  detail: string;
  accent: string;
  icon: "crown" | "trophy" | "target" | "award";
};

const LEAGUES: Array<{ key: LeagueType; label: string; accent: string }> = [
  { key: "singles", label: "Singles", accent: "#ff005c" },
  { key: "doubles", label: "Doubles", accent: "#0066ff" },
  { key: "shift_wars", label: "Shift Wars", accent: "#ffd24a" },
];

function countBy(matches: SeasonMatch[], predicate: (match: SeasonMatch) => boolean) {
  const totals = new Map<string, number>();
  for (const match of matches) {
    if (!predicate(match)) continue;
    totals.set(match.winnerName, (totals.get(match.winnerName) ?? 0) + 1);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
}

function buildAwards(season: Season, standings: Standing[], matches: SeasonMatch[]): AwardCard[] {
  const ordered = [...standings].sort((a, b) => a.position - b.position);
  const champion = season.championName ?? ordered[0]?.playerName;
  const mostWins = [...standings].sort((a, b) => b.wins - a.wins || a.position - b.position)[0];
  const mostActive = [...standings].sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.wins - a.wins)[0];
  const upsetLeader = countBy(matches, match => match.wasUpsetWin);
  const highRoller = [...matches].sort((a, b) => b.stake - a.stake)[0];

  const maximums = new Map<string, number>();
  for (const match of matches) {
    maximums.set(match.winnerName, (maximums.get(match.winnerName) ?? 0) + (match.winner180s ?? 0));
    maximums.set(match.loserName, (maximums.get(match.loserName) ?? 0) + (match.loser180s ?? 0));
  }
  const maxLeader = [...maximums.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    champion && {
      key: "champion",
      title: "League Champion",
      recipient: champion,
      stat: season.name,
      detail: "The name at the top when the final dart landed.",
      accent: "#ffd24a",
      icon: "crown" as const,
    },
    mostWins && {
      key: "wins",
      title: "Winning Machine",
      recipient: mostWins.playerName,
      stat: `${mostWins.wins} wins`,
      detail: "The most match victories recorded across the season.",
      accent: "#ff005c",
      icon: "trophy" as const,
    },
    upsetLeader && {
      key: "upsets",
      title: "Giant Killer",
      recipient: upsetLeader[0],
      stat: `${upsetLeader[1]} upset win${upsetLeader[1] === 1 ? "" : "s"}`,
      detail: "The player who overturned the odds most often.",
      accent: "#8b5cf6",
      icon: "target" as const,
    },
    highRoller && highRoller.stake > 0 && {
      key: "wager",
      title: "Big-Match Player",
      recipient: highRoller.winnerName,
      stat: `${highRoller.stake} point wager`,
      detail: `Held their nerve against ${highRoller.loserName} in the season's biggest recorded wager.`,
      accent: "#0066ff",
      icon: "award" as const,
    },
    mostActive && {
      key: "active",
      title: "Ever Present",
      recipient: mostActive.playerName,
      stat: `${mostActive.gamesPlayed} matches`,
      detail: "The busiest player on the oche this season.",
      accent: "#22c55e",
      icon: "award" as const,
    },
    maxLeader && maxLeader[1] > 0 && {
      key: "maximums",
      title: "Maximum Power",
      recipient: maxLeader[0],
      stat: `${maxLeader[1]} maximum${maxLeader[1] === 1 ? "" : "s"}`,
      detail: "The season leader for recorded 180s.",
      accent: "#f97316",
      icon: "target" as const,
    },
  ].filter((award): award is AwardCard => Boolean(award));
}

function AwardIcon({ kind }: { kind: AwardCard["icon"] }) {
  if (kind === "crown") return <Crown />;
  if (kind === "target") return <Target />;
  if (kind === "trophy") return <Trophy />;
  return <Award />;
}

export function LeagueAwardsShow({ onClose }: { onClose: () => void }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [singlesStandings, setSinglesStandings] = useState<Standing[]>([]);
  const [singlesMatches, setSinglesMatches] = useState<SeasonMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const seasonLists = await Promise.all(
          LEAGUES.map(({ key }) => fetch(`/api/seasons?leagueType=${key}`).then(response => {
            if (!response.ok) throw new Error("Could not load seasons");
            return response.json() as Promise<Season[]>;
          })),
        );
        const latestClosed = seasonLists.map(list => list.find(season => !season.isActive) ?? list[0]).filter(Boolean) as Season[];
        const singles = latestClosed.find(season => season.leagueType === "singles");
        let standings: Standing[] = [];
        let matches: SeasonMatch[] = [];
        if (singles) {
          const [detailResponse, matchesResponse] = await Promise.all([
            fetch(`/api/seasons/${singles.id}`),
            fetch(`/api/seasons/${singles.id}/matches`),
          ]);
          if (detailResponse.ok) standings = ((await detailResponse.json()) as { standings: Standing[] }).standings;
          if (matchesResponse.ok) matches = await matchesResponse.json() as SeasonMatch[];
        }
        if (!cancelled) {
          setSeasons(latestClosed);
          setSinglesStandings(standings);
          setSinglesMatches(matches);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const singlesSeason = seasons.find(season => season.leagueType === "singles");
  const awards = useMemo(
    () => singlesSeason ? buildAwards(singlesSeason, singlesStandings, singlesMatches) : [],
    [singlesSeason, singlesStandings, singlesMatches],
  );
  const slides = 1 + awards.length;
  const currentAward = slide > 0 ? awards[slide - 1] : null;
  const shareSpec = currentAward ? {
    eyebrow: currentAward.title,
    title: currentAward.recipient,
    subtitle: currentAward.detail,
    badge: "League Award",
    accent: currentAward.accent,
    stats: [{ label: "Award", value: currentAward.title }, { label: "Winning mark", value: currentAward.stat }, { label: "Season", value: singlesSeason?.name ?? "TKDL" }],
    footer: "TKDL League Awards",
  } : {
    eyebrow: "End of Season Special",
    title: "League Awards",
    subtitle: "Celebrating the champions across TKDL.",
    badge: "TKDL Live",
    accent: "#ffd24a",
    secondaryAccent: "#ff005c",
    stats: LEAGUES.slice(0, 3).map(league => ({ label: league.label, value: seasons.find(item => item.leagueType === league.key)?.championName ?? "To be crowned" })),
  };

  useEffect(() => {
    if (!playing || slides <= 1) return;
    const timer = window.setInterval(() => setSlide(current => (current + 1) % slides), 7000);
    return () => window.clearInterval(timer);
  }, [playing, slides]);

  useEffect(() => {
    if (slide >= slides) setSlide(0);
  }, [slide, slides]);

  const move = (direction: number) => {
    setSlide(current => (current + direction + slides) % slides);
    setPlaying(false);
  };

  return (
    <div className="league-awards" role="dialog" aria-label="TKDL League Awards">
      <div className="league-awards__spotlight league-awards__spotlight--left" />
      <div className="league-awards__spotlight league-awards__spotlight--right" />
      <div className="league-awards__grid" />

      <header className="league-awards__header">
        <div className="league-awards__brand"><span>TKDL</span> LIVE</div>
        <div className="league-awards__programme"><Award size={15} /> League Awards</div>
        <button className="league-awards__close" onClick={onClose} aria-label="Return to TKDL LIVE"><X /></button>
      </header>

      {loading ? (
        <div className="league-awards__state"><Trophy className="league-awards__loading" /><strong>Preparing the ceremony…</strong></div>
      ) : error || seasons.length === 0 ? (
        <div className="league-awards__state"><Trophy /><strong>The awards room is being prepared.</strong><span>Completed season results will appear here.</span></div>
      ) : (
        <main className="league-awards__stage">
          {slide === 0 ? (
            <section className="league-awards__intro">
              <div className="league-awards__eyebrow"><span /> End of season special <span /></div>
              <h1>League <em>Awards</em></h1>
              <p className="league-awards__lead">Celebrating the champions and standout performances across TKDL.</p>
              <div className="league-awards__champions">
                {LEAGUES.map(league => {
                  const season = seasons.find(item => item.leagueType === league.key);
                  return (
                    <article key={league.key} className="league-awards__champion" style={{ "--league-accent": league.accent } as CSSProperties}>
                      <div className="league-awards__champion-top"><span>{league.label}</span><Crown /></div>
                      <strong>{season?.championName ?? "To be crowned"}</strong>
                      <small>{season?.name ?? "Current season"}</small>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <AwardSlide award={awards[slide - 1]} seasonName={singlesSeason?.name ?? "League season"} />
          )}
        </main>
      )}

      {!loading && !error && seasons.length > 0 && (
        <footer className="league-awards__controls">
          <div className="league-awards__share">
            <ShareCardButton spec={shareSpec} filename={currentAward ? `tkdl-award-${currentAward.recipient}` : "tkdl-league-awards"} label="Share" />
          </div>
          <button onClick={() => move(-1)} aria-label="Previous award"><ChevronLeft /></button>
          <div className="league-awards__progress">
            {Array.from({ length: slides }, (_, index) => (
              <button key={index} className={index === slide ? "is-active" : ""} onClick={() => { setSlide(index); setPlaying(false); }} aria-label={`Show awards slide ${index + 1}`} />
            ))}
          </div>
          <button onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause awards show" : "Play awards show"}>{playing ? <Pause /> : <Play />}</button>
          <button onClick={() => move(1)} aria-label="Next award"><ChevronRight /></button>
        </footer>
      )}

      <div className="league-awards__bug"><span>Season Review</span><Users size={14} /> TKDL</div>
    </div>
  );
}

function AwardSlide({ award, seasonName }: { award: AwardCard; seasonName: string }) {
  return (
    <section className="league-awards__award" key={award.key} style={{ "--award-accent": award.accent } as CSSProperties}>
      <div className="league-awards__award-number">TKDL / {seasonName}</div>
      <div className="league-awards__award-icon"><AwardIcon kind={award.icon} /></div>
      <div className="league-awards__award-copy">
        <div className="league-awards__eyebrow"><span /> League award <span /></div>
        <h2>{award.title}</h2>
        <h3>{award.recipient}</h3>
        <div className="league-awards__stat">{award.stat}</div>
        <p>{award.detail}</p>
      </div>
      <div className="league-awards__winner-stamp"><Crown /> Winner</div>
    </section>
  );
}
