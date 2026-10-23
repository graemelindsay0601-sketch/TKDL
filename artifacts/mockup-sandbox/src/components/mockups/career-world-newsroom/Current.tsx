import { useMemo, useState } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";
import "./_group.css";
import "./_current.css";

type Story = {
  id:string; title:string; body:string; kind:string; significance:"MAJOR"|"MOMENT"|"STANDARD";
  scope:"WORLD"|"CAREER"; season:number; week:number; date:string;
};

const stories:Story[] = [
  {id:"palace-final",title:"A deciding leg settles the Palace final",body:"A tense final reached its last leg before the champion found a clean route through the pressure and lifted the season's biggest prize.",kind:"World Championship",significance:"MAJOR",scope:"WORLD",season:2026,week:44,date:"23 October 2026"},
  {id:"rank-rise",title:"A run of form moves you into the top eight",body:"Back-to-back wins carried you into the upper tier of the world rankings, setting up a difficult draw at the next major.",kind:"Ranking movement",significance:"MOMENT",scope:"CAREER",season:2026,week:41,date:"2 October 2026"},
  {id:"nine-dart",title:"Nine perfect darts earn a place in the record",body:"The leg began with two maximums and ended with a pinpoint finish. The tournament crowd knew what was coming before the final dart landed.",kind:"Nine-darter",significance:"MAJOR",scope:"WORLD",season:2026,week:38,date:"11 September 2026"},
  {id:"county-night",title:"County night comes down to the final board",body:"The tie stayed level through the singles before the deciding match turned on a late break of throw and a composed finish.",kind:"County competition",significance:"STANDARD",scope:"CAREER",season:2025,week:29,date:"18 July 2025"},
  {id:"tour-card",title:"A first season on tour brings a breakthrough",body:"A string of deep runs across the spring calendar gave the new campaign its first real momentum and opened the door to a major stage.",kind:"Career moment",significance:"MOMENT",scope:"CAREER",season:2025,week:17,date:"25 April 2025"},
];
const categoryOf=(story:Story)=>story.kind;
const stamp=(story:Story)=>`Season ${story.season} · Week ${story.week} · ${story.date}`;

export function Current() {
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("All categories");
  const [season,setSeason]=useState("All seasons");
  const categories=useMemo(()=>[...new Set(stories.map(categoryOf))].sort(),[]);
  const seasons=useMemo(()=>[...new Set(stories.map(story=>story.season))].sort((a,b)=>b-a),[]);
  const filtered=stories.filter(story=>
    (category==="All categories"||categoryOf(story)===category)&&
    (season==="All seasons"||String(story.season)===season)&&
    (!search.trim()||`${story.title} ${story.body}`.toLowerCase().includes(search.trim().toLowerCase()))
  );

  return <div className="news-current-shell">
    <section className="news-current-frame">
      <header className="news-current-head"><h2><Newspaper size={14} aria-hidden/> Darts World · Newsroom</h2><span>Career archive</span></header>
      <div className="tkdl-newsroom">
        <div className="news-masthead">
          <div className="news-kicker">TKDL Career · Darts World</div>
          <h1>On the record.</h1>
          <p>News from your career and the darts world around you.</p>
          <div className="news-rule"/>
          <div className="news-current-meta-row">
            <span className="news-meta">{stories.length} recorded stories</span>
            <button className="news-action" type="button">Story threads <ArrowUpRight size={14}/></button>
          </div>
        </div>
        <div className="news-toolbar" role="search" aria-label="Filter the newsroom">
          <label className="news-filter-label">Find a story
            <input className="news-filter" type="search" maxLength={100} value={search} onChange={e=>setSearch(e.currentTarget.value)} placeholder="Search headlines and reports"/>
          </label>
          <div className="news-filter-row">
            <label className="news-filter-label">Category
              <select className="news-filter" value={category} onChange={e=>setCategory(e.currentTarget.value)}>
                <option>All categories</option>{categories.map(item=><option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="news-filter-label">Season
              <select className="news-filter" value={season} onChange={e=>setSeason(e.currentTarget.value)}>
                <option>All seasons</option>{seasons.map(item=><option key={item} value={item}>Season {item}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="news-layout">
          <main className="news-main-column">
            <div className="news-section-heading"><h2>Latest reports</h2><span>{filtered.length} shown</span></div>
            {filtered.length?<div className="news-story-list">{filtered.map((story,index)=>
              <article className={`news-story ${index===0?"news-story--lead":""}`} key={story.id}>
                <div className="news-story-tags"><span className={`news-tag ${story.significance==="MAJOR"?"news-tag--major":story.significance==="MOMENT"?"news-tag--moment":""}`}>{story.significance==="MAJOR"?"Major":story.significance==="MOMENT"?"Career moment":"Career"}</span><span className="news-tag">{categoryOf(story)}</span></div>
                <h3>{story.title}</h3><p>{story.body}</p><span className="news-meta">{stamp(story)}</span>
              </article>)}</div>:<div className="news-empty"><h2>No reports match these filters</h2><p>Try another category, season or search.</p></div>}
          </main>
          <aside className="news-rail"><div className="news-rail-title"><Newspaper size={17}/><h2>Evidence first</h2></div>
            <p>Headlines and source references are drawn from this save’s Life story record. Filters only organise the stories already returned.</p>
            <div className="news-rail-item"><span>IN THIS EDITION</span><p>{filtered.length} of {stories.length} recorded stories match your view.</p></div>
            {stories.slice(0,3).map(story=><div className="news-rail-item" key={story.id}><button type="button">{story.title}</button><span>{stamp(story)}</span></div>)}
          </aside>
        </div>
      </div>
    </section>
  </div>;
}
