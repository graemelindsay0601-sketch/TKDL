import type { CSSProperties } from "react";
import { ConfirmButton } from "../components";
import { circuitLabel, formatPence, ledgerLabel, titleCase } from "../model";
import type { SponsorContract, SponsorOffer } from "../types";
import "./sponsor-offers.css";

type SponsorOfferCardProps = {
  offer: SponsorOffer;
  activeContracts: SponsorContract[];
  retired: boolean;
  replacementIds: string[];
  onReplacementChange: (contractId: string, checked: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
  acceptBusy: boolean;
  declineBusy: boolean;
};

export function SponsorOfferCard({
  offer,
  activeContracts,
  retired,
  replacementIds,
  onReplacementChange,
  onAccept,
  onDecline,
  acceptBusy,
  declineBusy,
}: SponsorOfferCardProps) {
  const { terms } = offer;
  const accent = isHexColour(terms.presentation.colour) ? terms.presentation.colour : "#d8b669";
  const monogram = getMonogram(terms.displayName);
  const duration = terms.duration.kind === "SEASONS"
    ? `${terms.duration.seasons} season${terms.duration.seasons === 1 ? "" : "s"}`
    : "Rest of this season";

  return (
    <article
      className="career-sponsor-offer"
      style={{ "--sponsor-accent": accent } as CSSProperties}
      data-sponsor-key={offer.sponsorKey}
      aria-label={`${terms.displayName} ${offer.kind === "RENEWAL" ? "renewal" : "sponsorship"} offer`}
    >
      <header className="career-sponsor-offer__hero">
        <div className="career-sponsor-offer__topline">
          <span className="career-sponsor-offer__eyebrow">Career partnership</span>
          <span className="career-sponsor-offer__expiry">Expires · S{offer.expires.season} W{offer.expires.week}</span>
        </div>

        <div className="career-sponsor-offer__identity">
          <SponsorEmblem monogram={monogram} sponsorKey={offer.sponsorKey} />
          <div className="career-sponsor-offer__brand-copy">
            <span className="career-sponsor-offer__tier">{titleCase(offer.tier)} partner</span>
            <h3>{terms.displayName}</h3>
            <span className={`career-sponsor-offer__kind ${offer.kind === "RENEWAL" ? "is-renewal" : ""}`}>
              {offer.kind === "RENEWAL" ? "Renewal offer" : "New partnership"}
            </span>
          </div>
        </div>

        <div className="career-sponsor-offer__headline-terms">
          <div className="career-sponsor-offer__signing">
            <span>{terms.signingBonusPence > 0 ? "Signing bonus" : "Upfront payment"}</span>
            <strong>{terms.signingBonusPence > 0 ? formatPence(terms.signingBonusPence) : "None"}</strong>
          </div>
          <div className="career-sponsor-offer__hero-detail">
            <span>Contract term</span>
            <strong>{duration}</strong>
          </div>
          {terms.eventPayment && (
            <div className="career-sponsor-offer__hero-detail">
              <span>Per event played</span>
              <strong>{formatPence(terms.eventPayment.amountPence)}</strong>
            </div>
          )}
        </div>

        <span className="career-sponsor-offer__watermark" aria-hidden="true">{monogram}</span>
        <span className="career-sponsor-offer__rule" aria-hidden="true" />
      </header>

      <div className="career-sponsor-offer__body">
        {terms.eventPayment && (
          <section className="career-sponsor-offer__subsection" aria-label="Event payment terms">
            <div className="career-sponsor-offer__section-heading">
              <span className="career-sponsor-offer__index">01</span>
              <h4>Appearance payment</h4>
            </div>
            <div className="career-sponsor-offer__detail-row">
              <div>
                <strong>{formatPence(terms.eventPayment.amountPence)} for each event played</strong>
                <small>
                  Up to {terms.eventPayment.maxEventsPerSeason} events per season
                  {terms.eventPayment.circuits.length > 0 && ` · ${terms.eventPayment.circuits.map(circuitLabel).join(", ")}`}
                </small>
              </div>
              <span className="career-sponsor-offer__detail-value">PER EVENT</span>
            </div>
          </section>
        )}

        {terms.coverage.length > 0 && (
          <section className="career-sponsor-offer__subsection" aria-label="Covered costs">
            <div className="career-sponsor-offer__section-heading">
              <span className="career-sponsor-offer__index">{terms.eventPayment ? "02" : "01"}</span>
              <h4>Tour support</h4>
            </div>
            <div className="career-sponsor-offer__coverage-list">
              {terms.coverage.map((coverage, index) => {
                const costLabels = coverage.costTypes.map(type => ledgerLabel(type).toLowerCase()).join(" + ");
                const caps = [
                  coverage.perEventCapPence != null ? `Up to ${formatPence(coverage.perEventCapPence)} per event` : null,
                  coverage.seasonCapPence != null ? `${formatPence(coverage.seasonCapPence)} season limit` : null,
                ].filter(Boolean);
                const circuits = coverage.circuits?.map(circuitLabel).join(", ");
                return (
                  <div className="career-sponsor-offer__coverage-row" key={`${costLabels}-${index}`}>
                    <span className="career-sponsor-offer__coverage-symbol" aria-hidden="true">✓</span>
                    <div className="career-sponsor-offer__coverage-copy">
                      <strong>{coverage.percent}% of {costLabels}</strong>
                      {(caps.length > 0 || circuits) && (
                        <small>{[...caps, circuits ? `Eligible circuits: ${circuits}` : null].filter(Boolean).join(" · ")}</small>
                      )}
                    </div>
                    <span className="career-sponsor-offer__coverage-rate">{coverage.percent}%</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {terms.performanceBonuses.length > 0 && (
          <section className="career-sponsor-offer__subsection" aria-label="Performance bonuses">
            <div className="career-sponsor-offer__section-heading">
              <span className="career-sponsor-offer__index">
                {String((terms.eventPayment ? 1 : 0) + (terms.coverage.length > 0 ? 1 : 0) + 1).padStart(2, "0")}
              </span>
              <h4>Performance bonuses</h4>
            </div>
            <div className="career-sponsor-offer__bonus-grid">
              {terms.performanceBonuses.map(bonus => (
                <div className="career-sponsor-offer__bonus" key={bonus.key}>
                  <span>{bonus.maxPosition === 1 ? "Tournament winner" : `Top ${bonus.maxPosition} finish`}</span>
                  <strong>{formatPence(bonus.amountPence)}</strong>
                  {(bonus.circuits?.length || bonus.classifications.length > 0) && (
                    <small>
                      {[bonus.circuits?.map(circuitLabel).join(", "), bonus.classifications.map(value => titleCase(value)).join(", ")]
                        .filter(Boolean).join(" · ")}
                    </small>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!retired && activeContracts.length > 0 && (
          <fieldset className="career-sponsor-offer__replace">
            <legend>Optional contract replacement</legend>
            <p>Existing compatible deals stay active unless you select one to replace.</p>
            <div className="career-sponsor-offer__replace-list">
              {activeContracts.map(contract => {
                const required = offer.conflictingContractIds?.includes(contract.id) ?? false;
                return (
                  <label key={contract.id}>
                    <input
                      type="checkbox"
                      checked={replacementIds.includes(contract.id)}
                      onChange={event => onReplacementChange(contract.id, event.target.checked)}
                    />
                    <span>{contract.terms.displayName}</span>
                    {required && <em>Required for this offer</em>}
                  </label>
                );
              })}
            </div>
            {offer.portfolioFull && <p className="career-sponsor-offer__portfolio-note">Your portfolio is full; select a contract to replace.</p>}
          </fieldset>
        )}

        {!retired && (
          <footer className="career-sponsor-offer__actions">
            <ConfirmButton
              label="Accept offer"
              confirmLabel="Sign contract"
              busy={acceptBusy}
              description={`Accept the ${terms.displayName} offer${replacementIds.length > 0
                ? `. Terminate only: ${activeContracts.filter(contract => replacementIds.includes(contract.id)).map(contract => contract.terms.displayName).join(", ")}.`
                : ". Keep all existing compatible deals."}`}
              onConfirm={onAccept}
            />
            <button className="career-btn career-btn-ghost career-sponsor-offer__decline" disabled={declineBusy} onClick={onDecline}>
              Decline offer
            </button>
          </footer>
        )}
      </div>
    </article>
  );
}

function SponsorEmblem({ monogram, sponsorKey }: { monogram: string; sponsorKey: string }) {
  const style = [...sponsorKey].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3;
  return (
    <span className="career-sponsor-offer__emblem" data-mark={style} aria-hidden="true">
      <span>{monogram}</span>
    </span>
  );
}

function getMonogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "SP").toUpperCase();
}

function isHexColour(value: string) {
  return /^#[\da-f]{6}$/i.test(value);
}
