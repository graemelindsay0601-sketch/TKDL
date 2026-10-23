import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown,
  FileText, Newspaper, Search, Target,
} from "lucide-react";
import "./_group.css";
import "./Rework.css";

type Story = {
  id: string;
  title: string;
  body: string;
  kind: string;
  significance: "MAJOR" | "MOMENT" | "STANDARD";
  scope: "WORLD" | "CAREER";
  season: number;
  week: number;
  date: string;
};

// Preview fixtures mirror the supplied newsroom records; no additional stories are inferred.
const stories: Story[] = [
  { id: "palace-final", title: "A deciding leg settles the Palace final", body: "A tense final reached its last leg before the champion found a clean route through the pressure and lifted the season's biggest prize.", kind: "World Championship", significance: "MAJOR", scope: "WORLD", season: 2026, week: 44, date: "23 October 2026" },
  { id: "rank-rise", title: "A run of form moves you into the top eight", body: "Back-to-back wins carried you into the upper tier of the world rankings, setting up a difficult draw at the next major.", kind: "Ranking movement", significance: "MOMENT", scope: "CAREER", season: 2026, week: 41, date: "2 October 2026" },
  { id: "nine-dart", title: "Nine perfect darts earn a place in the record", body: "The leg began with two maximums and ended with a pinpoint finish. The tournament crowd knew what was coming before the final dart landed.", kind: "Nine-darter", significance: "MAJOR", scope: "WORLD", season: 2026, week: 38, date: "11 September 2026" },
  { id: "county-night", title: "County night comes down to the final board", body: "The tie stayed level through the singles before the deciding match turned on a late break of throw and a composed finish.", kind: "County competition", significance: "STANDARD", scope: "CAREER", season: 2025, week: 29, date: "18 July 2025" },
  { id: "tour-card", title: "A first season on tour brings a breakthrough", body: "A string of deep runs across the spring calendar gave the new campaign its first real momentum and opened the door to a major stage.", kind: "Career moment", significance: "MOMENT", scope: "CAREER", season: 2025, week: 17, date: "25 April 2025" },
];

const stamp = (story: Story) => `Season ${story.season} · Week ${story.week} · ${story.date}`;
const classification = (story: Story) => story.significance === "MAJOR"
  ? "Major"
  : story.significance === "MOMENT" ? "Career moment" : story.scope === "WORLD" ? "World" : "Career";

function ArchiveArtifact() {
  return (
    <div className="nwrx-artwork" aria-label="Illustration of a preserved career press archive">
      <div className="nwrx-artwork__sheet nwrx-artwork__sheet--back" />
      <div className="nwrx-artwork__sheet nwrx-artwork__sheet--middle" />
      <div className="nwrx-folder">
        <div className="nwrx-folder__tab">CAREER FILE · 04</div>
        <div className="nwrx-folder__top"><span>TKDL CAREER ARCHIVE · 026</span></div>
        <div className="nwrx-folder__seal"><Newspaper size={25} strokeWidth={1.25} /><i>TK</i></div>
        <div className="nwrx-folder__title">THE<br />MATCH<br /><em>ARCHIVE</em></div>
        <div className="nwrx-folder__lines"><i /><i /><i /></div>
        <div className="nwrx-folder__bottom"><span>FIELD NOTES</span><b>23 / 10 / 26</b></div>
      </div>
      <div className="nwrx-artwork__clip"><span /></div>
      <div className="nwrx-artwork__index">RECORD · NO. 005</div>
      <span className="nwrx-artwork__shadow" />
    </div>
  );
}

export function Rework() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [season, setSeason] = useState("All seasons");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(stories.map((story) => story.kind))].sort(), []);
  const seasons = useMemo(() => [...new Set(stories.map((story) => story.season))].sort((a, b) => b - a), []);
  const filtered = useMemo(() => stories.filter((story) =>
    (category === "All categories" || story.kind === category) &&
    (season === "All seasons" || String(story.season) === season) &&
    (!search.trim() || `${story.title} ${story.body}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [category, season, search]);
  const selected = stories.find((story) => story.id === selectedId) ?? null;
  const resetFilters = () => { setSearch(""); setCategory("All categories"); setSeason("All seasons"); };

  return (
    <main className="nwrx-page">
      <div className="nwrx-shell">
        <header className="nwrx-topbar">
          <a className="nwrx-brand" href="#newsroom-top" aria-label="TKDL Career newsroom home">
            <span className="nwrx-brand__mark">TK</span>
            <span><b>TKDL</b><small>CAREER · DARTS WORLD</small></span>
          </a>
          <nav className="nwrx-breadcrumb" aria-label="Page location"><span>CAREER ARCHIVE</span><i>/</i><strong>NEWSROOM</strong></nav>
          <span className="nwrx-issue"><span /> PERSONAL RECORD / 04</span>
        </header>

        {selected ? (
          <article className="nwrx-article">
            <button type="button" className="nwrx-back" onClick={() => setSelectedId(null)}><ArrowLeft size={15} /> Back to newsroom</button>
            <header className="nwrx-article__head">
              <div className="nwrx-overline"><span>{classification(selected)}</span><i>·</i><span>{selected.kind}</span></div>
              <p className="nwrx-article__date"><CalendarDays size={14} />{stamp(selected)}</p>
              <h1>{selected.title}</h1>
              <p className="nwrx-article__dek">{selected.body}</p>
            </header>
            <div className="nwrx-article__body">
              <div className="nwrx-article__copy">
                <span className="nwrx-section-label">THE REPORT <i>—</i> SEASON {selected.season}</span>
                <p>{selected.body}</p>
                <p className="nwrx-article__note">This preview preserves the story fields supplied in the Career Life record. Additional callbacks and source identifiers are not included in this fixture.</p>
              </div>
              <aside className="nwrx-record-card">
                <span className="nwrx-section-label">RECORD DETAILS</span>
                <dl>
                  <div><dt>Scope</dt><dd>{selected.scope === "WORLD" ? "Darts world" : "Career"}</dd></div>
                  <div><dt>Classification</dt><dd>{classification(selected)}</dd></div>
                  <div><dt>Season / week</dt><dd>{selected.season} / {selected.week}</dd></div>
                  <div><dt>Recorded</dt><dd>{selected.date}</dd></div>
                </dl>
                <a className="nwrx-inline-link" href="#story-threads">Story threads <ArrowUpRight size={14} /></a>
              </aside>
            </div>
            <div className="nwrx-article__thread" id="story-threads">
              <span className="nwrx-thread__index">01—</span>
              <span><b>Story threads</b><small>Follow reports connected across your career record.</small></span>
              <button type="button" onClick={() => setSelectedId(null)}>Back to newsroom <ArrowLeft size={14} /></button>
            </div>
          </article>
        ) : (
          <>
            <section className="nwrx-hero" id="newsroom-top">
              <div className="nwrx-hero__copy">
                <div className="nwrx-kicker"><span className="nwrx-kicker__rule" />THE PERSONAL CAREER ARCHIVE</div>
                <p className="nwrx-hero__eyebrow">Darts World · Newsroom</p>
                <h1>On the<br /><em>record.</em></h1>
                <p className="nwrx-hero__deck">The moments that moved a career. The stories that shaped the game. Kept here, with the record intact.</p>
                <div className="nwrx-hero__foot"><span><FileText size={14} /> YOUR CAREER, ON FILE</span><span>ISSUE 04 <i>·</i> 2026</span></div>
              </div>
              <ArchiveArtifact />
              <div className="nwrx-hero__folio"><span>ARCHIVE</span><b>{String(stories.length).padStart(2, "0")}</b><small>STORIES<br />PRESERVED</small></div>
            </section>

            <section className="nwrx-edition" aria-label="Newsroom edition">
              <div className="nwrx-edition__label"><Newspaper size={16} /><span>THE NEWSROOM</span></div>
              <p><strong>{stories.length}</strong> recorded stories <i>·</i> from your career and the world around it</p>
              <a href="#story-threads">Story threads <ArrowUpRight size={15} /></a>
            </section>

            <section className="nwrx-content" aria-label="Career newsroom">
              <div className="nwrx-content__heading">
                <div><span className="nwrx-section-label">THE ARCHIVE <i>/</i> LATEST EDITION</span><h2>Latest reports</h2></div>
                <span className="nwrx-count"><b>{String(filtered.length).padStart(2, "0")}</b> IN VIEW</span>
              </div>
              <div className="nwrx-filters" role="search" aria-label="Filter newsroom stories">
                <label className="nwrx-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search headlines and reports</span><input type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search headlines and reports" /></label>
                <label className="nwrx-select"><span>CATEGORY</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.currentTarget.value)}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
                <label className="nwrx-select"><span>SEASON</span><select aria-label="Filter by season" value={season} onChange={(event) => setSeason(event.currentTarget.value)}><option>All seasons</option>{seasons.map((item) => <option key={item} value={item}>Season {item}</option>)}</select><ChevronDown size={14} /></label>
              </div>

              <div className="nwrx-columns">
                <div className="nwrx-report-list" aria-live="polite">
                  {filtered.length ? filtered.map((story, index) => (
                    <button type="button" className={`nwrx-report${index === 0 ? " is-lead" : ""}`} key={story.id} onClick={() => setSelectedId(story.id)} aria-label={`Read story: ${story.title}`}>
                      <span className="nwrx-report__index">{String(index + 1).padStart(2, "0")}<i /></span>
                      <span className="nwrx-report__main">
                        <span className="nwrx-tags"><i className={`nwrx-tag${story.significance === "MAJOR" ? " is-major" : story.significance === "MOMENT" ? " is-moment" : ""}`}>{classification(story)}</i><i className="nwrx-tag">{story.kind}</i></span>
                        <strong>{story.title}</strong><span className="nwrx-report__dek">{story.body}</span>
                        <span className="nwrx-report__date"><CalendarDays size={13} />{stamp(story)}</span>
                      </span><ArrowRight className="nwrx-report__arrow" size={17} aria-hidden="true" />
                    </button>
                  )) : (
                    <div className="nwrx-empty" role="status">
                      <span><Search size={17} /></span><h3>{stories.length ? "No reports match these filters" : "The record is quiet"}</h3>
                      <p>{stories.length ? "Try another category, season or search term." : "New stories appear only when the career record supplies them."}</p>
                      {stories.length > 0 && <button type="button" onClick={resetFilters}>Clear filters</button>}
                    </div>
                  )}
                </div>

                <aside className="nwrx-rail" aria-label="About this archive">
                  <div className="nwrx-rail__heading"><span><Target size={17} /></span><h3>Evidence first</h3></div>
                  <p>Headlines and story details are drawn from this save’s Life story record. Filters only organise stories already returned.</p>
                  <div className="nwrx-rail__edition"><span>IN THIS EDITION</span><strong>{filtered.length}<i> / </i>{stories.length}</strong><small>recorded stories match your view</small></div>
                  <div className="nwrx-recent"><span className="nwrx-section-label">RECENTLY RECORDED</span>
                    {stories.slice(0, 3).map((story) => <button type="button" key={story.id} onClick={() => setSelectedId(story.id)}><b>{story.title}</b><small>{stamp(story)}</small></button>)}
                  </div>
                  <div className="nwrx-thread" id="story-threads">
                    <span className="nwrx-thread__index">01—</span><span><b>Story threads</b><small>Follow reports connected across your career record.</small></span><ArrowUpRight size={15} />
                  </div>
                </aside>
              </div>
            </section>
            <footer className="nwrx-footer"><span>TKDL <i>×</i> DARTS WORLD</span><p>The throw fades. The record stays.</p><span>PERSONAL ARCHIVE <b>·</b> {stories.length} ENTRIES</span></footer>
          </>
        )}
        {selected && <footer className="nwrx-footer"><span>TKDL <i>×</i> DARTS WORLD</span><p>The throw fades. The record stays.</p><button type="button" onClick={() => setSelectedId(null)}>ALL REPORTS <ArrowLeft size={13} /></button></footer>}
      </div>
    </main>
  );
}
