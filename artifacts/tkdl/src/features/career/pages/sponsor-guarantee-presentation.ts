import { formatPence } from "../model.ts";

export function formatGuaranteeAmountPence(amountPence: number): string {
  if (amountPence % 100 === 0) return formatPence(amountPence);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountPence / 100);
}

/**
 * Describes a total clause amount divided into positive whole-pence instalments.
 * Any remainder penny is assigned to the earliest instalments.
 */
export function formatGuaranteeInstalmentSplit(totalAmountPence: number, installments: number): string {
  if (!Number.isInteger(totalAmountPence) || !Number.isInteger(installments) || totalAmountPence < 0 || installments < 1) {
    return "Invalid instalment schedule";
  }

  const base = Math.floor(totalAmountPence / installments);
  const remainder = totalAmountPence % installments;
  if (remainder === 0) return `${formatGuaranteeAmountPence(base)} each`;

  const earlyCount = remainder === 1 ? "the first instalment" : `the first ${remainder} instalments`;
  const firstAmount = `${formatGuaranteeAmountPence(base + 1)} for ${earlyCount}`;
  const remainingCount = installments - remainder;
  return remainingCount > 0
    ? `${firstAmount}, then ${formatGuaranteeAmountPence(base)} for the remaining ${remainingCount} instalments`
    : firstAmount;
}
