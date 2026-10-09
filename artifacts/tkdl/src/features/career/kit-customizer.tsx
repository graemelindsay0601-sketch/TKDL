import { useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Search, Shirt, Sparkles, Tag } from "lucide-react";
import { CAREER_KIT_COLORWAYS, CAREER_KIT_COLLECTIONS, CAREER_KIT_DESIGNS, filterCareerKitDesigns } from "./kit-catalog";
import { CareerShirt, type ShirtIdentity, type ShirtPartner } from "./identity";
import "./kit-customizer.css";

const PAGE_SIZE = 12;
const collections = ["All shirts", ...CAREER_KIT_COLLECTIONS] as const;

export function CareerKitCustomizer({
  identity = {},
  sponsors = [],
  playerName = "Career player",
  disabled = false,
  onChange,
}: {
  identity?: ShirtIdentity;
  sponsors?: ShirtPartner[];
  playerName?: string;
  disabled?: boolean;
  onChange: (patch: Partial<ShirtIdentity>) => void;
}) {
  const [collection, setCollection] = useState<(typeof collections)[number]>("All shirts");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [customColour, setCustomColour] = useState(identity.primaryColour ?? "#7e63ae");
  const selected = CAREER_KIT_DESIGNS.find(item => item.id === identity.kitDesignId) ?? CAREER_KIT_DESIGNS[0]!;
  const filtered = useMemo(() => filterCareerKitDesigns(collection, search), [collection, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const tintEnabled = identity.kitTintEnabled !== false && Boolean(identity.primaryColour);
  const matchingColourway = tintEnabled && CAREER_KIT_COLORWAYS.some(colourway => colourway.primary === identity.primaryColour);
  const customTintSelected = tintEnabled && !matchingColourway;
  const selectColourway = (primaryColour: string) => onChange({ kitTintEnabled: true, primaryColour });
  const selectOriginal = () => onChange({ kitTintEnabled: false });

  return (
    <section className="career-kit-library" aria-label="Career shirt designer">
      <header className="career-kit-library__header">
        <div>
          <span className="career-kit-library__eyebrow"><Shirt size={13} aria-hidden="true" /> CAREER PLAYER IDENTITY · KIT ROOM</span>
          <h3>Your look. Your career.</h3>
          <p>Choose a distinct cut and artwork, then tune its fabric colour. Your kit is cosmetic only.</p>
        </div>
        <span className="career-kit-library__count"><strong>50</strong><small>ORIGINAL<br />DESIGNS</small></span>
      </header>
      <div className="career-kit-library__feature">
        <div className="career-kit-library__feature-art" aria-label={`Preview of ${selected.name}`}>
          <span className="career-kit-library__stage-mark career-kit-library__stage-mark--top">TOUR ISSUE <i /> PERFORMANCE KNIT</span>
          <CareerShirt identity={{ ...identity, kitDesignId: selected.id }} sponsors={sponsors} name={playerName} scale="profile" />
          <span className="career-kit-library__stage-mark career-kit-library__stage-mark--bottom">FRONT VIEW <b>{selected.number} / 50</b></span>
        </div>
        <div className="career-kit-library__feature-info">
          <div className="career-kit-library__selected-label"><span>SELECTED SHIRT · {selected.number}</span><b>{selected.collection}</b></div>
          <h4>{selected.name}</h4>
          <p>{selected.cut}</p>
          <small>{selected.detail}</small>
          <div className="career-kit-library__color-block">
            <div className="career-kit-library__subheading"><strong>Fabric colour</strong><span>Artwork and texture stay visible</span></div>
            <div className="career-kit-library__colourways" role="group" aria-label="Choose a shirt colourway">
              <button type="button" className={`career-kit-library__colour-option career-kit-library__colour-option--original ${!tintEnabled ? "is-selected" : ""}`}
                aria-pressed={!tintEnabled} disabled={disabled} onClick={selectOriginal}>
                <span className="career-kit-library__original-swatch" aria-hidden="true"><i /><i /><i /></span><strong>Original</strong>
              </button>
              {CAREER_KIT_COLORWAYS.map(colourway => {
                const active = tintEnabled && identity.primaryColour === colourway.primary;
                return <button key={colourway.name} type="button" className={`career-kit-library__colour-option ${active ? "is-selected" : ""}`}
                  title={`${colourway.name} fabric tint`} aria-label={`${colourway.name} fabric tint`} aria-pressed={active} disabled={disabled}
                  onClick={() => selectColourway(colourway.primary)}>
                  <span className="career-kit-library__swatch" style={{ "--kit-swatch": colourway.primary } as CSSProperties}>{active && <Check size={12} aria-hidden="true" />}</span>
                  <strong>{colourway.name}</strong>
                </button>;
              })}
          <label className={`career-kit-library__colour-option career-kit-library__custom ${customTintSelected ? "is-selected" : ""}`}>
                <input type="color" value={customColour} disabled={disabled} aria-label="Choose a custom fabric colour"
                  onChange={event => { setCustomColour(event.target.value); selectColourway(event.target.value); }} />
                <span className="career-kit-library__custom-swatch" style={{ "--kit-swatch": customColour } as CSSProperties} aria-hidden="true">+</span><strong>Custom</strong>
              </label>
            </div>
          </div>
          <div className="career-kit-library__partner-note">
            <span className="career-kit-library__partner-icon"><Tag size={14} aria-hidden="true" /></span>
            <div><strong>Contract partner marks</strong>
              {sponsors.length ? <div className="career-kit-library__partner-list">{sponsors.map((partner, index) =>
                <span key={`${partner.slot}:${partner.brandName}:${index}`}>{partner.brandName}<small>{partner.slot.replaceAll("_", " ").toLowerCase()}</small></span>)}</div>
                : <p>Only active Career agreements add sponsor marks. No fictional partners are added.</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="career-kit-library__toolbar">
        <div className="career-kit-library__catalog-heading">
          <div><span className="career-kit-library__eyebrow"><Sparkles size={12} aria-hidden="true" /> THE KIT COLLECTION</span><strong>Find your shirt</strong></div>
          <span>50 designs · 5 collections</span>
        </div>
        <div className="career-kit-library__tabs" role="group" aria-label="Filter shirt collection">
          {collections.map(item => <button key={item} type="button" className={collection === item ? "is-active" : ""} aria-pressed={collection === item} onClick={() => { setCollection(item); setPage(0); }} disabled={disabled}>{item}</button>)}
        </div>
        <label className="career-kit-library__search"><Search size={14} aria-hidden="true" /><input type="search" value={search}
          onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search cuts, names, collections" aria-label="Search shirts" disabled={disabled} /></label>
      </div>
      <div className="career-kit-library__grid" role="group" aria-label="Choose one of 50 shirt designs">
        {visible.map(item => (
          <button key={item.id} type="button" className={`career-kit-library__card ${selected.id === item.id ? "is-selected" : ""}`}
            onClick={() => onChange({ kitDesignId: item.id })} aria-pressed={selected.id === item.id} disabled={disabled}>
            <span className="career-kit-library__card-art">
              <span className="career-kit-library__card-number">{item.number} <i /> {item.collection}</span>
              <CareerShirt identity={{ ...identity, kitDesignId: item.id }} name={item.name} scale="profile" />
              {selected.id === item.id && <i className="career-kit-library__card-check"><Check size={13} aria-hidden="true" /></i>}
            </span>
            <span className="career-kit-library__card-copy"><strong>{item.name}</strong><small>{item.cut}</small></span>
          </button>
        ))}
        {!visible.length && <p className="career-kit-library__empty">No shirts match. Try a different search or collection.</p>}
      </div>
      <footer className="career-kit-library__pagination">
        <span>{filtered.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}` : "0"} of {filtered.length} shirts</span>
        <div><button type="button" aria-label="Previous designs" disabled={disabled || page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={16} /></button>
          <span>PAGE {page + 1} / {pages}</span><button type="button" aria-label="Next designs" disabled={disabled || page + 1 >= pages} onClick={() => setPage(value => Math.min(pages - 1, value + 1))}><ChevronRight size={16} /></button></div>
      </footer>
    </section>
  );
}
