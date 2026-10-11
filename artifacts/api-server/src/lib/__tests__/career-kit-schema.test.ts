import assert from "node:assert/strict";
import { test } from "node:test";
import { canSelectCareerKit, cosmeticSchema } from "../../career/content/service.ts";

test("Career cosmetics accept historical and published Kit Studio IDs but reject unknown shirt IDs", () => {
  for (const id of ["kit-50-01", "kit-50-50", "kit-pro-01", "kit-pro-10", "kit-100-01", "kit-100-40",
    "kit-250-101", "kit-250-150", "kit-250-221", "kit-250-250"]) {
    assert.equal(cosmeticSchema.safeParse({ kitDesignId: id }).success, true, id);
  }
  for (const id of ["kit-50-00", "kit-50-51", "kit-pro-00", "kit-pro-11", "kit-100-00", "kit-100-41",
    "kit-250-100", "kit-250-251", "kit-unknown-01"]) {
    assert.equal(cosmeticSchema.safeParse({ kitDesignId: id }).success, false, id);
  }
});

test("manufacturer shirt access is checked against active contract brands but a saved shirt is retained", () => {
  const kit100Makers:Record<string,string>={
    "kit-100-05":"ironflight","kit-100-06":"redpoint-darts","kit-100-07":"ochre-darts","kit-100-08":"northline-darts",
    "kit-100-09":"keystone-darts","kit-100-10":"vector-nine","kit-100-19":"blackforge-darts","kit-100-20":"apex-arrow",
    "kit-100-21":"forge-sport","kit-100-22":"northstar-performance","kit-100-23":"baseline-athletic",
    "kit-100-24":"vela-sport","kit-100-25":"vantage-darts","kit-100-26":"northstar-performance",
    "kit-100-35":"blackforge-darts","kit-100-36":"apex-arrow","kit-100-37":"northline-darts",
    "kit-100-38":"vector-nine","kit-100-39":"vela-sport","kit-100-40":"baseline-athletic",
  };
  for (const [kitId,makerId] of Object.entries(kit100Makers)) {
    assert.equal(canSelectCareerKit(kitId, []), false, `${kitId} should need ${makerId}`);
    assert.equal(canSelectCareerKit(kitId, [makerId]), true, `${kitId} should unlock for ${makerId}`);
  }
  assert.equal(canSelectCareerKit("kit-250-151", []), false);
  assert.equal(canSelectCareerKit("kit-250-151", ["blackforge-darts"]), true);
  assert.equal(canSelectCareerKit("kit-250-151", [], "kit-250-151"), true);
  assert.equal(canSelectCareerKit("kit-100-05", []), false);
  assert.equal(canSelectCareerKit("kit-100-05", ["ironflight"]), true);
  assert.equal(canSelectCareerKit("kit-250-150", []), true);
  assert.equal(canSelectCareerKit("kit-250-999", ["blackforge-darts"]), false);
});
