import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { stableUuid } from "../world/random.ts";
import { FINANCE_VERSION, HEADLINE_OF, type Headline, type LedgerCategory } from "./config.ts";

export type LedgerPosting = {
  operationKey: string; category: LedgerCategory; amountPence: number; reason: string;
  season?: number | null; week?: number | null; eventId?: string | null; tripId?: string | null; contractId?: string | null;
  reversesEntryId?: string | null; grossAmountPence?: number | null; sponsorCoveredPence?: number; detail?: Record<string, unknown>;
  /** Required for ADJUSTMENT/REFUND reversals: headline of the original movement. */
  headline?: Headline;
};
export type LedgerRow = { id: string; operation_key: string; category: LedgerCategory; headline: Headline; amount_pence: number;
  season: number | null; week: number | null; event_id: string | null; trip_id: string | null; contract_id: string | null;
  reverses_entry_id: string | null; gross_amount_pence: number | null; sponsor_covered_pence: number; reason: string | null; detail: Record<string, unknown>; created_at: unknown };

export class InsufficientFundsError extends CareerError {
  readonly code = "INSUFFICIENT_FUNDS";
  readonly requiredPence: number;
  readonly availablePence: number;
  constructor(requiredPence: number, availablePence: number) {
    super(409, `Insufficient Career funds: need ${requiredPence}p, have ${availablePence}p`);
    this.requiredPence = requiredPence;
    this.availablePence = availablePence;
  }
}

/**
 * The only writer of Career money. Inside the caller's transaction (root already
 * locked): idempotent per (save, operation_key); the balance cache moves in the
 * same statement sequence and the guarded UPDATE refuses to go below zero, so an
 * affordability check can never be separated from the debit.
 * Returns the persisted row (existing row on retry).
 */
export async function post(tx: CareerExecutor, root: { id: string; world_seed: string }, entry: LedgerPosting): Promise<{ row: LedgerRow; created: boolean }> {
  if (!Number.isSafeInteger(entry.amountPence)) throw new Error("Ledger amounts are integer pence");
  const existing = (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${root.id} AND operation_key = ${entry.operationKey}`)).rows[0] as LedgerRow | undefined;
  if (existing) {
    if (existing.category !== entry.category || Number(existing.amount_pence) !== entry.amountPence) throw new CareerError(409, "Ledger operation identity was already used with different inputs");
    return { row: existing, created: false };
  }
  const headline: Headline = entry.headline ?? (entry.category === "REFUND" ? "EXPENSE" : HEADLINE_OF[entry.category as keyof typeof HEADLINE_OF]);
  if (!headline) throw new Error(`Headline required for ${entry.category}`);
  if (entry.amountPence !== 0) {
    const moved = (await tx.execute(sql`UPDATE career_saves SET balance_pence = balance_pence + ${entry.amountPence}, updated_at = NOW()
      WHERE id = ${root.id} AND balance_pence + ${entry.amountPence} >= 0 RETURNING balance_pence`)).rows[0];
    if (!moved) {
      const balance = Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${root.id}`)).rows[0]?.balance_pence ?? 0);
      throw new InsufficientFundsError(-entry.amountPence, balance);
    }
  }
  const id = stableUuid(root.world_seed, FINANCE_VERSION, "ledger", entry.operationKey);
  const row = (await tx.execute(sql`INSERT INTO career_finance_entries (id, career_save_id, kind, amount_pence, category, headline, operation_key, season, week,
      event_id, trip_id, contract_id, reverses_entry_id, gross_amount_pence, sponsor_covered_pence, finance_version, reason, detail)
    VALUES (${id}, ${root.id}, ${entry.category}, ${entry.amountPence}, ${entry.category}, ${headline}, ${entry.operationKey}, ${entry.season ?? null}, ${entry.week ?? null},
      ${entry.eventId ?? null}, ${entry.tripId ?? null}, ${entry.contractId ?? null}, ${entry.reversesEntryId ?? null}, ${entry.grossAmountPence ?? null},
      ${entry.sponsorCoveredPence ?? 0}, ${FINANCE_VERSION}, ${entry.reason}, ${JSON.stringify(entry.detail ?? {})}::jsonb)
    RETURNING *`)).rows[0] as LedgerRow;
  return { row, created: true };
}

/**
 * Four headlines, each a pure aggregate over the immutable ledger:
 *   balance          = SUM(all amounts)
 *   careerEarnings   = SUM(EARNINGS)   (prize money)
 *   sponsorEarnings  = SUM(SPONSOR)    (signing bonuses, event payments, performance bonuses)
 *   careerExpenses   = −SUM(EXPENSE)   (player-paid fees/travel/accommodation net of refunds)
 * Identity: start + careerEarnings + sponsorEarnings − careerExpenses = balance.
 */
export async function summary(tx: CareerExecutor, saveId: string) {
  const rows = (await tx.execute(sql`SELECT headline, COALESCE(SUM(amount_pence), 0)::bigint AS total, COUNT(*)::int AS n,
      COALESCE(SUM(sponsor_covered_pence), 0)::bigint AS covered
    FROM career_finance_entries WHERE career_save_id = ${saveId} GROUP BY headline`)).rows;
  const by = (h: Headline) => rows.find(r => r.headline === h);
  const total = (h: Headline) => Number(by(h)?.total ?? 0);
  const ledgerBalance = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const cached = Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${saveId}`)).rows[0]?.balance_pence ?? 0);
  return {
    currency: "GBP" as const,
    balancePence: cached,
    startingBalancePence: total("START"),
    careerEarningsPence: total("EARNINGS"),
    sponsorEarningsPence: total("SPONSOR"),
    careerExpensesPence: 0 - total("EXPENSE"),
    sponsorCoveredExpensesPence: Number(by("EXPENSE")?.covered ?? 0),
    ledgerEntries: rows.reduce((sum, r) => sum + Number(r.n), 0),
    reconciled: ledgerBalance === cached && total("START") + total("EARNINGS") + total("SPONSOR") + total("EXPENSE") === cached,
    ledgerBalancePence: ledgerBalance,
  };
}

/** Rebuild the A1 balance cache from the ledger (repair tool; normal operation never needs it). */
export async function rebuildBalanceCache(tx: CareerExecutor, saveId: string) {
  const total = Number((await tx.execute(sql`SELECT COALESCE(SUM(amount_pence), 0)::bigint AS t FROM career_finance_entries WHERE career_save_id = ${saveId}`)).rows[0].t);
  await tx.execute(sql`UPDATE career_saves SET balance_pence = ${total} WHERE id = ${saveId}`);
  return total;
}

export async function recentEntries(tx: CareerExecutor, saveId: string, limit: number, before?: { createdAt: string; id: string }) {
  return (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${saveId}
    ${before ? sql`AND (created_at, id) < (${before.createdAt}::timestamptz, ${before.id}::uuid)` : sql``}
    ORDER BY created_at DESC, id DESC LIMIT ${limit}`)).rows as LedgerRow[];
}

export const presentEntry = (r: LedgerRow) => ({
  id: r.id, operationKey: r.operation_key, category: r.category, headline: r.headline, amountPence: Number(r.amount_pence),
  direction: Number(r.amount_pence) >= 0 ? "CREDIT" : "DEBIT", season: r.season, week: r.week, eventId: r.event_id, tripId: r.trip_id,
  contractId: r.contract_id, reversesEntryId: r.reverses_entry_id, grossAmountPence: r.gross_amount_pence === null ? null : Number(r.gross_amount_pence),
  sponsorCoveredPence: Number(r.sponsor_covered_pence), reason: r.reason, detail: r.detail, createdAt: r.created_at,
});
