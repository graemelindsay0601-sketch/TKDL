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
  const identity = sponsorMarkIdentity(brandId, brandName);
  if (!identity) return null;
  const ink = theme === "dark" ? "#111923" : "#f7f4ed";
  const accent = theme === "mono" ? ink : theme === "dark" ? "#111923" : identity.primary;
  const detail = theme === "mono" ? ink : theme === "dark" ? "#283544" : identity.accent;
  const contrast = theme === "dark" ? "#f7f4ed" : "#101923";
  const title = `${brandName} sponsor mark`;
  return (
    <svg className={`career-sponsor-mark career-sponsor-mark--${theme}`} viewBox={compact ? "0 0 48 48" : "0 0 260 58"}
      role="img" aria-label={title} data-brand-id={identity.id} data-slot={slot}
      style={{ "--mark-ink": ink, "--mark-accent": accent, "--mark-detail": detail, "--mark-contrast": contrast } as CSSProperties}>
      {theme !== "mono" && <path d={identity.symbol} fill="none" stroke="var(--mark-contrast)"
        strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />}
      <path d={identity.symbol} fill="none" stroke="var(--mark-accent)" strokeWidth="2.7"
        strokeLinecap="round" strokeLinejoin="round" />
      {identity.sector === "EQUIPMENT" && <path d="M5 45h38" stroke="var(--mark-detail)" strokeWidth="1.1" />}
      {!compact && <>
        <path d="M57 47h188" stroke="var(--mark-accent)" strokeWidth="1.4" opacity=".75" />
        <text x="59" y="30" fill="var(--mark-ink)" fontFamily={identity.sector === "TRADES" ? "Georgia,serif" : "Oswald,Arial,sans-serif"}
          fontSize={brandName.length > 18 ? "11" : brandName.length > 13 ? "13" : "18"}
          fontWeight="800" letterSpacing={identity.sector === "FINANCIAL" ? ".25" : "1"}>{brandName.toUpperCase()}</text>
        <text x="60" y="43" fill="var(--mark-detail)" fontFamily="Arial,sans-serif"
          fontSize="6.5" fontWeight="700" letterSpacing="2">{identity.sector.replaceAll("_", " ")}</text>
      </>}
    </svg>
  );
}
