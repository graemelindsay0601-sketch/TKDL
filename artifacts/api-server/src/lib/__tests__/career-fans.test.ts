import { test } from "node:test";
import assert from "node:assert/strict";
import { fanFollowing, fanDemandUnits, fanSponsorPremium, crowdSupport, FANS, type FanEvidence, type FanResult } from "../../career/fans/model.ts";
import { calculateProductWeek, PRODUCT_ECONOMY } from "../../career/content/product-economy.ts";

const result = (over: Partial<FanResult> = {}): FanResult => ({ season: 1, tier: "STANDARD", country: "GBR", champion: false, final: false, qualifier: false, ...over });
const evidence = (over: Partial<FanEvidence> = {}): FanEvidence => ({ currentSeason: 1, homeCountry: "GBR", results: [], nineDarters: [], showmanAnswers: 0, ...over });

test("fans come only from what happened: bigger stages and titles win more, qualifiers nothing", () => {
  assert.equal(fanFollowing(evidence()).total, 0);
  const pro = fanFollowing(evidence({ results: [result()] })).total, title = fanFollowing(evidence({ results: [result({ champion: true })] })).total;
  const worlds = fanFollowing(evidence({ results: [result({ tier: "WORLD", champion: true })] })).total;
  assert.ok(pro < title && title < worlds, `${pro} < ${title} < ${worlds}`);
  assert.equal(fanFollowing(evidence({ results: [result({ qualifier: true, champion: true })] })).total, 0);
  const nine = fanFollowing(evidence({ nineDarters: [{ season: 1, televised: true, country: "GBR" }] })).total;
  assert.equal(nine, FANS.nineDarter.televised);
});

test("home and abroad, persona, and casual fans fading while a core stays", () => {
  const split = fanFollowing(evidence({ results: [result({ champion: true }), result({ country: "NLD", champion: true })] }));
  assert.equal(split.home, split.international);
  const plain = fanFollowing(evidence({ results: [result({ tier: "MAJOR", champion: true })] })).total;
  const showman = fanFollowing(evidence({ results: [result({ tier: "MAJOR", champion: true })], showmanAnswers: 100 })).total;
  assert.equal(showman, Math.round(plain * (1 + FANS.personaCap)), "persona boost is capped");
  const later = fanFollowing(evidence({ currentSeason: 6, results: [result({ tier: "MAJOR", champion: true })] }));
  assert.ok(later.total < plain && later.total >= Math.round(plain * FANS.core), "fades towards the loyal core");
  assert.deepEqual(later.bySeason.map(b => b.season), [1, 2, 3, 4, 5, 6]);
  assert.equal(later.thisSeason, 0);
  const big = fanFollowing(evidence({ results: [result({ tier: "WORLD", champion: true })] }));
  assert.deepEqual(big.milestones.map(m => m.fans), [1_000, 10_000]);
});

test("a following sells products, earns sponsor premiums and sways crowds; old saves keep demand v2", () => {
  assert.equal(fanDemandUnits(0), 0); assert.ok(fanDemandUnits(250_000) > fanDemandUnits(10_000)); assert.equal(fanDemandUnits(10_000_000), 20);
  assert.equal(fanSponsorPremium(19_999), 0); assert.equal(fanSponsorPremium(40_000), 0.1); assert.equal(fanSponsorPremium(5_000_000), 0.5);
  const base = calculateProductWeek("p", "SIGNATURE_DARTS", 1, 1), withFans = calculateProductWeek("p", "SIGNATURE_DARTS", 1, 1, null, { fans: 250_000 });
  assert.equal(base.demandVersion, PRODUCT_ECONOMY.demandVersion);
  assert.equal(withFans.demandVersion, PRODUCT_ECONOMY.fanDemandVersion);
  assert.equal(withFans.units, base.units + fanDemandUnits(250_000));
  assert.deepEqual(crowdSupport({ home: 150_000, international: 30_000 }, false), { home: "Firmly behind you", away: "Behind you" });
  assert.equal(crowdSupport({ home: 0, international: 30_000 }, true).away, "Mixed — some will boo");
});
