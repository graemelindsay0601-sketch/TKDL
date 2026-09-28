import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, CalendarDays, Clock3, Film, Play, Radio, Search, Sparkles, Trophy, X } from "lucide-react";
import { BroadcastPlayerPreview } from "./BroadcastPlayer";
import type { CurrentEdition, ProgrammeMode } from "./types";
import "./replay-library.css";

type ArchiveItem = {
  id: number;
  title: string;
  mode: ProgrammeMode;
  slotType: "midday" | "evening" | "night" | "manual";
  publishedAt: string;
  durationSeconds: number;
  segmentCount: number;
  leagueTypes: string[];
};

type Filter = "all" | "review" | "edition";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All programmes" },
  { key: "review", label: "Season Reviews" },
  { key: "edition", label: "Regular Editions" },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function ReplayLibrary({ onClose, onOpenAwards }: { onClose: () => void; onOpenAwards: () => void }) {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CurrentEdition | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [replayStartedAt, setReplayStartedAt] = useState("");
  const [episodeLoading, setEpisodeLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/broadcast/archive", { credentials: "include" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: { items: ArchiveItem[] }) => { if (!cancelled) setItems(data.items); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (filter === "review" && item.mode !== "SEASON_REVIEW") return false;
      if (filter === "edition" && item.mode === "SEASON_REVIEW") return false;
      return !needle || item.title.toLowerCase().includes(needle);
    });
  }, [filter, items, query]);

  async function playEdition(item: ArchiveItem) {
    setEpisodeLoading(true);
    try {
      const response = await fetch(`/api/broadcast/archive/${item.id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Replay unavailable");
      const data = await response.json() as { edition: CurrentEdition };
      setSelectedTitle(item.title);
      setReplayStartedAt(new Date().toISOString());
      setSelected(data.edition);
    } catch {
      setError(true);
    } finally {
      setEpisodeLoading(false);
    }
  }

  if (selected) {
    const replayEdition = { ...selected, generatedAt: replayStartedAt };
    return (
      <div className="replay-player">
        <BroadcastPlayerPreview key={`${selected.id}-${replayStartedAt}`} edition={replayEdition} />
        <div className="replay-player__bar">
          <button onClick={() => setSelected(null)}><ArrowLeft /> Library</button>
          <div><span>Now replaying</span><strong>{selectedTitle}</strong></div>
          <button onClick={onClose} aria-label="Close replay library"><X /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-library" role="dialog" aria-label="TKDL LIVE Replay Library">
      <div className="replay-library__glow replay-library__glow--pink" />
      <div className="replay-library__glow replay-library__glow--blue" />
      <header className="replay-library__header">
        <div className="replay-library__brand"><span>TKDL</span> LIVE</div>
        <div className="replay-library__label"><Film /> Replay Library</div>
        <button className="replay-library__close" onClick={onClose} aria-label="Return to TKDL LIVE"><X /></button>
      </header>

      <main className="replay-library__content">
        <section className="replay-library__hero">
          <div>
            <div className="replay-library__eyebrow"><Radio /> TKDL On Demand</div>
            <h1>Every story.<br /><em>One channel.</em></h1>
            <p>Rewatch previous editions, season specials and the moments that shaped the league.</p>
          </div>
          <button className="replay-library__awards" onClick={onOpenAwards}>
            <span><Trophy /></span>
            <small>Featured special</small>
            <strong>League Awards</strong>
            <b><Play /> Watch now</b>
          </button>
        </section>

        <section className="replay-library__browse">
          <div className="replay-library__tools">
            <div className="replay-library__filters">
              {FILTERS.map(item => <button key={item.key} className={filter === item.key ? "is-active" : ""} onClick={() => setFilter(item.key)}>{item.label}</button>)}
            </div>
            <label className="replay-library__search"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search programmes" /></label>
          </div>

          {loading ? (
            <div className="replay-library__state"><Film /><strong>Loading the archive…</strong></div>
          ) : error && items.length === 0 ? (
            <div className="replay-library__state"><Film /><strong>The archive is temporarily unavailable.</strong></div>
          ) : visible.length === 0 ? (
            <div className="replay-library__state"><Search /><strong>No programmes match that search.</strong></div>
          ) : (
            <div className="replay-library__grid">
              {visible.map((item, index) => (
                <article key={item.id} className={`replay-card ${item.mode === "SEASON_REVIEW" ? "replay-card--review" : ""}`}>
                  <div className="replay-card__visual">
                    <div className="replay-card__number">{String(index + 1).padStart(2, "0")}</div>
                    {item.mode === "SEASON_REVIEW" ? <Trophy /> : <Sparkles />}
                    <span>{item.mode === "SEASON_REVIEW" ? "Season Review" : `${item.slotType} edition`}</span>
                    <button disabled={episodeLoading} onClick={() => void playEdition(item)} aria-label={`Play ${item.title}`}><Play /></button>
                  </div>
                  <div className="replay-card__copy">
                    <h2>{item.title.replace("TKDL LIVE — ", "")}</h2>
                    <div><span><CalendarDays /> {dateLabel(item.publishedAt)}</span><span><Clock3 /> {durationLabel(item.durationSeconds)}</span><span><Award /> {item.segmentCount} stories</span></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
