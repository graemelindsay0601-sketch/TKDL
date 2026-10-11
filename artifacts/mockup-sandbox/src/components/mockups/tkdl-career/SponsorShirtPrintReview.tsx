import { PremiumCareerShirt } from "../../../../../tkdl/src/features/career/apparel/premium-shirt";
import "./sponsor-shirt-print-review.css";

const all = [
  { brandId: "ironflight", brandName: "Ironflight", slot: "EQUIPMENT_PARTNER" },
  { brandId: "forge-sport", brandName: "Forge Sport", slot: "APPAREL_PARTNER" },
  { brandId: "vantage-darts", brandName: "Vantage Darts", slot: "PRIMARY_COMMERCIAL" },
  { brandId: "northway-logistics", brandName: "Northway Logistics", slot: "SECONDARY_COMMERCIAL" },
  { brandId: "garnock-garage", brandName: "Garnock Garage", slot: "LOCAL_REGIONAL_PARTNER" },
];
const cards = [
  { kit: "kit-50-01", title: "01 · Redline / single equipment partner", partners: [0] },
  { kit: "kit-50-01", title: "02 · Redline / three active sponsors", partners: [0, 2, 1] },
  { kit: "kit-50-01", title: "03 · Redline / full five-slot portfolio", partners: [0, 1, 2, 3, 4] },
  { kit: "kit-50-03", title: "04 · Flightpath / one local partner", partners: [4] },
  { kit: "kit-50-03", title: "05 · Flightpath / three partners", partners: [0, 2, 4] },
  { kit: "kit-50-03", title: "06 · Flightpath / five partner slots", partners: [0, 1, 2, 3, 4] },
  { kit: "kit-50-08", title: "07 · Heritage / one apparel partner", partners: [1] },
  { kit: "kit-50-08", title: "08 · Heritage / three partner slots", partners: [0, 1, 2] },
  { kit: "kit-50-08", title: "09 · Heritage / five partner slots", partners: [0, 1, 2, 3, 4] },
  { kit: "kit-50-08", title: "10 · Heritage / no active sponsor", partners: [] },
].map(card => ({
  ...card,
  sponsors: card.partners.map(index => ({
    ...all[index]!,
    theme: card.kit === "kit-50-08" ? "dark" as const : "light" as const,
  })),
}));

export default function SponsorShirtPrintReview() {
  return <main className="sponsor-print-review">
    <header><span>CAREER KIT ROOM · PRINT CALIBRATION</span><h1>One garment. Real contract marks.</h1>
      <p>Reference matrix rendered from the live apparel and sponsor mark components; not a separate shirt mockup.</p>
    </header>
    <section>{cards.map(card => <article key={card.title}>
      <div className="sponsor-print-review__art">
        <PremiumCareerShirt identity={{ kitDesignId: card.kit, kitTintEnabled: false }}
          sponsors={card.sponsors} name={card.title} scale="profile" artworkBaseUrl="/__mockup/" />
      </div>
      <h2>{card.title}</h2><small>{card.sponsors.length} sponsor{card.sponsors.length === 1 ? "" : "s"} · {card.kit}</small>
    </article>)}</section>
  </main>;
}
