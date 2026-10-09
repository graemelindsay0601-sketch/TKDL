import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "../../..");

test("sponsor offer card renders authoritative terms, brand identity and existing contract actions", async () => {
  let vite: ViteDevServer | undefined;
  try {
    vite = await createServer({
      root: ROOT,
      configFile: path.join(ROOT, "vite.config.ts"),
      logLevel: "error",
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, ws: false },
    });
    const { SponsorOfferCard } = await vite.ssrLoadModule("/src/features/career/pages/sponsor-offer-card.tsx");
    const offer = {
      id: "iron-offer",
      sponsorKey: "ironflight",
      tier: "PROFESSIONAL",
      kind: "NEW" as const,
      status: "OFFERED",
      statusReason: null,
      offered: { season: 2, week: 4 },
      expires: { season: 2, week: 9 },
      conflictingContractIds: ["vector-contract"],
      portfolioFull: true,
      terms: {
        sponsorKey: "ironflight",
        displayName: "Ironflight Darts",
        tier: "PROFESSIONAL",
        duration: { kind: "SEASONS" as const, seasons: 2 },
        signingBonusPence: 250000,
        eventPayment: { amountPence: 15000, circuits: ["PRO_CIRCUIT"], maxEventsPerSeason: 8 },
        coverage: [{ costTypes: ["ENTRY_FEE", "TRAVEL"], percent: 80, perEventCapPence: 40000, seasonCapPence: 120000, circuits: ["PRO_CIRCUIT"] }],
        performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 300000, circuits: ["PRO_CIRCUIT"], classifications: ["MAJOR"] }],
        renewalRequirement: null,
        retentionRequirement: null,
        presentation: { colour: "#4882ac" },
      },
    };
    const activeContract = {
      id: "vector-contract",
      sponsorKey: "vector",
      tier: "REGIONAL",
      status: "ACTIVE",
      endReason: null,
      terms: { ...offer.terms, sponsorKey: "vector", displayName: "Vector Darts", presentation: { colour: "#44846d" } },
      start: { season: 1, week: 1 },
      end: { season: 2, week: 52 },
      totals: { paidPence: 0, coveredPence: 0 },
    };
    const html = renderToStaticMarkup(createElement(SponsorOfferCard, {
      offer,
      activeContracts: [activeContract],
      retired: false,
      replacementIds: [],
      onReplacementChange: () => {},
      onAccept: () => {},
      onDecline: () => {},
      acceptBusy: false,
      declineBusy: false,
    }));

    for (const expected of [
      "Ironflight Darts", "Professional partner", "Expires · S2 W9", "Signing bonus", "£2,500",
      "2 seasons", "£150 for each event played", "80% of entry fee + travel", "£400 per event",
      "£1,200 season limit", "£3,000", "Tournament winner", "Vector Darts", "Required for this offer",
      "Accept offer", "Decline offer",
    ]) {
      assert.ok(html.includes(expected), `missing rendered sponsor term or action: ${expected}`);
    }
    assert.ok(html.includes("--sponsor-accent:#4882ac"), "brand presentation colour is applied to the card");
    assert.ok(!/season guarantee|guaranteed income/i.test(html), "one-off signing money is not described as guaranteed season income");
  } finally {
    await vite?.close();
  }
});

test("sponsor renewals keep the same branded component and identify the renewal", async () => {
  let vite: ViteDevServer | undefined;
  try {
    vite = await createServer({
      root: ROOT,
      configFile: path.join(ROOT, "vite.config.ts"),
      logLevel: "error",
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false, ws: false },
    });
    const { SponsorOfferCard } = await vite.ssrLoadModule("/src/features/career/pages/sponsor-offer-card.tsx");
    const html = renderToStaticMarkup(createElement(SponsorOfferCard, {
      offer: {
        id: "northline-renewal", sponsorKey: "northline", tier: "ELITE", kind: "RENEWAL", status: "OFFERED",
        statusReason: null, offered: { season: 3, week: 2 }, expires: { season: 3, week: 5 },
        terms: {
          sponsorKey: "northline", displayName: "Northline Darts", tier: "ELITE",
          duration: { kind: "REMAINDER_OF_SEASON" }, signingBonusPence: 0, eventPayment: null,
          coverage: [], performanceBonuses: [], renewalRequirement: null, retentionRequirement: null,
          presentation: { colour: "#ad7b3b" },
        },
      },
      activeContracts: [], retired: false, replacementIds: [], onReplacementChange: () => {},
      onAccept: () => {}, onDecline: () => {}, acceptBusy: false, declineBusy: false,
    }));
    assert.ok(html.includes("Northline Darts"));
    assert.ok(html.includes("Renewal offer"));
    assert.ok(html.includes("Upfront payment"));
    assert.ok(html.includes("None"));
    assert.ok(html.includes("--sponsor-accent:#ad7b3b"));
  } finally {
    await vite?.close();
  }
});
