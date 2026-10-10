import { BadgeCheck, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { SponsorSigningReveal } from "../types";
import { circuitLabel, formatPence, ledgerLabel, titleCase } from "../model";
import { formatGuaranteeAmountPence, formatGuaranteeInstalmentSplit } from "./sponsor-guarantee-presentation";
import "./sponsor-offers.css";

export function SponsorSigningReveal({ deal, onDismiss }: { deal: SponsorSigningReveal; onDismiss: () => void }) {
  const terms = deal.terms;
  const activities=terms.contractFoundation?.activitySpecification;
  const treatment = deal.tier === "LOCAL" ? "local" : deal.tier === "ELITE" ? "elite" : "professional";
  const accent = /^#[\da-f]{6}$/i.test(terms.presentation.colour) ? terms.presentation.colour : "#d8b669";
  return (
    <section
      className="career-sponsor-signing"
      data-treatment={treatment}
      style={{ "--signing-accent": accent } as CSSProperties}
      role="status"
      aria-label={`${deal.displayName} partnership signed`}
    >
      <div className="career-sponsor-signing__mark" aria-hidden="true">
        <span>{getMonogram(deal.displayName)}</span>
        <BadgeCheck />
      </div>
      <div className="career-sponsor-signing__main">
        <div className="career-sponsor-signing__eyebrow">Partnership signed · {titleCase(deal.tier)} partner</div>
        <h2>{deal.displayName}</h2>
        <p className="career-sponsor-signing__term">Active from Season {deal.start.season}, Week {deal.start.week} · through Season {deal.end.season}, Week {deal.end.week}</p>
        <p className="career-sponsor-signing__term">
          {deal.playerName}{deal.category ? ` · ${titleCase(deal.category)}` : ""}
          {deal.representative?.displayName ? ` · Represented by ${deal.representative.displayName}${deal.representative.role ? `, ${deal.representative.role}` : ""}` : ""}
        </p>
        <div className="career-sponsor-signing__facts">
          <div><span>Signing payment</span><strong>{terms.signingBonusPence > 0 ? formatPence(terms.signingBonusPence) : "No signing payment"}</strong></div>
          {terms.eventPayment && <div><span>Per event played</span><strong>{formatPence(terms.eventPayment.amountPence)}</strong></div>}
          {(terms.contractFoundation?.guaranteedPayments ?? []).map((payment, index) => (
            <div key={`guarantee-${index}`}>
              <span>{payment.cadence === "ON_SIGNING" ? "Guaranteed at signing" : `Guaranteed ${payment.cadence === "MONTHLY" ? "monthly" : "per season"} · ${payment.installments} instalments`}</span>
              <strong>{payment.cadence === "ON_SIGNING" ? formatGuaranteeAmountPence(payment.amountPence)
                : `${formatGuaranteeAmountPence(payment.amountPence)} total per Career season · ${formatGuaranteeInstalmentSplit(payment.amountPence, payment.installments)}`}</strong>
            </div>
          ))}
          {terms.coverage.map((item, index) => (
            <div key={`${item.costTypes.join("-")}-${index}`}>
              <span>{item.percent}% {item.costTypes.map(ledgerLabel).join(" / ")} support</span>
              <strong>{item.seasonCapPence == null ? "No season cap" : `Up to ${formatPence(item.seasonCapPence)}/season`}</strong>
            </div>
          ))}
          {terms.performanceBonuses.map(bonus => (
            <div key={bonus.key}><span>{bonus.maxPosition === 1 ? "Potential winner bonus" : `Potential top ${bonus.maxPosition} bonus`}</span><strong>{formatPence(bonus.amountPence)} · conditional</strong></div>
          ))}
        </div>
        {activities && (activities.required.length+activities.optional.length)>0 && (
          <div className="career-sponsor-signing__facts" aria-label="Signed sponsor activities">
            {activities.required.map(item=>(
              <div key={item.id}><span>Required · {activityLabel(item.type)}</span><strong>Up to {item.maxPerSeason}/season · no extra fee</strong></div>
            ))}
            {activities.optional.map(item=>(
              <div key={item.id}><span>Optional · {activityLabel(item.type)}</span><strong>Unpaid · decline freely</strong></div>
            ))}
          </div>
        )}
        <small>These are the accepted A4 terms. Required activities are included with no extra fee; optional opportunities are unpaid. No automatic activity breach penalties apply. Only due payments count as cash; cost support is not cash, and result bonuses stay conditional until earned.</small>
      </div>
      <button className="career-sponsor-signing__close" type="button" aria-label="Close signing confirmation" onClick={onDismiss}><X /></button>
    </section>
  );
}

function activityLabel(type:string){return type.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());}

function getMonogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "SP").toUpperCase();
}
