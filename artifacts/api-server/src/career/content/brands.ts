export const RELATIONSHIP_SLOTS = ["EQUIPMENT_PARTNER", "APPAREL_PARTNER", "PRIMARY_COMMERCIAL", "SECONDARY_COMMERCIAL", "LOCAL_REGIONAL_PARTNER"] as const;
export type RelationshipSlot = typeof RELATIONSHIP_SLOTS[number];
export const EXCLUSIVITY_GROUPS = ["DARTS_EQUIPMENT", "MATCH_APPAREL", "AUTOMOTIVE", "LOGISTICS_TRAVEL", "FINANCIAL_SERVICES", "TECHNOLOGY", "PRIMARY_COMMERCIAL"] as const;
export type Brand = {
  id: string; name: string; sector: string; homeMarket: string; reach: string; commercialTier: "LOCAL" | "REGIONAL" | "PROFESSIONAL" | "ELITE";
  personality: string; targetProfiles: string[]; preferredStages: string[]; slot: RelationshipSlot; exclusivityGroups: string[];
  signatureProductSupport: ("SIGNATURE_DARTS" | "SIGNATURE_RANGE")[]; eventSponsorshipEligible: boolean; themeKey: string;
  contractTendencies: { durationSeasons: number; coverage: string[]; bonus: string; renewal: string };
  locationId: string | null;
};
const sectors: Record<string, { slot: RelationshipSlot; group: string[] }> = {
  EQUIPMENT: { slot: "EQUIPMENT_PARTNER", group: ["DARTS_EQUIPMENT"] },
  APPAREL: { slot: "APPAREL_PARTNER", group: ["MATCH_APPAREL"] },
  TRADES: { slot: "LOCAL_REGIONAL_PARTNER", group: [] },
  LOGISTICS: { slot: "SECONDARY_COMMERCIAL", group: ["LOGISTICS_TRAVEL"] },
  AUTOMOTIVE: { slot: "PRIMARY_COMMERCIAL", group: ["AUTOMOTIVE", "PRIMARY_COMMERCIAL"] },
  TECHNOLOGY: { slot: "SECONDARY_COMMERCIAL", group: ["TECHNOLOGY"] },
  ENERGY: { slot: "PRIMARY_COMMERCIAL", group: ["PRIMARY_COMMERCIAL"] },
  CONSUMER: { slot: "SECONDARY_COMMERCIAL", group: [] },
  FINANCIAL: { slot: "PRIMARY_COMMERCIAL", group: ["FINANCIAL_SERVICES", "PRIMARY_COMMERCIAL"] },
};
const core: [string, string, string, Brand["commercialTier"], string, string][] = [
  ["ironflight", "Ironflight", "EQUIPMENT", "PROFESSIONAL", "GBR", "heritage premium"],
  ["redpoint-darts", "Redpoint Darts", "EQUIPMENT", "REGIONAL", "GBR", "modern challenger"],
  ["ochre-darts", "Ochre Darts Co.", "EQUIPMENT", "REGIONAL", "GBR", "grassroots mass-market"],
  ["northline-darts", "Northline Darts", "EQUIPMENT", "PROFESSIONAL", "GBR", "engineering performance"],
  ["keystone-darts", "Keystone Darts", "EQUIPMENT", "REGIONAL", "NLD", "European technical"],
  ["vector-nine", "Vector Nine", "EQUIPMENT", "PROFESSIONAL", "DEU", "precise engineering"],
  ["blackforge-darts", "Blackforge Darts", "EQUIPMENT", "REGIONAL", "GBR", "boutique custom"],
  ["apex-arrow", "Apex Arrow", "EQUIPMENT", "ELITE", "USA", "global elite"],
  ["vantage-darts", "Vantage Darts", "EQUIPMENT", "ELITE", "GBR", "established Career catalogue identity"],
  ["forge-sport", "Forge Sport", "APPAREL", "REGIONAL", "GBR", "durable sporting design"],
  ["northstar-performance", "Northstar Performance", "APPAREL", "PROFESSIONAL", "SWE", "restrained technical"],
  ["baseline-athletic", "Baseline Athletic", "APPAREL", "REGIONAL", "IRL", "accessible club sport"],
  ["vela-sport", "Vela Sport", "APPAREL", "ELITE", "ESP", "international stage"],
  ["forge-workwear", "Forge Workwear", "TRADES", "LOCAL", "GBR", "reliable working communities"],
  ["lochside-joinery", "Lochside Joinery", "TRADES", "LOCAL", "GBR", "local craft"],
  ["calder-engineering", "Calder Engineering", "TRADES", "REGIONAL", "GBR", "regional precision"],
  ["stonebridge-tools", "Stonebridge Tools", "TRADES", "REGIONAL", "GBR", "practical independent trades"],
  ["rivet-co", "Rivet & Co.", "TRADES", "LOCAL", "GBR", "community workshop"],
  ["westburn-industrial", "Westburn Industrial", "TRADES", "PROFESSIONAL", "GBR", "established industrial"],
  ["northway-logistics", "Northway Logistics", "LOGISTICS", "REGIONAL", "GBR", "regional travel partner"],
  ["strata-motors", "Strata Motors", "AUTOMOTIVE", "PROFESSIONAL", "DEU", "dependable touring"],
  ["relay-freight", "Relay Freight", "LOGISTICS", "PROFESSIONAL", "NLD", "continental connections"],
  ["aeronorth-travel", "AeroNorth Travel", "LOGISTICS", "ELITE", "CAN", "international travel"],
  ["vantage-technologies", "Vantage Technologies", "TECHNOLOGY", "PROFESSIONAL", "GBR", "practical innovation"],
  ["lumen-systems", "Lumen Systems", "TECHNOLOGY", "REGIONAL", "FRA", "clear everyday technology"],
  ["arcbyte", "Arcbyte", "TECHNOLOGY", "REGIONAL", "GBR", "independent digital studio"],
  ["vertex-mobile", "Vertex Mobile", "TECHNOLOGY", "ELITE", "JPN", "global connected audience"],
  ["meridian-energy", "Meridian Energy", "ENERGY", "ELITE", "GBR", "international infrastructure"],
  ["gridline-infrastructure", "Gridline Infrastructure", "ENERGY", "PROFESSIONAL", "DEU", "long-term engineering"],
  ["northsea-renewables", "NorthSea Renewables", "ENERGY", "REGIONAL", "SWE", "regional sustainable industry"],
  ["rushline", "Rushline", "CONSUMER", "REGIONAL", "GBR", "soft-drink challenger"],
  ["copper-kettle-foods", "Copper Kettle Foods", "CONSUMER", "LOCAL", "GBR", "community food producer"],
  ["north-coast", "North & Coast", "CONSUMER", "PROFESSIONAL", "GBR", "national consumer brand"],
  ["sterling-row", "Sterling Row", "FINANCIAL", "ELITE", "GBR", "established business relationships"],
  ["crestline-insurance", "Crestline Insurance", "FINANCIAL", "PROFESSIONAL", "IRL", "reliable professional cover"],
  ["harbour-commercial", "Harbour Commercial", "FINANCIAL", "PROFESSIONAL", "NLD", "international business"],
];
function make([id, name, sector, commercialTier, homeMarket, personality]: typeof core[number], locationId: string | null = null): Brand {
  const s = sectors[sector] ?? sectors.TRADES;
  return { id, name, sector, commercialTier, homeMarket, personality, reach: locationId ? "LOCAL" : commercialTier === "ELITE" ? "GLOBAL" : commercialTier,
    targetProfiles: sector === "TRADES" ? ["grassroots", "regional", "strong-amateur"] : ["sporting-achievement", "reliable-public-partner"],
    preferredStages: commercialTier === "LOCAL" ? ["grassroots", "regional"] : ["strong-amateur", "professional", "established"],
    slot: s.slot, exclusivityGroups: [...s.group], signatureProductSupport: sector === "EQUIPMENT" ? ["SIGNATURE_DARTS", "SIGNATURE_RANGE"] : [],
    eventSponsorshipEligible: !locationId, themeKey: `brand:${id}`, locationId,
    contractTendencies: { durationSeasons: commercialTier === "ELITE" ? 3 : commercialTier === "LOCAL" ? 1 : 2,
      coverage: ["LOGISTICS", "AUTOMOTIVE"].includes(sector) ? ["TRAVEL", "ACCOMMODATION"] : ["ENTRY_FEE"],
      bonus: "actual sporting finish", renewal: "factual sporting requirements" } };
}
export const CORE_BRANDS = core.map(row => make(row));
export const LOCAL_SPONSORS = [
  ["garnock-garage", "Garnock Garage", "ayrshire", "garage"], ["irvine-printworks", "Irvine Printworks", "ayrshire", "printing"],
  ["clyde-electrical", "Clyde Electrical", "glasgow-clyde", "electrical contractor"], ["kelvin-office", "Kelvin Office Supply", "glasgow-clyde", "office supplier"],
  ["forth-builders", "Forth Builders", "central-scotland", "builder"], ["stirling-private-hire", "Stirling Private Hire", "central-scotland", "private hire"],
  ["lothian-property", "Lothian Property Care", "edinburgh-lothians", "property maintenance"], ["leith-table", "Leith Table", "edinburgh-lothians", "restaurant"],
  ["tweed-workshop", "Tweed Workshop", "borders", "engineering workshop"], ["borders-joinery", "Borders Joinery", "borders", "joinery"],
  ["granite-haulage", "Granite Haulage", "north-east-scotland", "haulage"], ["deeside-retail", "Deeside Retail", "north-east-scotland", "local retailer"],
  ["highland-repair", "Highland Repair", "highlands", "garage"], ["moray-builders", "Moray Builders", "highlands", "builder"],
  ["tay-print", "Tay Print", "tayside", "printing"], ["lagan-maintenance", "Lagan Maintenance", "northern-ireland", "property maintenance"],
].map(([id, name, locationId, sector]) => ({ ...make([id, name, "TRADES", "LOCAL", "GBR", "local sporting community"], locationId), sector }));
export const BRANDS = [...CORE_BRANDS, ...LOCAL_SPONSORS];
export const brandById = (id: string) => BRANDS.find(b => b.id === id);
