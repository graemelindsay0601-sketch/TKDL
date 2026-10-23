import {ArrowRight,Search} from "lucide-react";
import {Link} from "wouter";
import type {WorldContent} from "../../../../../api-server/src/career/content/service";
import {CareerEventIdentity} from "../identity";
import {PLATES,resolveAtmosphere} from "../atmosphere";
import {eventCircuitLabel,familyName,titleCase} from "../model";
import "./world-events-premium.css";

type Props={
  data:WorldContent;
  families:WorldContent["eventFamilies"];
  search:string;
  setSearch:(value:string)=>void;
  page:number;
  setPage:(page:number)=>void;
  base:string;
  editionCount:number;
  editionLoading:boolean;
  editionError:unknown;
};

export function WorldEventsPremiumDirectory({data,families,search,setSearch,page,setPage,base,editionCount,editionLoading,editionError}:Props) {
  const pageItems=families.slice(page*20,(page+1)*20);
  const heroImage=PLATES["major-arena"]??PLATES.neutral;
  const updateSearch=(value:string)=>{setSearch(value);setPage(0);};

  return <div className="career-world-events-page">
    <div className="career-world-events-page__shell">
      <section className="career-world-events-page__hero" aria-labelledby="career-world-events-title">
        <div className="career-world-events-page__hero-copy">
          <p className="career-world-events-page__kicker"><i/>Darts World</p>
          <h1 id="career-world-events-title">Events &amp;<br/><em>Circuits</em></h1>
          <p className="career-world-events-page__intro">Every championship family in your Career world, from local club nights to the Palace. Each family runs as local editions across the season.</p>
          <label className="career-world-events-page__search">
            <Search size={16} aria-hidden="true"/>
            <span className="sr-only">Search championships</span>
            <input type="search" maxLength={80} value={search} onChange={event=>updateSearch(event.target.value)} placeholder="Names, cities, circuits"/>
          </label>
        </div>
        <div className="career-world-events-page__arena" aria-hidden="true">
          <img src={heroImage.src} alt="" loading="eager" decoding="async"/>
          <span>WORLD DARTS · CAREER SEASON</span>
        </div>
        <dl className="career-world-events-page__stats">
          <div><dt>Championship families</dt><dd>{data.eventFamilies.length}</dd></div>
          <div><dt>Organisations</dt><dd>{data.organisations.length}</dd></div>
          <div><dt>Circuits</dt><dd>{data.circuits.length}</dd></div>
          <div><dt>Editions this season</dt><dd>{editionLoading?"…":editionError?"—":editionCount}</dd></div>
        </dl>
      </section>

      <section className="career-world-events-page__org-grid" aria-label="Organisations and circuits">
        {data.organisations.map(organisation=><article className="career-world-events-page__org-card" key={organisation.id}>
          <header>
            <span aria-hidden="true">{organisation.shortName}</span>
            <div><h2>{organisation.name}</h2><p>{organisation.role}</p></div>
          </header>
          <div className="career-world-events-page__circuit-list">
            {data.circuits.filter(circuit=>circuit.organisationId===organisation.id).map(circuit=>
              <button type="button" key={circuit.id} aria-pressed={search===circuit.authorityCircuit} onClick={()=>updateSearch(circuit.authorityCircuit)}>{circuit.name}</button>)}
          </div>
        </article>)}
      </section>

      {families.length===0?<p className="career-world-events-page__empty">No championships match “{search}”. Try another event name or circuit.</p>:
        <div className="career-world-events-page__family-grid">
          {pageItems.map(family=>{
            const plate=PLATES[resolveAtmosphere({definitionKey:family.id,circuit:family.circuit,eventClass:family.eventClass}).plate]??PLATES.neutral;
            return <CareerEventIdentity key={family.id} eventKey={family.id} circuit={family.circuit}>
              <Link className="career-world-events-page__family-card" href={`${base}/world/events/${family.id}`}>
                <img src={plate.src} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{objectPosition:`${plate.focal.x*100}% ${plate.focal.y*100}%`}}/>
                <span><small>{eventCircuitLabel(family)}</small><strong>{familyName(family.name)}</strong><em>{titleCase(family.eventClass)}</em></span>
                <i><ArrowRight size={15}/></i>
              </Link>
            </CareerEventIdentity>;
          })}
        </div>}

      <nav className="career-world-events-page__pagination" aria-label="Championship pages">
        <button type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button>
        <span>Page {page+1}<i/>{families.length} results</span>
        <button type="button" disabled={(page+1)*20>=families.length} onClick={()=>setPage(page+1)}>Next</button>
      </nav>
    </div>
  </div>;
}
