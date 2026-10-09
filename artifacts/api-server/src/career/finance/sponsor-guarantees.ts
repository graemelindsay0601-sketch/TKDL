import type { SponsorTerms } from "./sponsors.catalogue.ts";

export type GuaranteedPaymentCadence = "ON_SIGNING" | "MONTHLY" | "PER_SEASON";
export type GuaranteedPaymentStatus = "PAID" | "DUE" | "SCHEDULED" | "PAST_DUE";

export type GuaranteeContract = {
  id: string;
  sponsor_key: string;
  terms: SponsorTerms;
  start_season: number;
  start_week: number;
  end_season: number;
  end_week: number;
};

export type ScheduledGuaranteePayment = {
  operationKey: string;
  contractId: string;
  sponsorKey: string;
  displayName: string;
  amountPence: number;
  cadence: GuaranteedPaymentCadence;
  termIndex: number;
  installment: number;
  installments: number;
  season: number;
  week: number;
  status?: GuaranteedPaymentStatus;
};

export type UnsupportedGuarantee = {
  contractId: string;
  sponsorKey: string;
  displayName: string;
  termIndex: number;
  amountPence: number;
  cadence: GuaranteedPaymentCadence;
  installments: number;
  reason: string;
};

const WEEKS_PER_SEASON = 52;
const careerTimeIndex = (season: number, week: number) => (season - 1) * WEEKS_PER_SEASON + week;

/**
 * A recurring guarantee amount is the total for each Career season. Split it
 * into whole-pence instalments, assigning any remainder pennies to the earliest
 * instalments. Recurring payments are evenly placed over the 52-week season:
 * four per-season instalments fall in Weeks 1, 14, 27 and 40.
 */
export function guaranteeScheduleIssue(cadence: GuaranteedPaymentCadence, installments: number, totalAmountPence: number): string | null {
  if (cadence === "ON_SIGNING" && installments !== 1) return "A signing guarantee must be one instalment.";
  if (cadence === "MONTHLY" && installments !== 12) return "Monthly guarantees require 12 instalments per Career season.";
  if (cadence === "PER_SEASON" && installments > WEEKS_PER_SEASON) return "A Career season has 52 weeks, so it supports at most 52 per-season instalments.";
  if (totalAmountPence > 0 && totalAmountPence < installments) return "The total guarantee is too small to split into positive whole-pence instalments.";
  return null;
}

function installmentAmountPence(totalAmountPence: number, installmentIndex: number, installmentCount: number): number {
  const base = Math.floor(totalAmountPence / installmentCount);
  const remainder = totalAmountPence % installmentCount;
  return base + (installmentIndex < remainder ? 1 : 0);
}

export function guaranteeOperationKey(contractId: string, termIndex: number, season: number, week: number, installment: number) {
  return `sponsor-guarantee:${contractId}:${termIndex}:${season}:${week}:${installment}`;
}

export function scheduleContractGuarantees(contract: GuaranteeContract): {
  payments: ScheduledGuaranteePayment[];
  unsupported: UnsupportedGuarantee[];
} {
  const payments: ScheduledGuaranteePayment[] = [];
  const unsupported: UnsupportedGuarantee[] = [];
  const rules = contract.terms.contractFoundation?.guaranteedPayments ?? [];
  const contractStart = careerTimeIndex(contract.start_season, contract.start_week);
  const contractEnd = careerTimeIndex(contract.end_season, contract.end_week);

  rules.forEach((rule, termIndex) => {
    if (rule.amountPence <= 0) return;
    const issue = guaranteeScheduleIssue(rule.cadence, rule.installments, rule.amountPence);
    if (issue) {
      unsupported.push({
        contractId: contract.id,
        sponsorKey: contract.sponsor_key,
        displayName: contract.terms.displayName,
        termIndex,
        amountPence: rule.amountPence,
        cadence: rule.cadence,
        installments: rule.installments,
        reason: issue,
      });
      return;
    }

    if (rule.cadence === "ON_SIGNING") {
      payments.push({
        operationKey: guaranteeOperationKey(contract.id, termIndex, contract.start_season, contract.start_week, 1),
        contractId: contract.id,
        sponsorKey: contract.sponsor_key,
        displayName: contract.terms.displayName,
        amountPence: rule.amountPence,
        cadence: rule.cadence,
        termIndex,
        installment: 1,
        installments: 1,
        season: contract.start_season,
        week: contract.start_week,
      });
      return;
    }

    for (let season = contract.start_season; season <= contract.end_season; season += 1) {
      for (let installmentIndex = 0; installmentIndex < rule.installments; installmentIndex += 1) {
        const week = Math.floor(installmentIndex * WEEKS_PER_SEASON / rule.installments) + 1;
        const period = careerTimeIndex(season, week);
        if (period < contractStart || period > contractEnd) continue;
        const installment = installmentIndex + 1;
        payments.push({
          operationKey: guaranteeOperationKey(contract.id, termIndex, season, week, installment),
          contractId: contract.id,
          sponsorKey: contract.sponsor_key,
          displayName: contract.terms.displayName,
          amountPence: installmentAmountPence(rule.amountPence, installmentIndex, rule.installments),
          cadence: rule.cadence,
          termIndex,
          installment,
          installments: rule.installments,
          season,
          week,
        });
      }
    }
  });

  payments.sort((a, b) => careerTimeIndex(a.season, a.week) - careerTimeIndex(b.season, b.week)
    || a.contractId.localeCompare(b.contractId) || a.termIndex - b.termIndex || a.installment - b.installment);
  return { payments, unsupported };
}

export function projectGuaranteePaymentStatus(
  payment: ScheduledGuaranteePayment,
  paidOperationKeys: ReadonlySet<string>,
  currentSeason: number,
  currentWeek: number,
): ScheduledGuaranteePayment {
  const due = careerTimeIndex(payment.season, payment.week);
  const current = careerTimeIndex(currentSeason, currentWeek);
  return {
    ...payment,
    status: paidOperationKeys.has(payment.operationKey) ? "PAID"
      : due < current ? "PAST_DUE"
        : due === current ? "DUE" : "SCHEDULED",
  };
}
