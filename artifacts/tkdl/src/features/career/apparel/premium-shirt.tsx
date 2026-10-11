import type { CSSProperties } from "react";
import { CAREER_KIT_BY_ID, CAREER_KIT_DESIGNS } from "../kit-catalog";
import type { ShirtIdentity, ShirtPartner } from "../identity";
import { CareerSponsorMark } from "./brand-mark";
import { garmentPrintZones } from "./print-zones";
import "./premium-shirt.css";

type ApparelPartner = ShirtPartner & { brandId?: string; theme?: "light" | "dark" | "mono" };

export function PremiumCareerShirt({
  identity = {},
  sponsors = [],
  name = "Career player",
  scale = "profile",
  debugZones = false,
  artworkBaseUrl = import.meta.env.BASE_URL,
}: {
  identity?: ShirtIdentity;
  sponsors?: ApparelPartner[];
  name?: string;
  scale?: "compact" | "standard" | "featured" | "profile";
  debugZones?: boolean;
  artworkBaseUrl?: string;
}) {
  const kit = CAREER_KIT_BY_ID.get(identity.kitDesignId ?? "") ?? CAREER_KIT_DESIGNS[0]!;
  const artwork = `${artworkBaseUrl}assets/career-kit-library/${kit.image}`;
  const zones = garmentPrintZones(kit);
  // Original artwork is the default. Only an explicit colourway choice (kitTintEnabled: true) tints the fabric:
  // every save carries a template primaryColour and NPC palettes have one too, which must not wash premium art.
  const tintEnabled = identity.kitTintEnabled === true && Boolean(identity.primaryColour);
  return (
    <span className={`career-premium-shirt career-premium-shirt--${scale}`}
      role="img" aria-label={`${name} wearing ${kit.name}${sponsors.length ? ` with ${sponsors.length} active sponsor marks` : ""}`}>
      <img className="career-premium-shirt__fabric" src={artwork} alt="" aria-hidden="true" />
      {tintEnabled && <span className="career-premium-shirt__tint" style={{
        "--fabric-mask": `url("${artwork}")`, "--shirt-tint": identity.primaryColour,
      } as CSSProperties} aria-hidden="true" />}
      <span className="career-premium-shirt__prints" style={{ "--fabric-mask": `url("${artwork}")` } as CSSProperties} aria-hidden="true">
        {sponsors.slice(0, 5).map((partner, index) => {
          const zone = zones.find(item => item.slot === partner.slot);
          if (!zone) return null;
          return <span key={`${partner.slot}:${partner.brandId ?? partner.brandName}:${index}`}
            className={`career-premium-shirt__zone career-premium-shirt__zone--${zone.treatment}`}
            style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}>
            <CareerSponsorMark brandId={partner.brandId} brandName={partner.brandName} slot={partner.slot}
              theme={partner.theme ?? "light"} compact={zone.treatment === "crest" || scale !== "featured"} />
          </span>;
        })}
      </span>
      {debugZones && <span className="career-premium-shirt__debug" aria-label="Garment print-zone debug overlay">
        {zones.map(zone => <i key={zone.slot} title={zone.slot} style={{
          left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`,
        }} />)}
      </span>}
    </span>
  );
}
