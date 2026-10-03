/**
 * Stable geography + venue catalogue (event database v1). Historical rows store
 * venue/locality keys; display names may change in later database versions.
 * All venues are fictional. Real cities/countries only.
 */
export const ZONES = ["UK_IRELAND", "EUROPE", "REST_OF_WORLD"] as const;
export type Zone = typeof ZONES[number];

export const COUNTRIES: Record<string, { name: string; zone: Zone }> = {
  GBR: { name: "United Kingdom", zone: "UK_IRELAND" },
  IRL: { name: "Ireland", zone: "UK_IRELAND" },
  NLD: { name: "Netherlands", zone: "EUROPE" },
  DEU: { name: "Germany", zone: "EUROPE" },
  BEL: { name: "Belgium", zone: "EUROPE" },
  AUT: { name: "Austria", zone: "EUROPE" },
  CZE: { name: "Czechia", zone: "EUROPE" },
  DNK: { name: "Denmark", zone: "EUROPE" },
  POL: { name: "Poland", zone: "EUROPE" },
  HUN: { name: "Hungary", zone: "EUROPE" },
  ESP: { name: "Spain", zone: "EUROPE" },
  AUS: { name: "Australia", zone: "REST_OF_WORLD" },
  CAN: { name: "Canada", zone: "REST_OF_WORLD" },
  USA: { name: "United States", zone: "REST_OF_WORLD" },
  NZL: { name: "New Zealand", zone: "REST_OF_WORLD" },
  JPN: { name: "Japan", zone: "REST_OF_WORLD" },
};
export const zoneOf = (country: string): Zone => COUNTRIES[country]?.zone ?? "REST_OF_WORLD";

/**
 * Localities host grassroots/county play. Keys match A2 NPC homeRegion values
 * (plus Ayrshire/Scotland, the default human home). Weight drives rotation density.
 */
export const LOCALITIES = [
  { key: "ayrshire", region: "Ayrshire", country: "GBR", city: "Kilbirnie", weight: 3 },
  { key: "highlands", region: "Highlands", country: "GBR", city: "Inverness", weight: 2 },
  { key: "north-east", region: "North East", country: "GBR", city: "Newcastle", weight: 3 },
  { key: "midlands", region: "Midlands", country: "GBR", city: "Wolverhampton", weight: 3 },
  { key: "south-wales", region: "South Wales", country: "GBR", city: "Cardiff", weight: 2 },
  { key: "south-coast", region: "South Coast", country: "GBR", city: "Southampton", weight: 2 },
  { key: "munster", region: "Munster", country: "IRL", city: "Cork", weight: 1.5 },
  { key: "connacht", region: "Connacht", country: "IRL", city: "Galway", weight: 1 },
  { key: "leinster", region: "Leinster", country: "IRL", city: "Dublin", weight: 1.5 },
  { key: "utrecht", region: "Utrecht", country: "NLD", city: "Utrecht", weight: 1.5 },
  { key: "limburg", region: "Limburg", country: "NLD", city: "Maastricht", weight: 1 },
  { key: "friesland", region: "Friesland", country: "NLD", city: "Leeuwarden", weight: 1 },
  { key: "hessen", region: "Hessen", country: "DEU", city: "Frankfurt", weight: 1.5 },
  { key: "saxony", region: "Saxony", country: "DEU", city: "Leipzig", weight: 1 },
  { key: "bremen", region: "Bremen", country: "DEU", city: "Bremen", weight: 1 },
  { key: "flanders", region: "Flanders", country: "BEL", city: "Ghent", weight: 1 },
  { key: "wallonia", region: "Wallonia", country: "BEL", city: "Liège", weight: 0.8 },
  { key: "victoria", region: "Victoria", country: "AUS", city: "Melbourne", weight: 0.8 },
  { key: "queensland", region: "Queensland", country: "AUS", city: "Brisbane", weight: 0.6 },
  { key: "western-australia", region: "Western Australia", country: "AUS", city: "Perth", weight: 0.5 },
  { key: "ontario", region: "Ontario", country: "CAN", city: "Toronto", weight: 0.8 },
  { key: "alberta", region: "Alberta", country: "CAN", city: "Calgary", weight: 0.5 },
  { key: "nova-scotia", region: "Nova Scotia", country: "CAN", city: "Halifax", weight: 0.5 },
] as const;
/**
 * County catchments: residence areas for county events. A2 regions are sparse
 * (about ten amateurs each), so neighbouring areas share a county pathway.
 */
export const COUNTY_CATCHMENTS: Record<string, string[]> = {
  ayrshire: ["ayrshire", "highlands"], highlands: ["ayrshire", "highlands"],
  "north-east": ["north-east", "midlands"], midlands: ["midlands", "north-east", "south-wales"],
  "south-wales": ["south-wales", "south-coast", "midlands"], "south-coast": ["south-coast", "south-wales"],
  munster: ["munster", "connacht", "leinster"], connacht: ["munster", "connacht", "leinster"], leinster: ["munster", "connacht", "leinster"],
  utrecht: ["utrecht", "limburg", "friesland"], limburg: ["utrecht", "limburg", "friesland"], friesland: ["utrecht", "limburg", "friesland"],
  hessen: ["hessen", "saxony", "bremen"], saxony: ["hessen", "saxony", "bremen"], bremen: ["hessen", "saxony", "bremen"],
  flanders: ["flanders", "wallonia"], wallonia: ["flanders", "wallonia"],
  victoria: ["victoria", "queensland", "western-australia"], queensland: ["victoria", "queensland", "western-australia"], "western-australia": ["victoria", "queensland", "western-australia"],
  ontario: ["ontario", "alberta", "nova-scotia"], alberta: ["ontario", "alberta", "nova-scotia"], "nova-scotia": ["ontario", "alberta", "nova-scotia"],
};
export type LocalityKey = typeof LOCALITIES[number]["key"];
export const localityByRegion = (region: string) => LOCALITIES.find(l => l.region === region);
export const localityByKey = (key: string) => LOCALITIES.find(l => l.key === key);

export type Venue = { key: string; name: string; city: string; country: string; region: string; capacityTier: "CLUB" | "HALL" | "ARENA" };
const V = (key: string, name: string, city: string, country: string, region: string, capacityTier: Venue["capacityTier"]): Venue => ({ key, name, city, country, region, capacityTier });

export const VENUES: readonly Venue[] = [
  // Locked flagship and core UK venues.
  V("the-palace-london", "The Palace", "London", "GBR", "London", "ARENA"),
  V("the-foundry-manchester", "The Foundry", "Manchester", "GBR", "North West", "ARENA"),
  V("dockyard-arena-liverpool", "Dockyard Arena", "Liverpool", "GBR", "North West", "ARENA"),
  V("glasgow-hall", "Glasgow Hall", "Glasgow", "GBR", "Scotland", "ARENA"),
  V("midlands-oche", "Midlands Oche", "Wolverhampton", "GBR", "Midlands", "HALL"),
  V("vault-studio-leeds", "The Vault Studio", "Leeds", "GBR", "Yorkshire", "HALL"),
  V("riverside-hall-cardiff", "Riverside Hall", "Cardiff", "GBR", "South Wales", "HALL"),
  V("harbour-rooms-dublin", "Harbour Rooms", "Dublin", "IRL", "Leinster", "HALL"),
  V("northern-forum-newcastle", "Northern Forum", "Newcastle", "GBR", "North East", "HALL"),
  V("seafront-pavilion-blackpool", "Seafront Pavilion", "Blackpool", "GBR", "North West", "ARENA"),
  V("castle-exchange-edinburgh", "Castle Exchange", "Edinburgh", "GBR", "Scotland", "HALL"),
  // European Dart Series host halls.
  V("spree-halle-berlin", "Spree Halle", "Berlin", "DEU", "Berlin", "ARENA"),
  V("maas-hal-rotterdam", "Maas Hal", "Rotterdam", "NLD", "South Holland", "ARENA"),
  V("vltava-arena-prague", "Vltava Arena", "Prague", "CZE", "Prague", "ARENA"),
  V("scheldt-dome-antwerp", "Scheldt Dome", "Antwerp", "BEL", "Flanders", "ARENA"),
  V("harbour-hall-copenhagen", "Harbour Hall", "Copenhagen", "DNK", "Capital Region", "ARENA"),
  V("danube-halle-vienna", "Danube Halle", "Vienna", "AUT", "Vienna", "ARENA"),
  V("vistula-hall-warsaw", "Vistula Hall", "Warsaw", "POL", "Masovia", "ARENA"),
  V("isar-forum-munich", "Isar Forum", "Munich", "DEU", "Bavaria", "ARENA"),
  V("chain-bridge-hall-budapest", "Chain Bridge Hall", "Budapest", "HUN", "Central Hungary", "ARENA"),
  V("grand-place-pavilion-brussels", "Grand Place Pavilion", "Brussels", "BEL", "Brussels", "ARENA"),
  V("ramblas-arena-barcelona", "Ramblas Arena", "Barcelona", "ESP", "Catalonia", "ARENA"),
  V("rhein-hall-dusseldorf", "Rhein Hall", "Düsseldorf", "DEU", "North Rhine-Westphalia", "HALL"),
  V("ruhr-forum-dortmund", "Ruhr Forum", "Dortmund", "DEU", "North Rhine-Westphalia", "HALL"),
  // World Dart Series.
  V("harbourside-arena-sydney", "Harbourside Arena", "Sydney", "AUS", "New South Wales", "ARENA"),
  V("lakeshore-coliseum-toronto", "Lakeshore Coliseum", "Toronto", "CAN", "Ontario", "ARENA"),
  V("hudson-hall-new-york", "Hudson Hall", "New York", "USA", "New York", "ARENA"),
  V("waitemata-centre-auckland", "Waitemata Centre", "Auckland", "NZL", "Auckland", "ARENA"),
  V("bayfront-dome-tokyo", "Bayfront Dome", "Tokyo", "JPN", "Kanto", "ARENA"),
  V("desert-pavilion-las-vegas", "Desert Pavilion", "Las Vegas", "USA", "Nevada", "ARENA"),
];

/** Grassroots/county clubs are generated per locality with stable keys. */
export function localVenue(localityKey: string, kind: "CLUB" | "COUNTY"): Venue {
  const locality = localityByKey(localityKey);
  if (!locality) throw new Error(`Unknown locality ${localityKey}`);
  return kind === "CLUB"
    ? V(`club-${locality.key}`, `${locality.city} Social Club`, locality.city, locality.country, locality.region, "CLUB")
    : V(`county-hall-${locality.key}`, `${locality.region} County Hall`, locality.city, locality.country, locality.region, "HALL");
}
export function venueByKey(key: string): Venue {
  const venue = VENUES.find(v => v.key === key);
  if (venue) return venue;
  const local = /^(club|county-hall)-(.+)$/.exec(key);
  if (local) return localVenue(local[2], local[1] === "club" ? "CLUB" : "COUNTY");
  throw new Error(`Unknown venue ${key}`);
}
