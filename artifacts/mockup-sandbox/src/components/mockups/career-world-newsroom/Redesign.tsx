import { useMemo, useState } from "react";
import {
  ArrowUpRight, CalendarDays, ChevronDown, CircleDot, FileText,
  Newspaper, Search, Target,
} from "lucide-react";
import "./_group.css";
import "./Redesign.css";
import "./Redesign.css";

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

const stories: Story[] = [
  { id: "palace-final", title: "A deciding leg settles the Palace final", body: "A tense final reached its last leg before the champion found a clean route through the pressure and lifted the season's biggest prize.", kind: "World Championship", significance: "MAJOR", scope: "WORLD", season: 2026, week: 44, date: "23 October 2026" },
  { id: "rank-rise", title: "A run of form moves you into the top eight", body: "Back-to-back wins carried you into the upper tier of the world rankings, setting up a difficult draw at the next major.", kind: "Ranking movement", significance: "MOMENT", scope: "CAREER", season: 2026, week: 41, date: "2 October 2026" },
  { id: "nine-dart", title: "Nine perfect darts earn a place in the record", body: "The leg began with two maximums and ended with a pinpoint finish. The tournament crowd knew what was coming before the final dart landed.", kind: "Nine-darter", significance: "MAJOR", scope: "WORLD", season: 2026, week: 38, date: "11 September 2026" },
  { id: "county-night", title: "County night comes down to the final board", body: "The tie stayed level through the singles before the deciding match turned on a late break of throw and a composed finish.", kind: "County competition", significance: "STANDARD", scope: "CAREER", season: 2025, week: 29, date: "18 July 2025" },
  { id: "tour-card", title: "A first season on tour brings a breakthrough", body: "A string of deep runs across the spring calendar gave the new campaign its first real momentum and opened the door to a major stage.", kind: "Career moment", significance: "MOMENT", scope: "CAREER", season: 2025, week: 17, date: "25 April 2025" },
];

const stamp = (story: Story) => `Season ${story.season} · Week ${story.week} · ${story.date}`;
const classification = (story: Story) => story.significance === "MAJOR" ? "Major" : story.significance === "MOMENT" ? "Career moment" : story.scope === "WORLD" ? "World" : "Career";

function PressMark() {
  return <div className="nwr-mark" aria-hidden="true">
    <span className="nwr-mark__outer" /><span className="nwr-mark__wire" />
    <span className="nwr-mark__inner" /><span className="nwr-mark__bull" />
    <span className="nwr-mark__dart"><i /></span>
    <b>DW</b>
  </div>;
}

export function Redesign() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [season, setSeason] = useState("All seasons");
  const [selected, setSelected] = useState<Story | null>(null);
  const categories = useMemo(() => [...new Set(stories.map((story) => story.kind))].sort(), []);
  const seasons = useMemo(() => [...new Set(stories.map((story) => story.season))].sort((a, b) => b - a), []);
  const filtered = useMemo(() => stories.filter((story) =>
    (category === "All categories" || story.kind === category) &&
    (season === "All seasons" || String(story.season) === season) &&
    (!search.trim() || `${story.title} ${story.body}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [category, season, search]);
  const resetFilters = () => { setSearch(""); setCategory("All categories"); setSeason("All seasons"); };

  return <main className="nwr-page">
    <div className="nwr-shell">
      <header className="nwr-topbar">
        <div className="nwr-brand"><span className="nwr-brand__crest"><Target size={17} /></span><span><b>TKDL</b><small>CAREER · DARTS WORLD</small></span></div>
        <div className="nwr-breadcrumb">CAREER ARCHIVE <i>/</i> <strong>NEWSROOM</strong></div>
        <span className="nwr-edition"><CircleDot size={11} /> THE RECORD, KEPT</span>
      </header>

      <section className="nwr-hero">
        <div className="nwr-hero__copy">
          <div className="nwr-kicker"><span /> DARTS WORLD JOURNAL <i>—</i> YOUR CAREER, ON FILE</div>
          <h1>On the<br /><em>record.</em></h1>
          <p>Reports from your career and the world around it. Every headline belongs to this save.</p>
          <div className="nwr-hero__bottom">
            <span><FileText size={13} /> PERSONAL PRESS ARCHIVE</span>
            <span>SEASON 2026 <i>·</i> VOL. 04</span>
          </div>
        </div>
        <div className="nwr-cover-art" aria-hidden="true">
          <div className="nwr-cover-art__grid" />
          <PressMark />
          <span className="nwr-cover-art__caption">THE THROW<br />BECOMES THE STORY</span>
          <span className="nwr-cover-art__folio">TK / 026</span>
        </div>
        <div className="nwr-stamp">
          <span>ARCHIVE</span><b>{String(stories.length).padStart(2, "0")}</b><small>RECORDED<br />STORIES</small>
        </div>
      </section>

      <section className="nwr-record" aria-label="Newsroom records">
        <div className="nwr-record__label"><Newspaper size={15} /><span>THE NEWSROOM</span></div>
        <strong>{stories.length}<small>stories on record</small></strong>
        <a className="nwr-thread-link" href="#story-threads"><span>STORY THREADS</span><ArrowUpRight size={15} /></a>
      </section>

      <section className="nwr-content" aria-label="Career newsroom">
        <div className="nwr-content__head">
          <div><span className="nwr-section-kicker">THE ARCHIVE <i> / </i> LATEST EDITION</span><h2>Latest reports</h2></div>
          <span className="nwr-result-count"><b>{filtered.length.toString().padStart(2, "0")}</b> SHOWN</span>
        </div>
        <div className="nwr-toolbar" role="search" aria-label="Filter the newsroom">
          <label className="nwr-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Find a story</span>
            <input type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search headlines and reports" />
            <kbd>FIND</kbd>
          </label>
          <label className="nwr-select"><span>CATEGORY</span><select value={category} onChange={(event) => setCategory(event.currentTarget.value)}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
          <label className="nwr-select"><span>SEASON</span><select value={season} onChange={(event) => setSeason(event.currentTarget.value)}><option>All seasons</option>{seasons.map((item) => <option key={item} value={item}>Season {item}</option>)}</select><ChevronDown size={13} /></label>
        </div>

        <div className="nwr-columns">
          <div className="nwr-report-list" aria-live="polite">
            {filtered.length ? filtered.map((story, index) =>
              <button className={`nwr-report${index === 0 ? " is-lead" : ""}${selected?.id === story.id ? " is-selected" : ""}`} key={story.id} type="button" onClick={() => setSelected(selected?.id === story.id ? null : story)}>
                <span className="nwr-report__number">{String(index + 1).padStart(2, "0")}<i /></span>
                <span className="nwr-report__main">
                  <span className="nwr-tags"><i className={`nwr-tag ${story.significance === "MAJOR" ? "is-major" : story.significance === "MOMENT" ? "is-moment" : ""}`}>{classification(story)}</i><i className="nwr-tag">{story.kind}</i></span>
                  <strong>{story.title}</strong>
                  <span className="nwr-report__dek">{story.body}</span>
                  <span className="nwr-report__date"><CalendarDays size={12} />{stamp(story)}</span>
                </span>
                <ArrowUpRight className="nwr-report__arrow" size={17} aria-hidden="true" />
              </button>
            ) : <div className="nwr-empty" role="status">
              <span className="nwr-empty__mark"><Search size={18} /></span>
              <h3>{stories.length ? "No reports match this search" : "The record is quiet"}</h3>
              <p>{stories.length ? "Try another category, season or search term." : "New reports appear only when the Career record supplies them."}</p>
              {stories.length > 0 && <button type="button" onClick={resetFilters}>Clear filters</button>}
            </div>}
          </div>

          <aside className="nwr-side">
            <div className="nwr-side__heading"><span className="nwr-side__icon"><Newspaper size={15} /></span><h3>Evidence first</h3></div>
            <p>Headlines, story threads and source references are drawn from this save’s Life story record. Filters only organise stories already returned.</p>
            <div className="nwr-edition-count"><span>IN THIS EDITION</span><strong>{filtered.length} <i>of</i> {stories.length}</strong><small>recorded stories match your view</small></div>
            <div className="nwr-side__recent">
              <span className="nwr-side__label">RECENTLY RECORDED</span>
              {stories.slice(0, 3).map((story) => <button type="button" key={story.id} onClick={() => setSelected(story)}><span>{story.title}</span><small>{stamp(story)}</small></button>)}
            </div>
            {selected && <div className="nwr-evidence" aria-live="polite">
              <span className="nwr-side__label">RECORD CONTEXT</span>
              <strong>{selected.title}</strong>
              <p>{selected.body}</p>
              <small>{selected.scope.toLowerCase()} report · {classification(selected)} · {stamp(selected)}</small>
            </div>}
            <a id="story-threads" className="nwr-thread-card" href="#story-threads"><span className="nwr-thread-card__glyph">01—</span><span><b>Story threads</b><small>Follow reports connected across your career record.</small></span><ArrowUpRight size={15} /></a>
          </aside>
        </div>
      </section>

      <footer className="nwr-footer"><span>TKDL <i>×</i> DARTS WORLD</span><p>The throw fades. The record stays.</p><span>PERSONAL ARCHIVE <b>·</b> {stories.length} ENTRIES</span></footer>
    </div>
  </main>;
}
