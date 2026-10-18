import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Newspaper } from "lucide-react";
import { useCareerLife, useCareerRelationships, useWorldPlayers } from "../api";
import { CareerSection } from "../components";
import type { ShellContext } from "../shell";
import type { Story } from "../../../../../api-server/src/career/life/types";
import "./newsroom.css";
import { PLATES } from "../atmosphere";

type NewsroomProps = { ctx: ShellContext };

const storyStamp = (story: Story) => [
  `Season ${story.season}`,
  story.week === null ? null : `Week ${story.week}`,
  story.date,
].filter(Boolean).join(" · ");

const classification = (story: Story) => story.significance === "MAJOR"
  ? "Major"
  : story.significance === "MOMENT" ? "Career moment" : story.scope === "WORLD" ? "World" : "Career";

const storyCategory = (story: Story) => {
  const kind = story.kind.replaceAll("_", " ").toLowerCase();
  return kind ? kind.replace(/\b\w/g, letter => letter.toUpperCase()) : "News";
};

function flattenStories(data: { news: Story[]; threads: { stories: Story[] }[] }) {
  const byId = new Map<string, Story>();
  [...data.news, ...data.threads.flatMap(thread => thread.stories)].forEach(story => byId.set(story.id, story));
  return [...byId.values()].sort((a, b) => b.season - a.season || (b.week ?? -1) - (a.week ?? -1) || a.title.localeCompare(b.title));
}

export function NewsroomPage({ ctx }: NewsroomProps) {
  const life = useCareerLife(ctx.save.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [season, setSeason] = useState("All seasons");
  const [visibleCount, setVisibleCount] = useState(12);

  const stories = useMemo(() => life.data ? flattenStories(life.data) : [], [life.data]);
  const categories = useMemo(() => [...new Set(stories.map(storyCategory))].sort(), [stories]);
  const seasons = useMemo(() => [...new Set(stories.map(story => story.season))].sort((a, b) => b - a), [stories]);
  const selected = stories.find(story => story.id === selectedId) ?? null;
  const filtered = stories.filter(story =>
    (category === "All categories" || storyCategory(story) === category) &&
    (season === "All seasons" || String(story.season) === season) &&
    (!search.trim() || `${story.title} ${story.body} ${story.callbacks.map(callback => callback.text).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return <CareerSection title="Darts World · Newsroom">
    <div className="tkdl-newsroom">
      <div className="px-3 sm:px-4">
        {selected && <button type="button" className="news-action mb-3" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={15} aria-hidden /> Back to newsroom
        </button>}
        {selected ? <StoryArticle ctx={ctx} storyId={selected.id} onBack={() => setSelectedId(null)} /> : <>
          <header className="news-masthead">
            <div className="news-kicker">TKDL Career · Darts World</div>
            <h1>On the record.</h1>
            <p>News from your career and the darts world around you.</p>
            <div className="news-rule" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="news-meta">{life.data ? `${stories.length} recorded ${stories.length === 1 ? "story" : "stories"}` : "Career Life feed"}</span>
              <Link className="news-action" href={`/career/${ctx.save.id}/stories`}>Story threads <ArrowUpRight size={14} aria-hidden /></Link>
            </div>
          </header>

          <div className="news-toolbar" role="search" aria-label="Filter the newsroom">
            <label className="news-filter-label">Find a story
              <input className="news-filter" type="search" maxLength={100} value={search} onChange={event => setSearch(event.currentTarget.value)} placeholder="Search headlines and reports" />
            </label>
            <div className="news-filter-row">
              <label className="news-filter-label">Category
                <select className="news-filter" value={category} onChange={event => setCategory(event.currentTarget.value)}>
                  <option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="news-filter-label">Season
                <select className="news-filter" value={season} onChange={event => setSeason(event.currentTarget.value)}>
                  <option>All seasons</option>{seasons.map(item => <option key={item} value={item}>Season {item}</option>)}
                </select>
              </label>
            </div>
          </div>

          {life.isLoading && <NewsLoading />}
          {!life.isLoading && life.error && <div className="news-status" role="alert">
            <h2 className="font-bold">The newsroom is unavailable</h2>
            <p className="my-2 text-sm">Career Life could not be read. Stories are not shown from a substitute source.</p>
            <button type="button" className="news-action" onClick={() => void life.refetch()}>Retry newsroom</button>
          </div>}
          {!life.isLoading && !life.error && life.data && <div className="news-layout">
            <main className="news-main-column" aria-live="polite">
              <div className="news-section-heading"><h2>Latest reports</h2><span>{filtered.length} shown</span></div>
              {filtered.length ? <div className="news-story-list">
                {filtered.slice(0, visibleCount).map((story, index) => <Link key={story.id} href={`/career/${ctx.save.id}/world/news/${encodeURIComponent(story.id)}`} className={`news-story ${index === 0 ? "news-story--lead" : ""}`}
                  aria-label={`Read story: ${story.title}`}>
                  <div className="news-story-tags">
                    <span className={`news-tag ${story.significance === "MAJOR" ? "news-tag--major" : story.significance === "MOMENT" ? "news-tag--moment" : ""}`}>{classification(story)}</span>
                    <span className="news-tag">{storyCategory(story)}</span>
                  </div>
                  <h3>{story.title}</h3>
                  <p>{story.body}</p>
                  <span className="news-meta">{storyStamp(story)}</span>
                </Link>)}
              </div> : <div className="news-empty mt-3" role="status">
                <h2>{stories.length ? "No reports match these filters" : "The record is quiet"}</h2>
                <p>{stories.length ? "Try another category, season or search." : "Career Life has not returned any newsroom stories for this save yet. New reports appear only when the Career record supplies them."}</p>
                {stories.length > 0 && <button className="news-action mt-3" type="button" onClick={() => { setSearch(""); setCategory("All categories"); setSeason("All seasons"); }}>Clear filters</button>}
              </div>}
              {filtered.length > visibleCount && <button type="button" className="news-action mt-3" onClick={() => setVisibleCount(count => Math.min(count + 12, filtered.length))} aria-label={`Show ${Math.min(12, filtered.length - visibleCount)} more reports`}>
                Show more reports ({filtered.length - visibleCount} remaining)
              </button>}
            </main>
            <aside className="news-rail" aria-label="About the newsroom">
              <div className="flex items-center gap-2"><Newspaper size={17} aria-hidden /><h2>Evidence first</h2></div>
              <p>Headlines, story threads and source references are drawn from this save’s Life story record. Filters only organise the stories already returned.</p>
              <div className="news-rail-item"><span>IN THIS EDITION</span><p className="mb-0">{filtered.length} of {stories.length} recorded stories match your view.</p></div>
              {stories.slice(0, 3).map(story => <div className="news-rail-item" key={story.id}>
                <button type="button" onClick={() => setSelectedId(story.id)}>{story.title}</button>
                <span>{storyStamp(story)}</span>
              </div>)}
            </aside>
          </div>}
        </>}
      </div>
    </div>
  </CareerSection>;
}

export function StoryArticle({ ctx, storyId, onBack }: { ctx: ShellContext; storyId: string; onBack?: () => void }) {
  const life = useCareerLife(ctx.save.id);
  const story = life.data ? flattenStories(life.data).find(item => item.id === storyId) : undefined;

  if (life.isLoading) return <ArticleLoading />;
  if (life.error) return <div className="news-status" role="alert"><h2 className="font-bold">Article unavailable</h2><p className="my-2 text-sm">The Life story record could not be read.</p><button type="button" className="news-action" onClick={() => void life.refetch()}>Retry article</button></div>;
  if (!story) return <div className="news-empty" role="status"><h2>Story not found</h2><p>This article is available only when its story id is present in the current Career Life response.</p>{onBack && <button type="button" className="news-action mt-3" onClick={onBack}>Return to newsroom</button>}</div>;

  const callbackTexts = story.callbacks.filter(callback => callback.text.trim());
  const sourceIds = [...new Set([...story.sourceIds, ...story.callbacks.flatMap(callback => callback.sourceIds)])];
  const article = <article className="news-article">
    <header className="news-article-top">
      <img className="news-article-plate" src={(PLATES[story.scope === "WORLD" ? "small-arena" : story.opponentId ? "studio" : "pub-club"] ?? PLATES.neutral).src} alt="" aria-hidden="true" loading="lazy" />
      <div className="news-story-tags">
        <span className={`news-tag ${story.significance === "MAJOR" ? "news-tag--major" : story.significance === "MOMENT" ? "news-tag--moment" : ""}`}>{classification(story)}</span>
        <span className="news-tag">{storyCategory(story)}</span>
      </div>
      <div className="news-meta">{storyStamp(story)}</div>
      <h1 className="news-article-title">{story.title}</h1>
      <p className="news-article-deck">{story.body}</p>
      <div className="news-actions">
        {onBack && <button type="button" className="news-action" onClick={onBack}><ArrowLeft size={14} aria-hidden /> All reports</button>}
        {story.eventId && <Link className="news-action" href={`/career/${ctx.save.id}/events/${encodeURIComponent(story.eventId)}`}>Open source event <ArrowUpRight size={14} aria-hidden /></Link>}
      </div>
    </header>
    <div className="news-article-body">
      <div className="news-article-copy">
        <p>{story.body}</p>
        {callbackTexts.map((callback, index) => <p key={`${story.id}-callback-${index}`}>{callback.text}</p>)}
        {!callbackTexts.length && <p className="text-sm">This report contains no further story callback in the returned record.</p>}
      </div>
      <aside className="news-article-side" aria-label="Article evidence">
        <h2>Record & context</h2>
        <p><strong>Story scope</strong><br />{story.scope.toLowerCase()}</p>
        <p><strong>Significance</strong><br />{story.significance.toLowerCase()}</p>
        <p><strong>Season / week</strong><br />Season {story.season}{story.week === null ? "" : ` · Week ${story.week}`}{story.day === null ? "" : ` · Day ${story.day}`}</p>
        {story.thread && <p><strong>Story thread</strong><br />{story.thread}</p>}
        {story.opponentId && <OpponentEvidence ctx={ctx} opponentId={story.opponentId} />}
        <h2 className="mt-4">Source references</h2>
        {sourceIds.length ? <ul className="news-source-list">{sourceIds.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul> : <p>No source identifiers were supplied with this story.</p>}
      </aside>
    </div>
  </article>;
  if (onBack) return article;
  // Opened directly (/world/news/:id): give the article the newsroom's own page and a way back to it.
  return <CareerSection title="Darts World · Newsroom" icon={<Newspaper size={15} aria-hidden />} accent="#d1a65c">
    <div className="tkdl-newsroom"><div className="px-3 sm:px-4">
      <Link className="news-action mb-3" href={`/career/${ctx.save.id}/world/news`}><ArrowLeft size={15} aria-hidden /> Back to newsroom</Link>
      {article}
    </div></div>
  </CareerSection>;
}

function OpponentEvidence({ ctx, opponentId }: { ctx: ShellContext; opponentId: string }) {
  const opponent = useWorldPlayers(ctx.save.id, 0, "", "ALL", opponentId);
  const relationships = useCareerRelationships(ctx.save.id);
  const knownOpponent = opponent.data?.players.find(player => player.id === opponentId);
  const relationship = relationships.data?.opponents.find(item => item.player.id === opponentId);
  return <div>
    <p><strong>Opponent record</strong></p>
    {opponent.isLoading && <p role="status">Checking known player identity…</p>}
    {knownOpponent && <>
      <p>{knownOpponent.name}{relationship ? ` · played ${relationship.meetings} time${relationship.meetings === 1 ? "" : "s"}` : ""}</p>
      <Link className="news-action" href={`/career/${ctx.save.id}/recognition/npcs/${encodeURIComponent(knownOpponent.id)}`}>Opponent profile <ArrowUpRight size={14} aria-hidden /></Link>
    </>}
    {!opponent.isLoading && opponent.error && <p role="status">Opponent route not linked: identity could not be confirmed.</p>}
    {!opponent.isLoading && !opponent.error && !knownOpponent && <p>Opponent identity is not present in the known player directory; no profile link is shown.</p>}
    {relationships.error && <p role="status">Played relationship context is temporarily unavailable.</p>}
  </div>;
}

function NewsLoading() {
  return <div className="news-skeleton" role="status" aria-label="Loading Career Life stories">
    <span className="sr-only">Loading the newsroom</span><div className="news-skeleton-block" /><div className="news-skeleton-block" />
  </div>;
}

function ArticleLoading() {
  return <div className="news-article news-status" role="status" aria-label="Loading article">
    <div className="news-skeleton"><span className="sr-only">Loading article</span><div className="news-skeleton-block" /></div>
  </div>;
}
