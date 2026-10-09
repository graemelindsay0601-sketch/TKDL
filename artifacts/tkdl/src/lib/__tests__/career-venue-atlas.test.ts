import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { LOCALITIES, localVenue } from "../../../../api-server/src/career/calendar/geography.ts";
import { COUNTRY_CONTENT, VENUE_CONTENT, venueContent } from "../../../../api-server/src/career/content/world.ts";
import type { WorldContent, WorldLocalitiesContent } from "../../../../api-server/src/career/content/service.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer;
let Atlas: Record<string, any>;
let Router: any;
const palace = VENUE_CONTENT.find(v => v.id === "the-palace-london")!;
const data: Pick<WorldContent, "venues" | "countries"> = {
  venues: VENUE_CONTENT,
  countries: COUNTRY_CONTENT,
};
const localities: WorldLocalitiesContent = LOCALITIES.map(({ key, region, country, city }) => ({
    key, region, country, city,
    venues: (["CLUB", "COUNTY"] as const).map(kind => venueContent(localVenue(key, kind).key)),
  }));

before(async () => {
  vite = await createServer({
    root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false },
  });
  [Atlas, Router] = await Promise.all([
    vite.ssrLoadModule("/src/features/career/pages/venue-atlas.tsx"),
    vite.ssrLoadModule("wouter").then(m => m.Router),
  ]);
});
after(async () => { await vite?.close(); });

function renderAtlas(detailId?: string, events: unknown[] = []) {
  const ctx = { save: { id: "11111111-1111-4111-8111-111111111111" } };
  return renderToStaticMarkup(h(Router, { ssrPath: "/career/test/world/venues" },
    h(Atlas.CareerVenueAtlas, { ctx, data, localities, events, detailId, eventsLoading: false, eventsError: null, onRetry: () => undefined })));
}

test("Career Venue Atlas covers all authored venues and generated locality identities", () => {
  const html = renderAtlas();
  assert.match(html, /60 world venues · 70 locality identities/);
  assert.match(html, /Find your stage/);
  assert.match(html, /career-palace-arena\.png/);
  assert.match(html, /career-venue-.*\.jpg/);
  assert.equal(data.venues.length, 60);
  assert.equal(localities.reduce((total, locality) => total + locality.venues.length, 0), 70);
});

test("venue artwork is mapped for every authored visual family", () => {
  const files = [
    ["pub-club", "career-venue-club.jpg"], ["social-club", "career-venue-social-club.jpg"],
    ["community-hall", "career-venue-county-hall.jpg"], ["sports-centre", "career-venue-sports-centre.jpg"],
    ["hotel-ballroom", "career-venue-hotel-ballroom.jpg"], ["conference", "career-venue-conference.jpg"],
    ["professional-floor", "career-venue-floor.jpg"], ["studio", "career-venue-studio.jpg"],
    ["historic-theatre", "career-venue-heritage-theatre.jpg"], ["modern-theatre", "career-venue-modern-theatre.jpg"],
    ["exhibition", "career-venue-exhibition.jpg"], ["small-arena", "career-venue-arena.jpg"],
    ["major-arena", "career-venue-major-arena.jpg"], ["international-arena", "career-venue-international-arena.jpg"],
    ["palace", "career-palace-arena.png"],
  ];
  for (const [family, file] of files) {
    const html = renderToStaticMarkup(h(Atlas.CareerVenueArtwork, { family }));
    assert.match(html, new RegExp(file.replace(".", "\\.")));
  }
});

test("a venue profile lists only actual current-season events attached to that venue", () => {
  const events = [
    { id: "palace-event", name: "Recorded Palace Event", status: "SCHEDULED", dates: { startWeek: 12 }, venue: { id: palace.id } },
    { id: "other-event", name: "Unrelated Hall Event", status: "SCHEDULED", dates: { startWeek: 13 }, venue: { id: "glasgow-hall" } },
  ];
  const html = renderAtlas(palace.id, events);
  assert.match(html, /Recorded Palace Event/);
  assert.doesNotMatch(html, /Unrelated Hall Event/);
});

test("locality profile identifies its generated venue type without invented schedule history", () => {
  const club = localities[0].venues.find(v => v.capacityBand === "CLUB")!;
  const html = renderAtlas(club.id);
  assert.match(html, new RegExp(club.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Generated from a Career locality/);
  assert.match(html, /No event at this destination is scheduled in the current season/);
});
