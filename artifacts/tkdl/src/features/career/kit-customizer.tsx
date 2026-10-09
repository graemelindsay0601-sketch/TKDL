import { useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Search, Shirt } from "lucide-react";
import { CAREER_KIT_DESIGNS } from "./kit-catalog";
import { CareerShirt, type ShirtIdentity, type ShirtPartner } from "./identity";
import "./kit-customizer.css";

const PAGE_SIZE = 12;
const collections = ["All shirts", "Precision", "Rivalry", "Heritage", "Energy", "After Dark"];
const colourways = [
  { name: "Midnight", primary: "#17243b", secondary: "#253149", trim: "#d7ba76" },
  { name: "Scarlet", primary: "#a92c43", secondary: "#481b2b", trim: "#f2b6bd" },
  { name: "Cobalt", primary: "#315eae", secondary: "#14295a", trim: "#72c4e8" },
  { name: "Emerald", primary: "#267457", secondary: "#123d34", trim: "#a3d9c2" },
  { name: "Violet", primary: "#705090", secondary: "#31203d", trim: "#d2a8e6" },
  { name: "Copper", primary: "#a75b38", secondary: "#572e2a", trim: "#e7bd88" },
  { name: "Glacier", primary: "#6ca4bd", secondary: "#253c59", trim: "#d9f1f7" },
  { name: "Custom", primary: "", secondary: "", trim: "" },
];

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
  const [collection, setCollection] = useState("All shirts");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [customColour, setCustomColour] = useState(identity.primaryColour ?? "#17243b");
  const selected = CAREER_KIT_DESIGNS.find(item => item.id === identity.kitDesignId) ?? CAREER_KIT_DESIGNS[0]!;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CAREER_KIT_DESIGNS.filter(item =>
      (collection === "All shirts" || item.collection === collection) &&
      (!query || `${item.name} ${item.cut} ${item.collection} ${item.detail}`.toLowerCase().includes(query)),
    );
  }, [collection, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const chooseColour = (colourway: typeof colourways[number]) => onChange({
    primaryColour: colourway.name === "Custom" ? customColour : colourway.primary,
    ...(colourway.name === "Custom" ? {} : { secondaryColour: colourway.secondary, accentColour: colourway.trim }),
  });

  return (
    <section className="career-kit-library" aria-label="Career shirt designer">
      <header className="career-kit-library__header">
        <div>
          <span className="career-kit-library__eyebrow"><Shirt size={13} aria-hidden="true" /> PLAYER IDENTITY · KIT LIBRARY</span>
          <h3>Pick your match shirt.</h3>
          <p>50 original designs across five collections. Every selection is cosmetic only.</p>
        </div>
        <span className="career-kit-library__count">50 <small>DESIGNS</small></span>
      </header>
      <div className="career-kit-library__feature">
        <div className="career-kit-library__feature-art">
          <CareerShirt identity={{ ...identity, kitDesignId: selected.id }} sponsors={sponsors} name={playerName} scale="profile" />
        </div>
        <div className="career-kit-library__feature-info">
          <span className="career-kit-library__eyebrow">SELECTED · {selected.number} / 50</span>
          <h4>{selected.name}</h4>
          <p>{selected.cut} <span>·</span> {selected.collection}</p>
          <small>{selected.detail}</small>
          <div className="career-kit-library__colourways" role="group" aria-label="Choose a shirt colourway">
            {colourways.map(colourway => colourway.name === "Custom" ? (
              <label key={colourway.name} className="career-kit-library__custom">
                <input type="color" value={customColour} disabled={disabled} aria-label="Choose custom shirt tint" onChange={event => { setCustomColour(event.target.value); onChange({ primaryColour: event.target.value }); }} />
                <span>Custom tint</span>
              </label>
            ) : (
              <button key={colourway.name} type="button" title={`${colourway.name} tint`} aria-label={`${colourway.name} shirt tint`}
                aria-pressed={identity.primaryColour === colourway.primary} disabled={disabled}
                onClick={() => chooseColour(colourway)} style={{ "--kit-swatch": colourway.primary } as CSSProperties} />
            ))}
          </div>
          <div className="career-kit-library__partner-note">
            {sponsors.length ? `Active contract marks shown: ${sponsors.map(partner => partner.brandName).join(", ")}.` : "Contract sponsors appear only when an active Career agreement provides them."}
          </div>
        </div>
      </div>
      <div className="career-kit-library__toolbar">
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
              <img src={`${import.meta.env.BASE_URL}assets/career-kit-library/${item.image}`} alt="" loading="lazy" />
              <span>{item.number}</span>{selected.id === item.id && <i><Check size={13} aria-hidden="true" /></i>}
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
