import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search, Trophy, X, Zap } from "lucide-react";
import { circuits, familyImage, families, organisations } from "./_mockData";
import "./redesign.css";

const className = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export function Redesign() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedCircuit, setSelectedCircuit] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const selected = families.find(f => f.id === selectedFamily);
  const filtered = useMemo(() => families.filter(f => {
    const textMatch = `${f.name} ${f.circuit} ${f.circuitName} ${className(f.eventClass)}`.toLowerCase().includes(search.toLowerCase());
    return textMatch && (!selectedCircuit || f.circuit === selectedCircuit);
  }), [search, selectedCircuit]);
  const items = filtered.slice(page * 20, (page + 1) * 20);
  const applyCircuit = (value: string) => { setSelectedCircuit(selectedCircuit === value ? null : value); setPage(0); };
  const applySearch = (value: string) => { setSearch(value); setPage(0); };

  return <main className="cwe-redesign">
    <div className="cwe-redesign__shell">
      <header className="cwe-redesign__masthead">
        <span className="cwe-redesign__seal"><Trophy size={17}/></span>
        <div><strong>TKDL <i>·</i> CAREER WORLD</strong><small>THE CHAMPIONSHIP INDEX</small></div>
        <span className="cwe-redesign__season">WORLD SEASON <b>01</b></span>
      </header>
      <section className="cwe-redesign__hero">
        <div className="cwe-redesign__hero-copy">
          <p className="cwe-redesign__eyebrow"><span/> DARTS WORLD / EVENTS &amp; CIRCUITS</p>
          <h1>THE<br/><em>TOURNAMENT</em><br/>LANDSCAPE<span className="cwe-redesign__index">28</span></h1>
          <p className="cwe-redesign__lead">From a first club night to the Palace stage. Find the circuit that carries your season forward.</p>
          <label className="cwe-redesign__search"><Search size={17}/><input type="search" maxLength={80} value={search} onChange={e => applySearch(e.target.value)} placeholder="Find a championship or circuit"/><kbd>⌕</kbd></label>
        </div>
        <div className="cwe-redesign__hero-art" aria-hidden="true">
          <div className="cwe-redesign__arena-lines"/><div className="cwe-redesign__spotlight"/>
          <div className="cwe-redesign__darts-board"><i/><b/><span/></div>
          <div className="cwe-redesign__champion-mark"><small>WDU</small><strong>01</strong><i>WORLD<br/>CHAMPIONSHIP</i></div>
          <span className="cwe-redesign__art-caption">THE LONG ROAD<br/>TO THE PALACE</span>
        </div>
        <div className="cwe-redesign__hero-foot"><span>PLAY THE WHOLE LADDER</span><i/><span>GRASSROOTS → PROFESSIONAL → WORLD STAGE</span></div>
      </section>
      <section className="cwe-redesign__overview" aria-label="World events overview">
        <div><small>CHAMPIONSHIP FAMILIES</small><strong>{families.length.toString().padStart(2, "0")}</strong></div>
        <div><small>GOVERNING &amp; PROMOTER BODIES</small><strong>{organisations.length.toString().padStart(2, "0")}</strong></div>
        <div><small>PATHWAYS &amp; CIRCUITS</small><strong>{circuits.length.toString().padStart(2, "0")}</strong></div>
        <p>Each family returns as local editions throughout the season.</p>
      </section>

      <section className="cwe-redesign__circuits">
        <div className="cwe-redesign__section-heading"><div><small>01 / THE GOVERNING MAP</small><h2>Organisations <i>&amp;</i> circuits</h2></div><span>SELECT A CIRCUIT TO FILTER</span></div>
        <div className="cwe-redesign__org-grid">
          {organisations.map((org, index) => <article className={`cwe-redesign__org cwe-redesign__org--${org.id}`} key={org.id}>
            <div className="cwe-redesign__org-top"><span className="cwe-redesign__org-number">0{index + 1}</span><div><h3>{org.name}</h3><p>{org.role}</p></div><ArrowUpRight size={15}/></div>
            <div className="cwe-redesign__chips">{circuits.filter(c => c.organisationId === org.id).map(c => <button type="button" key={c.id} onClick={() => applyCircuit(c.authorityCircuit)} className={selectedCircuit === c.authorityCircuit ? "is-active" : ""}>{c.name}<i/></button>)}</div>
          </article>)}
        </div>
      </section>
      <section className="cwe-redesign__directory">
        <div className="cwe-redesign__section-heading cwe-redesign__directory-heading">
          <div><small>02 / THE SEASON ROSTER</small><h2>Championship families <span>{filtered.length}</span></h2></div>
          <button type="button" className="cwe-redesign__clear" onClick={() => { applySearch(""); setSelectedCircuit(null); }}>CLEAR FILTERS <X size={13}/></button>
        </div>
        {(search || selectedCircuit) && <div className="cwe-redesign__active-filters">
          <span>FILTERING BY</span>{search && <button onClick={() => applySearch("")} type="button">{search}<X size={12}/></button>}
          {selectedCircuit && <button onClick={() => applyCircuit(selectedCircuit)} type="button">{className(selectedCircuit)}<X size={12}/></button>}
          <strong>{filtered.length} MATCHES</strong>
        </div>}
        {selected && <aside className="cwe-redesign__selected" aria-live="polite">
          <span className="cwe-redesign__selected-icon"><Trophy size={18}/></span><div><small>SELECTED CHAMPIONSHIP · {selected.circuitName}</small><strong>{selected.name}</strong></div>
          <span className="cwe-redesign__selected-class">{className(selected.eventClass)}</span>
          <button type="button" onClick={() => setSelectedFamily(null)} aria-label="Close championship selection"><X size={16}/></button>
        </aside>}
        <div className="cwe-redesign__family-grid">
          {items.map((f, i) => <button type="button" className={`cwe-redesign__family ${f.eventClass === "WORLD_CHAMPIONSHIP" ? "is-palace" : ""}`} key={f.id} onClick={() => setSelectedFamily(f.id)}>
            <img src={familyImage(f.plate)} alt="" aria-hidden="true" loading="lazy"/>
            <span className="cwe-redesign__family-rank">{String(page * 20 + i + 1).padStart(2, "0")}</span>
            <span className="cwe-redesign__family-detail"><small>{f.circuitName}</small><strong>{f.name}</strong><em>{className(f.eventClass)}</em></span>
            <span className="cwe-redesign__family-go"><Zap size={14}/></span>
          </button>)}
        </div>
        {filtered.length === 0 && <div className="cwe-redesign__empty"><Trophy size={23}/><strong>No event families found</strong><span>Change the search or clear a circuit filter to reopen the field.</span></div>}
        <nav className="cwe-redesign__pagination" aria-label="Championship pages">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/> PREVIOUS</button>
          <span><b>{String(page + 1).padStart(2, "0")}</b> / {Math.max(1, Math.ceil(filtered.length / 20)).toString().padStart(2, "0")} <i/> {filtered.length} FAMILIES</span>
          <button type="button" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)}>NEXT <ChevronRight size={15}/></button>
        </nav>
      </section>
      <footer className="cwe-redesign__footer"><span>TKDL CAREER / EVENT INDEX</span><span>REAL PATHWAYS. A WORLD OF YOUR OWN.</span><span>WORLD DARTS UNION <i>·</i> 01</span></footer>
    </div>
  </main>;
}
