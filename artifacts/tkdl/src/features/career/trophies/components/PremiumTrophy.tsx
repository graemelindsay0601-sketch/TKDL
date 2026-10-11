import type { CSSProperties, ReactNode } from "react";
import { Award, CircleDot } from "lucide-react";
import { RECOGNITION_ART, trophyArt, type TrophyArt } from "../manifest/trophy-manifest";
import { resolveAward, type AwardInput, type ResolvedAward } from "../manifest/award-policy";
import "../trophies.css";

export type TrophySize = "xs" | "sm" | "md" | "lg" | "hero";
/** Compatible with existing event content: `trophy` rows ({id,name,designKey}) and trophyIdentity metadata. */
export type TrophyIdentityInput = { id?: string | null; trophyId?: string | null; name?: string | null; designKey?: string | null; designId?: string | null };

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
export const trophyAssetUrl = (file: string) => `${BASE}assets/career-trophies/${file}`;
/** Shrinks long inscriptions to fit the fixed plinth plate (≈30% of the artwork width). */
export const plateScale = (text: string) => Math.min(0.028, 0.34 / Math.max(1, text.length)).toFixed(4);
const idOf = (t: TrophyIdentityInput) => t.id ?? t.trophyId ?? t.designId ?? null;

/**
 * Premium trophy renderer. Resolves the identity against the premium manifest;
 * an unknown identity renders an explicit, labelled fallback (never the old
 * generic SVG) and exposes data-missing-trophy for tests and reporting.
 */
export function PremiumTrophy({ trophy, size = "md", engraving, eventName, className = "", decorative = false }: {
  trophy: TrophyIdentityInput; size?: TrophySize; engraving?: string | null; eventName?: string; className?: string; decorative?: boolean;
}) {
  const id = idOf(trophy);
  const art: TrophyArt | null = trophyArt(id);
  if (!art) {
    return <figure className={`ct-trophy ct-size-${size} ct-missing ${className}`} data-missing-trophy={id ?? "none"} role="img"
      aria-label={`Trophy artwork unavailable for ${trophy.name ?? id ?? "unknown identity"}`}>
      <span className="ct-missing__mark" aria-hidden><Award size={28} /></span>
      <figcaption>{trophy.name ?? "Trophy"} · artwork unavailable</figcaption>
    </figure>;
  }
  const label = `${art.name}${eventName ? ` — ${eventName}` : ""}: ${art.description}`;
  return (
    <figure className={`ct-trophy ct-size-${size} ${className}`} data-trophy={art.id} data-design={art.designKey}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}>
      <span className="ct-trophy__halo" aria-hidden />
      <img src={trophyAssetUrl(art.file)} alt="" draggable={false} loading="lazy" decoding="async" className="ct-trophy__art" />
      {engraving && size !== "xs" && <span className="ct-trophy__plate" aria-hidden>
        <span style={{ fontSize: `calc(var(--ct-w) * ${plateScale(engraving)})` }}>{engraving}</span></span>}
    </figure>
  );
}

/** Plaque/medal recognition or a result-only marker — never a fabricated trophy. */
export function RecognitionMark({ form, size = "md", label }: { form: "PLAQUE" | "MEDAL" | "NONE"; size?: TrophySize; label: string }) {
  if (form === "NONE") return <figure className={`ct-trophy ct-size-${size} ct-result-only`} role="img" aria-label={label} data-award="RESULT_ONLY">
    <span className="ct-result-only__mark" aria-hidden><CircleDot size={22} /></span><figcaption>{label}</figcaption></figure>;
  const r = RECOGNITION_ART[form];
  return <figure className={`ct-trophy ct-size-${size}`} role="img" aria-label={`${r.name}: ${label}`} data-award="RECOGNITION" data-recognition={form}>
    <img src={trophyAssetUrl(r.file)} alt="" draggable={false} loading="lazy" decoding="async" className="ct-trophy__art" />
  </figure>;
}

/**
 * What the winner of an event is shown receiving, from the locked policy.
 * Pass the recorded event identity; `persistedTrophyId` (snapshot content) wins
 * over the policy's default design so a historical event never changes identity.
 */
export function AwardPresentation({ event, size = "md", eventName, persistedTrophyId, children }: {
  event: AwardInput; size?: TrophySize; eventName?: string; persistedTrophyId?: string | null; children?: ReactNode;
}) {
  const award = resolveAward(event);
  return <div className="ct-award" data-award={award.award} data-award-kind={award.kind}>
    {award.award === "PHYSICAL_TROPHY"
      ? <PremiumTrophy trophy={{ id: persistedTrophyId && trophyArt(persistedTrophyId) ? persistedTrophyId : award.trophyId }} size={size} engraving={award.inscription} eventName={eventName} />
      : <RecognitionMark form={award.award === "RECOGNITION" ? award.recognition ?? "PLAQUE" : "NONE"} size={size} label={awardLabel(award)} />}
    {children}
  </div>;
}
export function awardLabel(a: Pick<ResolvedAward, "award" | "kind" | "recognition">) {
  if (a.award === "PHYSICAL_TROPHY") return "Championship trophy";
  if (a.award === "RECOGNITION") return a.recognition === "MEDAL" ? "Winner's medal" : "Winner's plaque";
  return a.kind === "Q_SCHOOL_SESSION" ? "Q-School session win · no trophy" : a.kind === "QUALIFIER" ? "Qualifier win · no trophy" : "Result & prize · no trophy";
}

/** Group recorded wins by trophy identity, preserving every win in the count. */
export function groupTrophyWins<T extends { trophyIdentityId?: string; canonicalEventId?: string; eventId: string }>(wins: T[]) {
  const map = new Map<string, T[]>();
  for (const w of wins) { const k = w.trophyIdentityId ?? w.canonicalEventId ?? w.eventId; map.set(k, [...(map.get(k) ?? []), w]); }
  return [...map.entries()].map(([key, items]) => ({ key, count: items.length, items }));
}

/** Review sheet: every premium identity side by side. */
export function TrophyContactSheet({ ids, size = "md" }: { ids: string[]; size?: TrophySize }) {
  return <div className="ct-sheet" style={{ "--ct-cols": Math.min(6, ids.length) } as CSSProperties}>
    {ids.map(id => { const a = trophyArt(id); return <div key={id} className="ct-sheet__cell"><PremiumTrophy trophy={{ id }} size={size} />
      <strong>{a?.name ?? id}</strong><small>{a?.silhouette ?? "missing"}</small></div>; })}
  </div>;
}
