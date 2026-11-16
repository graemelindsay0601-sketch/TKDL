import test from "node:test";
import assert from "node:assert/strict";
import { renewalRaise, raisedRenewalTerms, loyaltyRaise, loyaltyBonus } from "../../career/finance/engine.ts";
import { sponsorCatalogue } from "../../career/finance/sponsors.catalogue.ts";

test("renewals pay 10% more per title on the deal, up to 50%", () => {
  assert.equal(renewalRaise(0), 0);
  assert.equal(renewalRaise(2), 0.2);
  assert.equal(renewalRaise(9), 0.5);
});

test("a raised renewal lifts the money terms and nothing else", () => {
  const local = sponsorCatalogue(10).find(d => d.terms.tier === "LOCAL" && d.terms.eventPayment)!.terms;
  const raised = raisedRenewalTerms(local, 0.2);
  assert.equal(raised.contractFoundation!.guaranteedPayments[0].amountPence, Math.round(local.contractFoundation!.guaranteedPayments[0].amountPence * 1.2));
  assert.equal(raised.eventPayment!.amountPence, Math.round(local.eventPayment!.amountPence * 1.2));
  assert.deepEqual(raised.performanceBonuses.map(b => b.amountPence), local.performanceBonuses.map(b => Math.round(b.amountPence * 1.2)));
  assert.deepEqual(raised.coverage, local.coverage);
  assert.deepEqual(raisedRenewalTerms(local, 0), local, "no titles: the same deal");
});

test("v10: local results bonuses triple, regional double, pro and elite unchanged; earlier versions untouched", () => {
  const v9 = new Map(sponsorCatalogue(9).map(d => [d.key, d.terms])), v10 = sponsorCatalogue(10);
  const factor = { LOCAL: 3, REGIONAL: 2, PROFESSIONAL: 1, ELITE: 1 } as const;
  for (const d of v10) {
    const before = v9.get(d.key)!;
    assert.equal(d.terms.sponsorDatabaseVersion, 10);
    assert.deepEqual(d.terms.performanceBonuses.map(b => b.amountPence), before.performanceBonuses.map(b => Math.round(b.amountPence * factor[d.terms.tier])), d.key);
    assert.equal(before.sponsorDatabaseVersion, 9);
  }
  const forge = v10.find(d => d.key === "forge-workwear")!.terms.performanceBonuses.find(b => b.key === "title")!;
  assert.equal(forge.amountPence, 3 * v9.get("forge-workwear")!.performanceBonuses.find(b => b.key === "title")!.amountPence);
});

test("loyalty: +5% a term up to 25%, and a loyalty bonus of half the signing fee after one term, the full fee from two", () => {
  assert.deepEqual([1, 2, 5, 9].map(loyaltyRaise), [0.05, 0.1, 0.25, 0.25]);
  assert.deepEqual([1, 2, 3].map(t => loyaltyBonus(20_000, t)), [10_000, 20_000, 20_000]);
});

test("raises are worked out from the sponsor's standard terms, so a renewed deal never snowballs", () => {
  const standard = sponsorCatalogue(10).find(d => d.terms.tier === "LOCAL" && d.terms.eventPayment)!.terms;
  const once = raisedRenewalTerms(standard, 0.5, standard);
  const twice = raisedRenewalTerms(once, 0.5, standard);
  assert.deepEqual(twice, once, "a second renewal at the same raise pays the same");
  const negotiated = structuredClone(standard); negotiated.eventPayment!.amountPence *= 3;
  assert.equal(raisedRenewalTerms(negotiated, 0.1, standard).eventPayment!.amountPence, negotiated.eventPayment!.amountPence, "a better negotiated amount is kept");
});

test("v10: a professional deal needs professional results, not a Vault night", () => {
  const vaultIn = (r: unknown): boolean => JSON.stringify(r).includes('"VAULT"');
  for (const d of sponsorCatalogue(10).filter(d => d.terms.tier === "PROFESSIONAL")) assert.ok(!vaultIn(d.offerRequirement), d.key);
  assert.ok(sponsorCatalogue(9).filter(d => d.terms.tier === "PROFESSIONAL").some(d => vaultIn(d.offerRequirement)), "v9 offers stay as they were");
});
