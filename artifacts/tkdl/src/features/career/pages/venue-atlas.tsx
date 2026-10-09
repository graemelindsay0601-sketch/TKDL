import { useMemo, useState } from "react";
import { ArrowUpRight, Building2, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";
import type { ShellContext } from "../shell";
import "../venue-atlas.css";

type VenueFamily = "pub-club" | "social-club" | "community-hall" | "sports-centre" | "hotel-ballroom" | "conference" |
  "professional-floor" | "studio" | "historic-theatre" | "modern-theatre" | "exhibition" | "small-arena" | "major-arena" |
  "international-arena" | "palace";
type VenueRecord = {
  id: string; displayName: string; nickname: string | null; countryId: string; regionId: string; cityId: string; city: string; region: string;
  venueType: VenueFamily; capacityBand: "CLUB" | "HALL" | "ARENA"; atmosphereTags: string[]; stageConfiguration: string;
  permanentWorldHome?: boolean;
};
type VenueLocality = { key: string; region: string; country: string; city: string; venues: VenueRecord[] };
type VenueData = { venues: VenueRecord[]; countries: { id: string; name: string }[] };
type SeasonEvent = { id: string; name: string; status: string; dates: { startWeek: number }; venue: { id: string } };
type Entry = VenueRecord & { source: "WORLD" | "LOCAL"; localityKey?: string };
type Scope = "ALL" | "WORLD" | "LOCAL";

const ARTWORK: Record<VenueFamily, string> = {
  "pub-club": "career-venue-club.jpg",
  "social-club": "career-venue-social-club.jpg",
  "community-hall": "career-venue-county-hall.jpg",
  "sports-centre": "career-venue-sports-centre.jpg",
  "hotel-ballroom": "career-venue-hotel-ballroom.jpg",
  conference: "career-venue-conference.jpg",
  "professional-floor": "career-venue-floor.jpg",
  studio: "career-venue-studio.jpg",
  "historic-theatre": "career-venue-heritage-theatre.jpg",
  "modern-theatre": "career-venue-modern-theatre.jpg",
  exhibition: "career-venue-exhibition.jpg",
  "small-arena": "career-venue-arena.jpg",
  "major-arena": "career-venue-major-arena.jpg",
  "international-arena": "career-venue-international-arena.jpg",
  palace: "career-palace-arena.png",
};
const FAMILY_LABEL: Record<VenueFamily, string> = {
  "pub-club": "Pub club", "social-club": "Social club", "community-hall": "Community hall",
  "sports-centre": "Sports centre", "hotel-ballroom": "Hotel ballroom", conference: "Conference venue",
  "professional-floor": "Professional floor", studio: "Darts studio", "historic-theatre": "Heritage theatre",
  "modern-theatre": "Modern theatre", exhibition: "Exhibition venue", "small-arena": "Arena",
  "major-arena": "Major arena", "international-arena": "International arena", palace: "World Championship venue",
};
const ASSET_BASE = `${import.meta.env.BASE_URL}images/career-venues/`;
const PAGE_SIZE = 8;

export function CareerVenueArtwork({ family, className = "" }: { family: string; className?: string }) {
  const image = ARTWORK[family as VenueFamily] ?? ARTWORK.exhibition;
  return <div className={`cva-art ${className}`} data-family={family} aria-hidden="true">
    <img src={`${ASSET_BASE}${image}`} alt="" loading="lazy" />
  </div>;
}

export function CareerVenueAtlas({ ctx, data, localities, events, detailId, eventsLoading, eventsError, onRetry }: {
  ctx: ShellContext; data: VenueData; localities: VenueLocality[]; events: SeasonEvent[]; detailId?: string;
  eventsLoading: boolean; eventsError: unknown; onRetry: () => void;
}) {
  const [scope, setScope] = useState<Scope>("ALL");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("ALL");
  const [family, setFamily] = useState("ALL");
  const [capacity, setCapacity] = useState("ALL");
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState("the-palace-london");
  const base = `/career/${ctx.save.id}`;
  const entries = useMemo<Entry[]>(() => [
    ...data.venues.map(v => ({ ...v, source: "WORLD" as const })),
    ...localities.flatMap(locality => locality.venues.map(v => ({ ...v, source: "LOCAL" as const, localityKey: locality.key }))),
  ], [data, localities]);
  const countries = useMemo(() => new Map(data.countries.map(c => [c.id, c.name])), [data.countries]);
  const filtered = useMemo(() => entries.filter(v => {
    if (scope === "WORLD" && v.source !== "WORLD") return false;
    if (scope === "LOCAL" && v.source !== "LOCAL") return false;
    if (country !== "ALL" && v.countryId !== country) return false;
    if (family !== "ALL" && v.venueType !== family) return false;
    if (capacity !== "ALL" && v.capacityBand !== capacity) return false;
    const query = search.trim().toLowerCase();
    return !query || `${v.displayName} ${v.nickname ?? ""} ${v.city} ${v.region} ${countries.get(v.countryId) ?? v.countryId} ${FAMILY_LABEL[v.venueType]}`
      .toLowerCase().includes(query);
  }).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id)), [entries, scope, country, family, capacity, search, countries]);
  const selectedId = detailId ?? activeId;
  const selected = entries.find(v => v.id === selectedId) ?? entries.find(v => v.id === "the-palace-london") ?? entries[0];
  const selectedEvents = selected ? events.filter(e => e.venue.id === selected.id) : [];
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const reset = () => { setScope("ALL"); setSearch(""); setCountry("ALL"); setFamily("ALL"); setCapacity("ALL"); setPage(0); };
  const choose = (id: string) => { setActiveId(id); setPage(Math.max(0, filtered.findIndex(v => v.id === id) / PAGE_SIZE | 0)); };

  return <main className="career-venue-atlas">
    <header className="cva-mast">
      <div className="cva-mast-copy">
        <div className="cva-kicker"><i/>Career world <i/> venue atlas</div>
        <h1>Find your stage</h1>
        <p>From local club nights to the sport’s biggest arenas. Explore every authored venue and the locality-based club and county identities used by the season calendar.</p>
      </div>
      <div className="cva-count-stamp" aria-label={`${data.venues.length} authored venues and ${entries.length - data.venues.length} generated locality venues`}>
        <span>Career venue index</span><strong>{entries.length}</strong>
        <small>{data.venues.length} world venues · {entries.length - data.venues.length} locality identities</small>
      </div>
    </header>

    <section className="cva-feature">
      {selected && <>
        <CareerVenueArtwork family={selected.venueType} className="cva-feature-art"/>
        <div className="cva-feature-shade" aria-hidden="true"/>
        <div className="cva-feature-copy">
          <span className="cva-feature-overline"><i/>{FAMILY_LABEL[selected.venueType]} · {selected.source === "WORLD" ? "Authored world venue" : "Locality-based identity"}</span>
          <h2>{selected.nickname ?? selected.displayName}</h2>
          {selected.nickname && <strong className="cva-feature-name">{selected.displayName}</strong>}
          <p className="cva-feature-place"><MapPin size={14} aria-hidden/>{selected.city}, {selected.region} · {countries.get(selected.countryId) ?? selected.countryId}</p>
          <div className="cva-feature-tags">{selected.atmosphereTags.slice(0, 3).map(tag => <span key={tag}>{tag.replaceAll("-", " ")}</span>)}</div>
          <small className="cva-art-note">Illustrative venue artwork · visual identity, not a venue photograph</small>
        </div>
        <span className="cva-feature-number">{selected.capacityBand}</span>
      </>}
    </section>

    <div className="cva-toolbar" role="group" aria-label="Venue collection">
      {([
        ["ALL", "All destinations", entries.length],
        ["WORLD", "World venues", data.venues.length],
        ["LOCAL", "Local & county", entries.length - data.venues.length],
      ] as const).map(([value, label, count]) =>
        <button key={value} className={scope === value ? "is-active" : ""} aria-pressed={scope === value} onClick={() => { setScope(value); setPage(0); }}>
          {label}<b>{count}</b>
        </button>)}
    </div>

    <div className="cva-layout">
      <section className="cva-browse" aria-label="Browse venues">
        <div className="cva-filter-panel">
          <label className="cva-search"><Search size={16} aria-hidden/><span className="sr-only">Search venues</span>
            <input type="search" maxLength={80} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search venue, city or region"/>
          </label>
          <label><span>Country</span><select value={country} onChange={e => { setCountry(e.target.value); setPage(0); }}>
            <option value="ALL">Every country</option>{data.countries.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label><span>Venue style</span><select value={family} onChange={e => { setFamily(e.target.value); setPage(0); }}>
            <option value="ALL">All venue styles</option>{Object.entries(FAMILY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          <label><span>Scale</span><select value={capacity} onChange={e => { setCapacity(e.target.value); setPage(0); }}>
            <option value="ALL">All capacities</option><option value="CLUB">Club</option><option value="HALL">Hall</option><option value="ARENA">Arena</option>
          </select></label>
          <button className="cva-reset" onClick={reset}><SlidersHorizontal size={14} aria-hidden/>Reset filters</button>
        </div>

        <div className="cva-list-heading"><div><span className="cva-eyebrow">Explore the directory</span><h3>Venues & local identities</h3></div><span>{filtered.length} results</span></div>
        {pageItems.length ? <div className="cva-card-grid">
          {pageItems.map(v => <Link key={v.id} href={`${base}/world/venues/${v.id}`} onClick={() => choose(v.id)}
            className={`cva-card${selected?.id === v.id ? " is-selected" : ""}`} aria-current={selected?.id === v.id ? "page" : undefined}>
            <CareerVenueArtwork family={v.venueType} className="cva-card-art"/>
            <div className="cva-card-copy">
              <span>{v.source === "WORLD" ? "WORLD VENUE" : v.capacityBand === "CLUB" ? "LOCAL CLUB" : "COUNTY HALL"}</span>
              <strong>{v.nickname ?? v.displayName}</strong>
              <small>{v.city}, {countries.get(v.countryId) ?? v.countryId}</small>
              <i><ArrowUpRight size={15} aria-hidden/></i>
            </div>
          </Link>)}
        </div> : <div className="cva-empty"><Building2 size={24} aria-hidden/><strong>No venues match those filters</strong><span>Try a different search or reset the filters.</span></div>}
        <nav className="cva-pagination" aria-label="Venue pages">
          <button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))} aria-label="Previous venues"><ChevronLeft size={17}/></button>
          <span>Page {page + 1} of {pageCount}</span>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount - 1, page + 1))} aria-label="Next venues"><ChevronRight size={17}/></button>
        </nav>
      </section>

      {selected && <aside className="cva-detail" aria-label={`${selected.displayName} venue details`}>
        <div className="cva-detail-head"><span className="cva-eyebrow">Destination profile</span><span className="cva-capacity">{selected.capacityBand}</span></div>
        <h3>{selected.nickname ?? selected.displayName}</h3>
        {selected.nickname && <p className="cva-detail-subtitle">{selected.displayName}</p>}
        <p className="cva-detail-location"><MapPin size={15} aria-hidden/>{selected.city}, {selected.region} <span>{countries.get(selected.countryId) ?? selected.countryId}</span></p>
        <dl className="cva-facts">
          <div><dt>Venue style</dt><dd>{FAMILY_LABEL[selected.venueType]}</dd></div>
          <div><dt>Stage setup</dt><dd>{selected.stageConfiguration.replaceAll("_", " ").toLowerCase()}</dd></div>
          <div><dt>Directory source</dt><dd>{selected.source === "WORLD" ? "Authored world venue" : "Generated from a Career locality"}</dd></div>
        </dl>
        <div className="cva-events">
          <div className="cva-events-title"><CalendarDays size={15} aria-hidden/><h4>Events this season</h4></div>
          {eventsLoading ? <p className="cva-event-note">Checking this season’s schedule…</p> :
            eventsError ? <div className="cva-event-note"><span>Season schedule unavailable.</span><button onClick={onRetry}>Retry</button></div> :
              selectedEvents.length ? selectedEvents.slice(0, 6).map(e => <Link className="cva-event-row" key={e.id} href={`${base}/events/${e.id}`}>
                <span><strong>{e.name}</strong><small>Week {e.dates.startWeek} · {e.status.replaceAll("_", " ").toLowerCase()}</small></span><ArrowUpRight size={14} aria-hidden/>
              </Link>) : <p className="cva-event-note">No event at this destination is scheduled in the current season.</p>}
        </div>
        {selected.source === "WORLD" && <Link className="cva-history-link" href={`${base}/world/history`}>Explore recorded championship history <ArrowUpRight size={14} aria-hidden/></Link>}
      </aside>}
    </div>
    {scope !== "WORLD" && <p className="cva-source-note">Local club and county identities are generated from authored Career localities. They are possibilities until an event in your season is scheduled there; no venue history or event is invented here.</p>}
  </main>;
}
