import { useMemo, useState } from "react";
import { Search, ArrowRight, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { circuits, familyImage, families, organisations } from "./_mockData";
import "./current.css";

const titleCase = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const familyName = (value: string) => value;

export function Current() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => families.filter(f =>
    `${familyName(f.name)} ${f.circuit} ${f.circuitName} ${titleCase(f.circuit)}`.toLowerCase().includes(search.toLowerCase())
  ), [search]);
  const pageItems = filtered.slice(page * 20, (page + 1) * 20);
  const selectedFamily = families.find(f => f.id === selected);
  const setQuery = (value: string) => { setSearch(value); setPage(0); };

  return <main className="cwe-current">
    <div className="cwe-current__shell">
      <section className="cwe-current__hero">
        <div className="cwe-current__hero-copy">
          <p className="cwe-current__kicker"><i /> Darts World</p>
          <h1>Events &amp;<br/><em>Circuits</em></h1>
          <p className="cwe-current__intro">Every championship family in your Career world, from local club nights to the Palace. Each family runs as local editions across the season.</p>
          <label className="cwe-current__search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search championships</span>
            <input type="search" maxLength={80} value={search} onChange={e => setQuery(e.target.value)} placeholder="Names, cities, circuits"/></label>
        </div>
        <div className="cwe-current__arena" aria-hidden="true">
          <img className="cwe-current__hero-image" src={familyImage("major-arena")} alt="" />
          <span className="cwe-current__caption">WORLD DARTS · CAREER SEASON</span>
        </div>
        <dl className="cwe-current__stats">
          <div><dt>Championship families</dt><dd>{families.length}</dd></div>
          <div><dt>Organisations</dt><dd>{organisations.length}</dd></div>
          <div><dt>Circuits</dt><dd>{circuits.length}</dd></div>
          <div><dt>Editions this season</dt><dd>148</dd></div>
        </dl>
      </section>

      <div className="cwe-current__org-grid">
        {organisations.map(org => <article className="cwe-current__org-card" key={org.id}>
          <header><span aria-hidden="true">{org.shortName}</span><div><h2>{org.name}</h2><p>{org.role}</p></div></header>
          <div className="cwe-current__circuit-list">
            {circuits.filter(c => c.organisationId === org.id).map(c => <button type="button" key={c.id} onClick={() => setQuery(c.authorityCircuit)}>{c.name}</button>)}
          </div>
        </article>)}
      </div>

      {selectedFamily && <aside className="cwe-current__selection" aria-live="polite">
        <Trophy size={17}/><span><small>CHAMPIONSHIP SELECTED</small><strong>{selectedFamily.name}</strong></span>
        <button type="button" onClick={() => setSelected(null)} aria-label="Close selected championship">×</button>
      </aside>}
      <div className="cwe-current__family-grid">
        {pageItems.map(f => <button className="cwe-current__family-card" type="button" key={f.id} onClick={() => setSelected(f.id)}>
          <img src={familyImage(f.plate)} alt="" aria-hidden="true" loading="lazy" decoding="async"/>
          <span><small>{f.circuitName}</small><strong>{familyName(f.name)}</strong><em>{titleCase(f.eventClass)}</em></span>
          <i className="cwe-current__card-arrow"><ArrowRight size={15}/></i>
        </button>)}
      </div>
      {filtered.length === 0 && <p className="cwe-current__empty">No championships match “{search}”. Try another event name or circuit.</p>}
      <nav className="cwe-current__pagination" aria-label="Championship pages">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/> Previous</button>
        <span>Page {page + 1} <i/> {filtered.length} results</span>
        <button type="button" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)}>Next <ChevronRight size={15}/></button>
      </nav>
    </div>
  </main>;
}
