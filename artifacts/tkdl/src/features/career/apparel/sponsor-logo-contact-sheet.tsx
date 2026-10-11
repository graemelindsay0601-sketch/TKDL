import { CareerSponsorMark } from "./brand-mark";
import { SPONSOR_LOGO_ASSETS } from "./brand-mark-identity";
import "./sponsor-logo-contact-sheet.css";

const sectors = [...new Set([...SPONSOR_LOGO_ASSETS.values()].map(brand => brand.sector))];

/** Review surface for checking all current sponsor identities side by side. */
export function SponsorLogoContactSheet() {
  return (
    <main className="career-sponsor-sheet">
      <header className="career-sponsor-sheet__header">
        <div><span>CAREER COMMERCIAL IDENTITY</span><h1>Sponsor mark review</h1></div>
        <strong>{SPONSOR_LOGO_ASSETS.size} catalogue identities</strong>
      </header>
      {sectors.map(sector => {
        const brands = [...SPONSOR_LOGO_ASSETS.values()].filter(brand => brand.sector === sector);
        return <section className="career-sponsor-sheet__sector" key={sector}>
          <header><h2>{sector}</h2><span>{brands.length} brands</span></header>
          <div className="career-sponsor-sheet__grid">
            {brands.map(brand => <article className="career-sponsor-sheet__brand" key={brand.id}>
              <CareerSponsorMark brandId={brand.id} brandName={brand.name} slot={brand.sector} />
              <div className="career-sponsor-sheet__variants" aria-label={`${brand.name} print colour treatments`}>
                <span className="career-sponsor-sheet__variant career-sponsor-sheet__variant--dark">
                  <CareerSponsorMark brandId={brand.id} brandName={brand.name} slot={brand.sector} compact theme="light" />
                </span>
                <span className="career-sponsor-sheet__variant career-sponsor-sheet__variant--light">
                  <CareerSponsorMark brandId={brand.id} brandName={brand.name} slot={brand.sector} compact theme="dark" />
                </span>
                <span className="career-sponsor-sheet__variant career-sponsor-sheet__variant--mono">
                  <CareerSponsorMark brandId={brand.id} brandName={brand.name} slot={brand.sector} compact theme="mono" />
                </span>
              </div>
              <small>{brand.id} · {brand.name}</small>
            </article>)}
          </div>
        </section>;
      })}
    </main>
  );
}
