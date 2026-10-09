import { useState, type CSSProperties } from "react";
import { ConfirmButton } from "../components";
import { circuitLabel, formatPence, ledgerLabel, titleCase } from "../model";
import type { SponsorContract, SponsorJourneyEvent, SponsorNegotiationChange, SponsorOffer } from "../types";
import "./sponsor-offers.css";

type SponsorOfferCardProps = {
  offer: SponsorOffer;
  activeContracts: SponsorContract[];
  retired: boolean;
  replacementIds: string[];
  onReplacementChange: (contractId: string, checked: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
  onNegotiate: (change: SponsorNegotiationChange) => void;
  acceptBusy: boolean;
  declineBusy: boolean;
  negotiateBusy: boolean;
};

export function SponsorOfferCard({
  offer,
  activeContracts,
  retired,
  replacementIds,
  onReplacementChange,
  onAccept,
  onDecline,
  onNegotiate,
  acceptBusy,
  declineBusy,
  negotiateBusy,
}: SponsorOfferCardProps) {
  const { terms } = offer;
  const [selectedTerm, setSelectedTerm] = useState("SIGNING_BONUS");
  const [requestedValue, setRequestedValue] = useState(String(Math.round(terms.signingBonusPence / 100)));
  const accent = isHexColour(terms.presentation.colour) ? terms.presentation.colour : "#d8b669";
  const monogram = getMonogram(terms.displayName);
  const duration = terms.duration.kind === "SEASONS"
    ? `${terms.duration.seasons} season${terms.duration.seasons === 1 ? "" : "s"}`
    : "Rest of this season";
  const negotiableTerms = [
    { value: "SIGNING_BONUS", label: "Signing bonus", current: Math.round(terms.signingBonusPence / 100), unit: "£", kind: "money" as const },
    ...(terms.eventPayment ? [{ value: "EVENT_PAYMENT", label: "Payment per event", current: Math.round(terms.eventPayment.amountPence / 100), unit: "£", kind: "money" as const }] : []),
    ...terms.coverage.map((coverage, index) => ({
      value: `COVERAGE:${index}`, label: `Coverage · ${coverage.costTypes.map(ledgerLabel).join(" / ")}`, current: coverage.percent, unit: "%", kind: "percent" as const,
    })),
    { value: "DURATION", label: "Contract duration", current: terms.duration.kind === "SEASONS" ? terms.duration.seasons : 1, unit: "seasons", kind: "duration" as const },
    ...terms.performanceBonuses.map(bonus => ({
      value: `PERFORMANCE:${encodeURIComponent(bonus.key)}`, label: `${bonus.maxPosition === 1 ? "Winner" : `Top ${bonus.maxPosition}`} bonus`, current: Math.round(bonus.amountPence / 100), unit: "£", kind: "money" as const,
    })),
  ];
  const selected = negotiableTerms.find(term => term.value === selectedTerm) ?? negotiableTerms[0];
  const journey = offer.journey ?? null;
  const canNegotiate = !retired && journey && ["OFFERED", "NEGOTIATING"].includes(journey.status) && journey.negotiationRounds < journey.maxRounds;
  const changeTerm = (value: string) => {
    setSelectedTerm(value);
    const next = negotiableTerms.find(term => term.value === value);
    if (next) setRequestedValue(String(next.current));
  };
  const submitNegotiation = () => {
    const amount = Number(requestedValue);
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) return;
    if (selected.kind === "percent") {
      const index = Number(selected.value.split(":")[1]);
      onNegotiate({ kind: "COVERAGE_PERCENT", index, percent: amount });
    } else if (selected.kind === "duration") {
      onNegotiate({ kind: "DURATION", seasons: amount });
    } else if (selected.value === "EVENT_PAYMENT") {
      onNegotiate({ kind: "EVENT_PAYMENT", amountPence: amount * 100 });
    } else if (selected.value.startsWith("PERFORMANCE:")) {
      onNegotiate({ kind: "PERFORMANCE_BONUS", key: decodeURIComponent(selected.value.slice("PERFORMANCE:".length)), amountPence: amount * 100 });
    } else {
      onNegotiate({ kind: "SIGNING_BONUS", amountPence: amount * 100 });
    }
  };

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
            {terms.category && <span className="career-sponsor-offer__category">{titleCase(terms.category.replaceAll("_", " "))}</span>}
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
        {journey && (
          <section className="career-sponsor-offer__journey" aria-label="Sponsor approach and negotiation">
            <div className="career-sponsor-offer__journey-heading">
              <div>
                <span className="career-sponsor-offer__eyebrow">How this offer arrived</span>
                <strong>{latestSummary(journey.timeline) ?? "A sponsor is ready to discuss a partnership."}</strong>
              </div>
              <span className="career-sponsor-offer__journey-round">
                {journey.negotiationRounds < journey.maxRounds
                  ? `Negotiation ${journey.negotiationRounds}/${journey.maxRounds}`
                  : "Final terms"}
              </span>
            </div>
            <div className="career-sponsor-offer__contact">
              <span aria-hidden="true">{monogram}</span>
              <div>
                <strong>{journey.representative?.displayName ?? `${terms.displayName} partnership team`}</strong>
                <small>{journey.representative?.role ?? "Partnership contact"} · {titleCase(journey.status)}</small>
              </div>
            </div>
            {approachIntroduction(journey.timeline) && (
              <p className="career-sponsor-offer__approach-copy">{approachIntroduction(journey.timeline)}</p>
            )}
            <ol className="career-sponsor-offer__timeline">
              {journey.timeline.slice(-4).map(event => (
                <li key={`${event.type}-${event.createdAt}`} data-kind={event.type}>
                  <i aria-hidden="true" />
                  <span>{String(event.details.headline ?? journeyEventLabel(event.type))}</span>
                  {event.type === "SPONSOR_COUNTERED" && <em>Revised terms</em>}
                </li>
              ))}
            </ol>
            {canNegotiate && (
              <div className="career-sponsor-offer__negotiation">
                <div className="career-sponsor-offer__section-heading">
                  <span className="career-sponsor-offer__index">ASK</span>
                  <h4>Propose one term</h4>
                </div>
                <div className="career-sponsor-offer__negotiation-controls">
                  <label>
                    <span>Term</span>
                    <select value={selected.value} onChange={event => changeTerm(event.target.value)}>
                      {negotiableTerms.map(term => <option key={term.value} value={term.value}>{term.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Requested value {selected.kind === "money" ? "(£)" : `(${selected.unit})`}</span>
                    <input
                      type="number"
                      min={selected.kind === "duration" && terms.duration.kind === "REMAINDER_OF_SEASON" ? 2 : 0}
                      max={selected.kind === "duration" ? 5 : selected.kind === "percent" ? 100 : 20_000_000}
                      step="1"
                      value={requestedValue}
                      onChange={event => setRequestedValue(event.target.value)}
                    />
                  </label>
                  <button type="button" className="career-btn career-btn-ghost" disabled={negotiateBusy} onClick={submitNegotiation}>
                    {negotiateBusy ? "Sending…" : "Send proposal"}
                  </button>
                </div>
                <small>Only terms already in this A4 offer can change. The sponsor can agree, counter, reject, or withdraw; at most two rounds.</small>
              </div>
            )}
          </section>
        )}

        <section className="career-sponsor-offer__meaning" aria-label="What this means for you">
          <div className="career-sponsor-offer__section-heading">
            <span className="career-sponsor-offer__index">TERMS</span>
            <h4>What this means for you</h4>
          </div>
          <ul>
            {whatThisMeans(terms).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
          </ul>
        </section>

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

function approachIntroduction(events: SponsorJourneyEvent[]) {
  const approach = events.find(event => event.type === "APPROACH");
  return typeof approach?.details.introduction === "string" ? approach.details.introduction : null;
}

function whatThisMeans(terms: SponsorOffer["terms"]) {
  const duration = terms.duration.kind === "SEASONS"
    ? `${terms.duration.seasons} season${terms.duration.seasons === 1 ? "" : "s"} from signing.`
    : "The agreement covers the rest of the current season after signing.";
  const items = [`The agreement runs for ${duration}`];

  if (terms.signingBonusPence > 0) {
    items.push(`A one-off ${formatPence(terms.signingBonusPence)} signing payment is credited when the contract is signed.`);
  }
  if (terms.eventPayment) {
    const circuits = terms.eventPayment.circuits.length > 0
      ? ` at ${terms.eventPayment.circuits.map(circuitLabel).join(", ")}`
      : "";
    items.push(`Earn ${formatPence(terms.eventPayment.amountPence)} for each eligible event played${circuits}, up to ${terms.eventPayment.maxEventsPerSeason} per season.`);
  }
  for (const coverage of terms.coverage) {
    const costLabels = coverage.costTypes.map(type => ledgerLabel(type).toLowerCase()).join(" and ");
    const limits = [
      coverage.perEventCapPence == null ? null : `${formatPence(coverage.perEventCapPence)} per event`,
      coverage.seasonCapPence == null ? null : `${formatPence(coverage.seasonCapPence)} per season`,
    ].filter(Boolean);
    const circuits = coverage.circuits?.length ? ` at ${coverage.circuits.map(circuitLabel).join(", ")}` : "";
    items.push(`${coverage.percent}% support for eligible ${costLabels}${circuits}${limits.length ? `, capped at ${limits.join(" and ")}` : ""}.`);
  }
  for (const bonus of terms.performanceBonuses) {
    const finish = bonus.maxPosition === 1 ? "a tournament win" : `a top-${bonus.maxPosition} finish`;
    const scope = [
      bonus.circuits?.length ? bonus.circuits.map(circuitLabel).join(", ") : null,
      bonus.classifications.length ? bonus.classifications.map(value => titleCase(value)).join(", ") : null,
    ].filter(Boolean);
    items.push(`A ${formatPence(bonus.amountPence)} performance bonus applies for ${finish}${scope.length ? ` at ${scope.join(" · ")}` : ""}.`);
  }
  items.push("Only the payments and cost support listed in this offer are included; it has no annual retainer.");
  return items;
}

function latestSummary(events: SponsorJourneyEvent[]) {
  const source = events.find(event => event.type === "INTEREST");
  return typeof source?.details.summary === "string" ? source.details.summary : null;
}

function journeyEventLabel(type: SponsorJourneyEvent["type"]) {
  switch (type) {
    case "INTEREST": return "Sporting result drew interest";
    case "APPROACH": return "Sponsor contact";
    case "OFFER_RECEIVED": return "Formal offer received";
    case "PLAYER_COUNTERED": return "You proposed a change";
    case "SPONSOR_COUNTERED": return "Sponsor returned a counter-offer";
    case "SPONSOR_ACCEPTED_REQUEST": return "Sponsor agreed to your request";
    case "SPONSOR_REJECTED": return "Sponsor closed the discussion";
    case "SPONSOR_WITHDREW": return "Sponsor withdrew the offer";
    case "PLAYER_WALKED_AWAY": return "You walked away";
    case "SIGNED": return "Partnership signed";
    case "OFFER_EXPIRED": return "Offer expired";
  }
}
