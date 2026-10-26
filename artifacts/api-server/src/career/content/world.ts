import { COUNTRIES, LOCALITIES, VENUES, venueByKey, type Venue } from "../calendar/geography.ts";

/** Portable fictional content. No account, scorer, ability or monetary authority. */
export const WORLD_CONTENT_VERSION = 1;
export const ORGANISATIONS = [
  { id: "wdu", name: "World Darts Union", shortName: "WDU", role: "Senior professional organisation", authority: "A5 rankings, Cards and qualification" },
  { id: "iodf", name: "International Open Darts Federation", shortName: "IODF", role: "Open and international pathways", authority: "A3 events; supported A5 rankings" },
  { id: "yda", name: "Youth Darts Alliance", shortName: "YDA", role: "Foundation and youth development", authority: "A3 age eligibility and events" },
  { id: "vault", name: "Vault Darts", shortName: "Vault", role: "Commercial non-Card promoter, not a governing body", authority: "A3 events; A5 sporting facts" },
] as const;
export const CIRCUIT_CONTENT = [
  ["grassroots", "Local & Open Darts", "iodf", "GRASSROOTS"],
  ["county", "County & Area Darts", "iodf", "COUNTY"],
  ["regional", "Regional Circuit", "iodf", "REGIONAL"],
  ["open", "Open International Circuit", "iodf", "NATIONAL_AMATEUR"],
  ["foundation", "Foundation Series", "yda", "GRASSROOTS"],
  ["development", "Development Tour", "yda", "NATIONAL_AMATEUR"],
  ["youth-championships", "Youth Championships", "yda", "NATIONAL_AMATEUR"],
  ["women", "Women's Tour", "wdu", "NATIONAL_AMATEUR"],
  ["vault-tour", "Vault Tour", "vault", "VAULT"],
  ["vault-stage", "Vault Nights & Championship", "vault", "VAULT"],
  ["q-school", "WDU Qualifying School", "wdu", "Q_SCHOOL"],
  ["challenger", "WDU Challenger Tour", "wdu", "CHALLENGER"],
  ["pro-tour", "WDU Pro Tour", "wdu", "PRO_CIRCUIT"],
  ["continental", "Continental Series", "wdu", "EUROPEAN_SERIES"],
  ["majors", "WDU Major Championships", "wdu", "MAJOR"],
  ["palace", "Palace World Championship", "wdu", "WORLD_CHAMPIONSHIP"],
  ["international", "International Stage", "wdu", "WORLD_SERIES"],
  ["northern", "Northern Dart Circuit", "iodf", "NATIONAL_AMATEUR"],
  ["asia-pacific", "Asia-Pacific Dart Tour", "iodf", "NATIONAL_AMATEUR"],
  ["north-american", "North American Dart Tour", "iodf", "NATIONAL_AMATEUR"],
  ["australasian", "Australasian Dart Tour", "iodf", "NATIONAL_AMATEUR"],
  ["continental-open", "Continental Open Series", "iodf", "NATIONAL_AMATEUR"],
  // Event database v7 regional tours (affiliate second-tier tours with World Championship places).
  ["asian-tour", "Asian Tour", "iodf", "CHALLENGER"],
  ["north-american-tour", "North American Championship Tour", "iodf", "CHALLENGER"],
  ["soft-tip", "Soft-Tip Tour", "iodf", "SOFT_TIP"],
  ["pro-super-series", "Pro Super Series", "wdu", "INVITATIONAL"],
  ["oceanic-tour", "Oceanic Tour", "iodf", "CHALLENGER"],
  ["nordic-baltic-tour", "Nordic & Baltic Tour", "iodf", "CHALLENGER"],
  ["european-development", "European Development Series", "iodf", "CHALLENGER"],
].map(([id, name, organisationId, authorityCircuit]) => ({ id, name, organisationId, authorityCircuit }));
export { SEASON_GROUPINGS as SEASON_RHYTHM } from "../calendar/config.ts";
export const PRESTIGE_CLASSES = ["GRASSROOTS", "REGIONAL", "NATIONAL", "INTERNATIONAL_OPEN", "SECONDARY_TOUR", "PROFESSIONAL_TOUR", "STAGE_SERIES", "MAJOR", "WORLD_CHAMPIONSHIP"] as const;
export type PrestigeClass = typeof PRESTIGE_CLASSES[number];
export type EventContent = {
  version: number; canonicalEventId: string; organisationId: string; circuitId: string;
  eventClass: PrestigeClass; trophyId: string; titleSponsorId: string | null;
  longevity: "PERMANENT" | "RECURRING" | "ROTATING_VENUE" | "OCCASIONAL" | "RETIRABLE_MINOR";
  venueRotation?: string[]; fieldDescription: string; themeKey: string;
  trophyIdentity?:{id:string;designId:string};
  /** Player-facing circuit/tour name when the authority circuit label is too generic (v7 tours and ladders). */
  circuitName?: string;
  /** One-paragraph player-facing description of what the event is and what it leads to. */
  summary?: string;
  venue?: ReturnType<typeof venueContent>;
};
export const VENUE_FAMILIES = [
  "pub-club", "social-club", "community-hall", "sports-centre", "hotel-ballroom",
  "conference", "professional-floor", "studio", "historic-theatre", "modern-theatre",
  "exhibition", "small-arena", "major-arena", "international-arena", "palace",
] as const;
const COORDS: Record<string, [number, number]> = {
  Osaka: [34.69, 135.5], Nagoya: [35.18, 136.91], Chicago: [41.88, -87.63], Boston: [42.36, -71.06],
  Wellington: [-41.29, 174.78], Christchurch: [-43.53, 172.64], Gothenburg: [57.71, 11.97],
  London: [51.5, -0.12], Manchester: [53.48, -2.24], Liverpool: [53.41, -2.98],
  "Frimley Green": [51.30, -0.73], Douglas: [54.15, -4.48],
  Glasgow: [55.86, -4.25], Wolverhampton: [52.59, -2.13], Leeds: [53.8, -1.55],
  Cardiff: [51.48, -3.18], Dublin: [53.35, -6.26], Newcastle: [54.98, -1.61],
  Blackpool: [53.82, -3.05], Edinburgh: [55.95, -3.19], Berlin: [52.52, 13.4],
  Rotterdam: [51.92, 4.48], Prague: [50.08, 14.44], Antwerp: [51.22, 4.4],
  Copenhagen: [55.68, 12.57], Vienna: [48.21, 16.37], Warsaw: [52.23, 21.01],
  Munich: [48.14, 11.58], Budapest: [47.5, 19.04], Brussels: [50.85, 4.35],
  Barcelona: [41.39, 2.17], Düsseldorf: [51.23, 6.78], Dortmund: [51.51, 7.47],
  Sydney: [-33.87, 151.21], Toronto: [43.65, -79.38], "New York": [40.71, -74.01],
  Auckland: [-36.85, 174.76], Tokyo: [35.68, 139.69], "Las Vegas": [36.17, -115.14],
  Ayr: [55.46, -4.63], Kilmarnock: [55.61, -4.5], Aberdeen: [57.15, -2.09],
  Dundee: [56.46, -2.97], Inverness: [57.48, -4.22], Stirling: [56.12, -3.94],
  Galashiels: [55.62, -2.81], Belfast: [54.6, -5.93], Cork: [51.9, -8.47],
  Galway: [53.27, -9.05], Southampton: [50.91, -1.4], Bristol: [51.45, -2.59],
  Paris: [48.86, 2.35], Lyon: [45.76, 4.84], Stockholm: [59.33, 18.07],
  Tallinn: [59.44, 24.75], Helsinki: [60.17, 24.94], Madrid: [40.42, -3.7],
  Utrecht: [52.09, 5.12], Singapore: [1.35, 103.82], "Cape Town": [-33.93, 18.42],
  Melbourne: [-37.81, 144.96], Brisbane: [-27.47, 153.03], Canberra: [-35.28, 149.13],
  Adelaide: [-34.93, 138.60], "Newcastle NSW": [-32.93, 151.78], Calgary: [51.05, -114.07],
  Kilbirnie: [55.75, -4.69], Maastricht: [50.85, 5.69], Leeuwarden: [53.2, 5.8],
  Frankfurt: [50.11, 8.68], Leipzig: [51.34, 12.37], Bremen: [53.08, 8.8],
  Ghent: [51.05, 3.72], Liège: [50.63, 5.58], Basel: [47.56, 7.59], Perth: [-31.95, 115.86], Halifax: [44.65, -63.57],
};
export const slug = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const regionId = (country: string, region: string) => `region:${country.toLowerCase()}:${slug(region)}`;
export const cityId = (country: string, city: string) => `city:${country.toLowerCase()}:${slug(city)}`;
export function mapAnchor(city: string) {
  const p = COORDS[city];
  if (!p) throw new Error(`No authored map anchor for ${city}`);
  return { latitude: p[0], longitude: p[1], accuracy: "APPROXIMATE_CITY" as const };
}
function family(v: Venue): typeof VENUE_FAMILIES[number] {
  if (v.key === "the-palace-london") return "palace";
  if (v.key.startsWith("club-")) return v.key==="club-ayrshire"?"pub-club":"social-club";
  if(v.key==="the-foundry-manchester")return "major-arena";
  if(v.key==="harbour-rooms-dublin")return "hotel-ballroom";
  if(v.key==="kelvin-assembly")return "modern-theatre";
  if(v.key==="clyde-arena")return "small-arena";
  if (v.key.startsWith("county-hall-")) return "community-hall";
  if (/studio|foundry/.test(v.key)) return "studio";
  if (/floor|midlands-oche|rhein-hall/.test(v.key)) return "professional-floor";
  if (/conference|exchange|forum/.test(v.key)) return "conference";
  if (/theatre|assembly|caledonia/.test(v.key)) return "historic-theatre";
  if (/sports|centre/.test(v.key)) return "sports-centre";
  if (v.capacityTier === "ARENA") return v.country === "GBR" ? "major-arena" : "international-arena";
  return "exhibition";
}
export function venueContent(key: string) {
  const v = venueByKey(key), f = family(v);
  return { id: v.key, displayName: f === "palace" ? "Alexandra Grand Hall" : v.name,
    nickname: f === "palace" ? "The Palace" : null, countryId: v.country, regionId: regionId(v.country, v.region),
    cityId: cityId(v.country, v.city), city: v.city, region: v.region, venueType: f, capacityBand: v.capacityTier,
    atmosphereTags: f === "palace" ? ["historic-facade", "central-hall", "balcony", "winter-championship", "championship-honours"] :
      f === "studio" ? ["architectural", "compact", "stage-lighting"] : ["live-crowd", f],
    stageConfiguration: f === "professional-floor" || f === "sports-centre" ? "MULTI_BOARD_FLOOR" : "FEATURE_BOARD",
    themeKey: `venue:${f}`, mapAnchor: mapAnchor(v.city),
    history: { authority: "A3/A7.1/A7.6", venueKey: v.key, inventedMemories: false },
    permanentWorldHome: f === "palace" };
}
export const VENUE_CONTENT = VENUES.map(v => venueContent(v.key));
const regionSources = [...VENUES, ...LOCALITIES];
export const REGIONS = [...new Map(regionSources.map(v => [regionId(v.country, v.region),
  { id: regionId(v.country, v.region), name: v.region, countryId: v.country }])).values()];
export const CITIES = [...new Map(regionSources.map(v => [cityId(v.country, v.city),
  { id: cityId(v.country, v.city), name: v.city, countryId: v.country, regionId: regionId(v.country, v.region), mapAnchor: mapAnchor(v.city) }])).values()];
export const COUNTRY_CONTENT = Object.entries(COUNTRIES).map(([id, v]) => ({ id, ...v }));

export const TROPHIES = [
  ["silver-cup", "Classic Silver Cup", "handled-silver"],
  ["championship-cup", "Wide Championship Cup", "wide-silver"],
  ["tall-championship", "Tall Silver Championship", "tall-silver"],
  ["silver-bowl", "Silver Bowl", "silver-bowl"],
  ["championship-plate", "Championship Plate", "plate"],
  ["traditional-shield", "Traditional Shield", "shield"],
  ["wood-silver-shield", "Wood & Silver Shield", "wood-silver"],
  ["crystal-column", "Crystal Column", "crystal"],
  ["cut-glass", "Cut-Glass Championship", "cut-glass"],
  ["metal-sculpture", "Modern Metal Sculpture", "modern-metal"],
  ["dart-sculpture", "Abstract Dart Sculpture", "abstract-dart"],
  ["international-globe", "International Globe", "globe"],
  ["regional-craft", "Regional Craft Trophy", "regional-craft"],
  ["vault-geometric", "Vault Championship Trophy", "geometric-vault-mechanism"],
  ["youth-rising-star", "Youth Rising Star", "rising-star"],
  ["double-crown", "Double Crown Trophy", "paired-silver-arches"],
  ["open-masters-heritage", "Open Masters Heritage Trophy", "heritage-silver"],
  ["sovereign", "The Sovereign Trophy", "distinctive-tall-silver-not-a-crown"],
].map(([id, name, designKey]) => ({ id, name, designKey, themeKey: `trophy:${id}`, abilityEffects: false }));

export const GUIDE = [
  ["how-career-works", "How a Career works", "You start as an amateur at your local club. Enter events and play your matches on the live scorer; press Continue to move the weeks on between fixtures. Results earn prize money, ranking points and fans. Turning professional is an opportunity, not the objective: local, open and Vault darts are whole careers too. There is no XP; what you can enter depends on the real rules, your money and your diary."],
  ["first-weeks", "Your first weeks", "Start local. Cheap club nights near home pay for themselves if you win a round or two, and long trips can cost more than the prize. The Play page lists the best value first and warns you when even a win would lose money. Keep some money back for travel."],
  ["map-calendar", "Calendar and map", "A season is 52 weeks. Most events are at weekends, and events on the same days clash: you can only be at one. The map shows where everything is; travel costs depend on how far it is from your home region."],
  ["nights-out", "Nights Out", "Free nights in the week can go on your club (team nights and your own tournament), money matches, road trips to other towns' clubs, Pro-Am nights against touring pros, a webcam league and DartCast streams. Each takes a night, so plan them around your events: This week shows what every night holds."],
  ["money", "Money", "You can't go into debt. Entry fees, travel and hotels come out of your balance; prize money, sponsors, streams and money matches put money back. Sponsors can cover travel. Career money is separate from your real TKDL coins and can't be bought."],
  ["grassroots", "Grassroots darts", "Local, county and regional darts are a full career on their own, with cheap or free events every week. Your club points and county selection come from here."],
  ["open", "Open darts", "National and international opens have their own Open World Ranking. Doing well in opens builds your name and your balance, but doesn't give you a Tour Card."],
  ["vault", "Vault", "Vault is a commercial promoter outside the Tour Card system: floor tours, stage nights and the Vault Championship. Winning on Vault doesn't make you a professional."],
  ["q-school", "Q-School", "Q-School is the main way to win a Tour Card, every January from your very first season if you can pay the entry. Each Final Stage day winner earns a Card and more go down its Order of Merit. Missing out still gets you onto the Challenger Tour, and the best of the rest can play Pro Circuit events that season."],
  ["challenger", "Challenger Tour", "The Challenger Tour is the second tier for players without a Card. Get in through Q-School, a Challenger Tour Qualifier in the spring or summer, or last season's top 64. Its top two earn Tour Cards and a World Championship place; just taking part isn't enough."],
  ["cards", "Tour Cards", "A Tour Card lets you play the professional tour for a fixed term. When you win one you choose: take it and turn professional, or turn it down and stay amateur (it passes to the next player). Once taken it runs its term; you keep it by finishing high enough in the rankings. Money, equipment and sponsors never buy a Card."],
  ["wdu", "WDU", "The WDU (World Darts Union) is the body that runs the professional game in this world."],
  ["rankings", "Rankings", "Rankings come from prize money won at ranking events over a rolling period, published every week. Your position decides seedings and many ways into events. There are separate lists, including world, open, amateur, women's and youth."],
  ["qualification", "Getting into events", "Every event shows how you can get in: your ranking, a Tour Card, an invitation, or winning a qualifier. Qualifying doesn't enter you; you still have to enter, and a qualifier still has to be won."],
  ["continental", "Continental Series", "A run of international stage events with its own ranking; the top players go on to the Series Finals."],
  ["majors", "Majors", "The big televised events: the Match Trophy, Double Crown (double-in, double-out), Open Masters, Grand Championship and Finals. Each has its own way in, by ranking, qualifier or invitation."],
  ["worlds", "World Championship", "The Palace World Championship is the biggest event of the year: set play, longer matches in the later rounds and the Sovereign Trophy for the winner. You get there through the rankings, its qualifiers, or a breakout place for a big year on the Challenger Tour, Development Tour or Vault, winning the Amateur World Masters, or a big enough fan following. Road to the Tour shows where you stand."],
  ["youth", "Youth darts", "Foundation events are for under-18s; Development and Youth events are for under-23s on the day. Ageing out keeps your results, and young players can still enter senior and open events."],
  ["women", "Women's circuit", "Choosing the women's category opens the women's events to you. It never stops you entering mixed, open, Vault, Q-School, Challenger or professional events."],
  ["sponsors", "Sponsors", "Sponsors pay you and can cover your travel. Some deals are exclusive (one equipment brand, for example), so a new deal may mean dropping one that clashes. Sponsors never change how well you play."],
  ["formats", "Match formats", "Events use real formats: legs or sets, longer matches in later rounds, groups and knockouts, pairs and soft-tip. Your matches are played on the same scorer as the rest of TKDL."],
].map(([id, title, body]) => ({ id, title, body }));
export const ALMANAC = [
  { id: "players", authority: "A2", route: "world/players" }, { id: "rankings", authority: "A5", route: "rankings" },
  { id: "organisations", authority: "CONTENT", route: "world" }, { id: "circuits", authority: "CONTENT", route: "world" },
  { id: "events", authority: "A3", route: "calendar" }, { id: "venues", authority: "CONTENT", route: "world" },
  { id: "champions", authority: "A7.6", route: "history/championships" },
  { id: "records", authority: "A7.1/A7.6", route: "history/records" },
  { id: "hall-of-fame", authority: "A7.6", route: "history/hall" },
];
export const PRESENTATION_HOOKS = ["career.event.enter", "match.walkon", "match.win", "match.checkout", "tournament.champion", "major.champion", "world.champion"] as const;
