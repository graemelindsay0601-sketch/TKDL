import type { CSSProperties } from "react";
import { sponsorMarkIdentity } from "./brand-mark-identity";

export type SponsorMarkTheme = "light" | "dark" | "mono";

export function CareerSponsorMark({
  brandId,
  brandName,
  slot,
  theme = "light",
  compact = false,
}: {
  brandId?: string;
  brandName: string;
  slot: string;
  theme?: SponsorMarkTheme;
  compact?: boolean;
}) {
  const identity = sponsorMarkIdentity(brandId ?? brandName, brandName);
  const hue = theme === "mono" ? 0 : identity.hue;
  const ink = theme === "light" ? "#f7f4ed" : "#101923";
  const accent = theme === "mono" ? ink : `hsl(${hue} 76% 57%)`;
  const title = `${brandName} sponsor mark`;
  return (
    <svg className="career-sponsor-mark" viewBox={compact ? "0 0 48 48" : "0 0 220 58"}
      role="img" aria-label={title} style={{ "--mark-ink": ink, "--mark-accent": accent } as CSSProperties}>
      {compact ? (
        <>
          <circle cx="24" cy="24" r="21" fill="none" stroke="var(--mark-accent)" strokeWidth="2" />
          <path d={identity.emblem} fill="none" stroke="var(--mark-ink)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
          <text x="24" y="27" textAnchor="middle" dominantBaseline="middle" fill="var(--mark-accent)"
            fontSize="9" fontWeight="900">{identity.monogram}</text>
        </>
      ) : (
        <>
          <path d={identity.emblem} transform="translate(3 3) scale(.78)" fill="none" stroke="var(--mark-accent)" strokeWidth="3.6" />
          <path d={identity.emblem} transform="translate(3 3) scale(.78)" fill="none" stroke="var(--mark-ink)" strokeWidth="1.25" />
          <text x="46" y="30" fill="var(--mark-ink)" fontFamily="Oswald,Arial,sans-serif"
            fontSize="20" fontWeight="800" letterSpacing="1.1">{brandName.toUpperCase()}</text>
          <text x="47" y="47" fill="var(--mark-accent)" fontFamily="Arial,sans-serif"
            fontSize="7" fontWeight="700" letterSpacing="2.1">{slot.replaceAll("_", " ")}</text>
        </>
      )}
    </svg>
  );
}
