export type Organisation = { id: string; name: string; shortName: string; role: string; authority: string };
export type Circuit = { id: string; name: string; organisationId: string; authorityCircuit: string };
export type EventFamily = { id: string; name: string; circuit: string; circuitName: string; eventClass: string; organisationId: string; plate: string };

// Fixture shape follows career/content/service.ts world.read() and is deliberately static in this preview.
export const organisations: Organisation[] = [
  { id: "wdu", name: "World Darts Union", shortName: "WDU", role: "Senior professional organisation", authority: "A5 rankings, Cards and qualification" },
  { id: "iodf", name: "International Open Darts Federation", shortName: "IODF", role: "Open and international pathways", authority: "A3 events; supported A5 rankings" },
  { id: "yda", name: "Youth Darts Alliance", shortName: "YDA", role: "Foundation and youth development", authority: "A3 age eligibility and events" },
  { id: "vault", name: "Vault Darts", shortName: "Vault", role: "Commercial non-Card promoter, not a governing body", authority: "A3 events; A5 sporting facts" },
];

export const circuits: Circuit[] = [
  ["grassroots", "Local & Open Darts", "iodf", "GRASSROOTS"], ["county", "County & Area Darts", "iodf", "COUNTY"],
  ["regional", "Regional Circuit", "iodf", "REGIONAL"], ["open", "Open International Circuit", "iodf", "NATIONAL_AMATEUR"],
  ["foundation", "Foundation Series", "yda", "GRASSROOTS"], ["development", "Development Tour", "yda", "NATIONAL_AMATEUR"],
  ["youth-championships", "Youth Championships", "yda", "NATIONAL_AMATEUR"], ["women", "Women's Tour", "wdu", "NATIONAL_AMATEUR"],
  ["vault-tour", "Vault Tour", "vault", "VAULT"], ["vault-stage", "Vault Nights & Championship", "vault", "VAULT"],
  ["q-school", "WDU Qualifying School", "wdu", "Q_SCHOOL"], ["challenger", "WDU Challenger Tour", "wdu", "CHALLENGER"],
  ["pro-tour", "WDU Pro Tour", "wdu", "PRO_CIRCUIT"], ["continental", "Continental Series", "wdu", "EUROPEAN_SERIES"],
  ["majors", "WDU Major Championships", "wdu", "MAJOR"], ["palace", "Palace World Championship", "wdu", "WORLD_CHAMPIONSHIP"],
  ["international", "International Stage", "wdu", "WORLD_SERIES"], ["northern", "Northern Dart Circuit", "iodf", "NATIONAL_AMATEUR"],
  ["asia-pacific", "Asia-Pacific Dart Tour", "iodf", "NATIONAL_AMATEUR"], ["north-american", "North American Dart Tour", "iodf", "NATIONAL_AMATEUR"],
  ["australasian", "Australasian Dart Tour", "iodf", "NATIONAL_AMATEUR"], ["continental-open", "Continental Open Series", "iodf", "NATIONAL_AMATEUR"],
  ["asian-tour", "Asian Tour", "iodf", "CHALLENGER"], ["north-american-tour", "North American Championship Tour", "iodf", "CHALLENGER"],
  ["soft-tip", "Soft-Tip Tour", "iodf", "SOFT_TIP"], ["pro-super-series", "Pro Super Series", "wdu", "INVITATIONAL"],
  ["oceanic-tour", "Oceanic Tour", "iodf", "CHALLENGER"], ["nordic-baltic-tour", "Nordic & Baltic Tour", "iodf", "CHALLENGER"],
  ["european-development", "European Development Series", "iodf", "CHALLENGER"],
].map(([id, name, organisationId, authorityCircuit]) => ({ id, name, organisationId, authorityCircuit }));

const rows: Array<[string, string, string, string, string, string]> = [
  ["local-club-night", "Local Club Night — Ayr", "GRASSROOTS", "Local & Open Darts", "GRASSROOTS", "pub-club"],
  ["open-weekly", "Open Weekly — Glasgow", "GRASSROOTS", "Local & Open Darts", "GRASSROOTS", "social-club"],
  ["county-series", "County Championship — Ayrshire", "COUNTY", "County & Area Darts", "REGIONAL", "community-hall"],
  ["regional-open", "Scottish Regional Open", "REGIONAL", "Regional Circuit", "REGIONAL", "sports-centre"],
  ["home-nations-series", "Home Nations Series", "NATIONAL_AMATEUR", "Regional Circuit", "NATIONAL", "conference"],
  ["open-tour", "International Open — Rotterdam", "NATIONAL_AMATEUR", "Open International Circuit", "NATIONAL", "exhibition"],
  ["foundation-open", "Foundation Open — Glasgow", "GRASSROOTS", "Foundation Series", "GRASSROOTS", "social-club"],
  ["development-tour", "Development Tour — Event 1", "NATIONAL_AMATEUR", "Development Tour", "NATIONAL", "professional-floor"],
  ["youth-world-masters", "Youth World Masters", "NATIONAL_AMATEUR", "Youth Championships", "INTERNATIONAL_OPEN", "modern-theatre"],
  ["womens-tour", "Women's Tour — Event 1", "NATIONAL_AMATEUR", "Women's Tour", "NATIONAL", "professional-floor"],
  ["vault-floor-tour", "Vault Tour — Event 1", "VAULT", "Vault Tour", "SECONDARY_TOUR", "professional-floor"],
  ["vault-nights", "Vault Nights Championship", "VAULT", "Vault Nights & Championship", "STAGE_SERIES", "studio"],
  ["q-school", "WDU Qualifying School", "Q_SCHOOL", "WDU Qualifying School", "SECONDARY_TOUR", "exhibition"],
  ["challenger-tour", "WDU Challenger Tour — Event 1", "CHALLENGER", "WDU Challenger Tour", "SECONDARY_TOUR", "professional-floor"],
  ["pro-tour", "WDU Pro Tour — Event 1", "PRO_CIRCUIT", "WDU Pro Tour", "PROFESSIONAL_TOUR", "professional-floor"],
  ["continental-series", "Continental Series — Rotterdam", "EUROPEAN_SERIES", "Continental Series", "STAGE_SERIES", "international-arena"],
  ["match-trophy", "The Match Trophy", "MAJOR", "WDU Major Championships", "MAJOR", "major-arena"],
  ["double-crown", "The Double Crown", "MAJOR", "WDU Major Championships", "MAJOR", "major-arena"],
  ["open-masters", "The Open Masters", "MAJOR", "WDU Major Championships", "MAJOR", "historic-theatre"],
  ["grand-championship", "The Grand Championship", "MAJOR", "WDU Major Championships", "MAJOR", "major-arena"],
  ["tour-finals", "The Tour Finals", "PRO_CIRCUIT", "WDU Pro Tour", "PROFESSIONAL_TOUR", "international-arena"],
  ["palace-world-championship", "The Palace World Championship", "WORLD_CHAMPIONSHIP", "Palace World Championship", "WORLD_CHAMPIONSHIP", "palace"],
  ["international-stage", "International Stage — Auckland", "WORLD_SERIES", "International Stage", "STAGE_SERIES", "international-arena"],
  ["northern-circuit", "Northern Dart Circuit — Event 1", "NATIONAL_AMATEUR", "Northern Dart Circuit", "NATIONAL", "community-hall"],
  ["asia-pacific-tour", "Asia-Pacific Dart Tour — Event 1", "NATIONAL_AMATEUR", "Asia-Pacific Dart Tour", "NATIONAL", "international-arena"],
  ["north-american-tour", "North American Dart Tour — Event 1", "NATIONAL_AMATEUR", "North American Dart Tour", "NATIONAL", "exhibition"],
  ["australasian-tour", "Australasian Dart Tour — Event 1", "NATIONAL_AMATEUR", "Australasian Dart Tour", "NATIONAL", "international-arena"],
  ["continental-open", "Continental Open — Antwerp", "NATIONAL_AMATEUR", "Continental Open Series", "NATIONAL", "exhibition"],
  ["asian-tour", "Asian Tour — Tokyo", "CHALLENGER", "Asian Tour", "SECONDARY_TOUR", "international-arena"],
  ["north-american-championship-tour", "North American Championship Tour", "CHALLENGER", "North American Championship Tour", "SECONDARY_TOUR", "major-arena"],
  ["soft-tip-tour", "Soft-Tip Tour", "SOFT_TIP", "Soft-Tip Tour", "NATIONAL", "studio"],
  ["pro-super-series", "Pro Super Series — Event 1", "INVITATIONAL", "Pro Super Series", "STAGE_SERIES", "studio"],
  ["oceanic-tour", "Oceanic Tour — Sydney", "CHALLENGER", "Oceanic Tour", "SECONDARY_TOUR", "international-arena"],
  ["nordic-baltic-tour", "Nordic & Baltic Tour — Stockholm", "CHALLENGER", "Nordic & Baltic Tour", "SECONDARY_TOUR", "international-arena"],
  ["european-development", "European Development Series — Rotterdam", "CHALLENGER", "European Development Series", "SECONDARY_TOUR", "professional-floor"],
];
export const families: EventFamily[] = rows.map(([id, name, circuit, circuitName, eventClass, plate]) => ({
  id, name, circuit, circuitName, eventClass, plate,
  organisationId: ["foundation", "development", "youth"].some(k => id.includes(k)) ? "yda" :
    id.startsWith("vault") ? "vault" : ["county", "regional", "open", "northern", "asia", "north-american", "australasian", "continental-open", "asian-tour", "oceanic", "nordic", "european-development", "soft-tip"].some(k => id.includes(k)) ? "iodf" : "wdu",
}));

export const familyImage = (plate: string) => {
  if (plate === "palace") return new URL("./assets/palace-stage.webp", import.meta.url).href;
  const images: Record<string, string> = {
    "pub-club": "career-venue-club.jpg", "social-club": "career-venue-social-club.jpg",
    "community-hall": "career-venue-county-hall.jpg", "sports-centre": "career-venue-sports-centre.jpg",
    "hotel-ballroom": "career-venue-hotel-ballroom.jpg", conference: "career-venue-conference.jpg",
    "professional-floor": "career-venue-floor.jpg", studio: "career-venue-studio.jpg",
    "historic-theatre": "career-venue-heritage-theatre.jpg", "modern-theatre": "career-venue-modern-theatre.jpg",
    exhibition: "career-venue-exhibition.jpg", "small-arena": "career-venue-arena.jpg",
    "major-arena": "career-venue-major-arena.jpg", "international-arena": "career-venue-international-arena.jpg",
  };
  return new URL(`./assets/${images[plate] ?? images.exhibition}`, import.meta.url).href;
};
