import {z} from "zod";
import {representativeForSponsor} from "./sponsor-representatives.ts";

export const RELATIONSHIP_SLOTS = ["EQUIPMENT_PARTNER", "APPAREL_PARTNER", "PRIMARY_COMMERCIAL", "SECONDARY_COMMERCIAL", "LOCAL_REGIONAL_PARTNER"] as const;
export type RelationshipSlot = typeof RELATIONSHIP_SLOTS[number];
export const EXCLUSIVITY_GROUPS = ["DARTS_EQUIPMENT", "MATCH_APPAREL", "AUTOMOTIVE", "LOGISTICS_TRAVEL", "FINANCIAL_SERVICES", "TECHNOLOGY", "PRIMARY_COMMERCIAL"] as const;
export const SPONSOR_CATEGORIES = ["MAIN_PARTNER", "EQUIPMENT_PARTNER", "TRAVEL_PARTNER", "LOCAL_PARTNER", "APPAREL_PARTNER", "SECONDARY_PARTNER"] as const;
export type SponsorCategory = typeof SPONSOR_CATEGORIES[number];
const brandTiers = ["LOCAL", "REGIONAL", "PROFESSIONAL", "ELITE"] as const;
const brandSectors = {
  EQUIPMENT: { slot: "EQUIPMENT_PARTNER", group: ["DARTS_EQUIPMENT"] },
  APPAREL: { slot: "APPAREL_PARTNER", group: ["MATCH_APPAREL"] },
  TRADES: { slot: "LOCAL_REGIONAL_PARTNER", group: [] },
  LOGISTICS: { slot: "SECONDARY_COMMERCIAL", group: ["LOGISTICS_TRAVEL"] },
  AUTOMOTIVE: { slot: "PRIMARY_COMMERCIAL", group: ["AUTOMOTIVE", "PRIMARY_COMMERCIAL"] },
  TECHNOLOGY: { slot: "SECONDARY_COMMERCIAL", group: ["TECHNOLOGY"] },
  ENERGY: { slot: "PRIMARY_COMMERCIAL", group: ["PRIMARY_COMMERCIAL"] },
  CONSUMER: { slot: "SECONDARY_COMMERCIAL", group: [] },
  FINANCIAL: { slot: "PRIMARY_COMMERCIAL", group: ["FINANCIAL_SERVICES", "PRIMARY_COMMERCIAL"] },
} as const satisfies Record<string,{slot:RelationshipSlot;group:readonly string[]}>;
export type BrandSector=keyof typeof brandSectors;

const presentationSchema=z.object({
  logoAssetKey:z.string().min(1).max(100),
  displayTreatment:z.enum(["WORDMARK","MONOGRAM","CREST"]),
  accentToken:z.string().regex(/^sponsor-[a-z0-9-]+-accent$/),
  tagline:z.string().trim().max(80).nullable(),
}).strict();
export const sponsorBrandSchema=z.object({
  id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name:z.string().trim().min(2).max(80),
  shortName:z.string().trim().min(2).max(40),
  sector:z.string().trim().min(1).max(60).refine(value=>Object.prototype.hasOwnProperty.call(brandSectors,value)||
    ["garage","printing","electrical contractor","office supplier","builder","private hire","property maintenance","restaurant",
      "engineering workshop","joinery","haulage","local retailer"].includes(value)),
  category:z.enum(SPONSOR_CATEGORIES),
  homeMarket:z.string().regex(/^[A-Z]{3}$/),
  reach:z.enum(["LOCAL","REGIONAL","PROFESSIONAL","GLOBAL"]),
  commercialTier:z.enum(brandTiers),
  personality:z.string().trim().min(2).max(100),
  targetProfiles:z.array(z.string().min(1).max(60)).min(1).max(12),
  preferredStages:z.array(z.string().min(1).max(60)).min(1).max(12),
  slot:z.enum(RELATIONSHIP_SLOTS),
  exclusivityGroups:z.array(z.enum(EXCLUSIVITY_GROUPS)).max(8),
  signatureProductSupport:z.array(z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"])).max(4),
  eventSponsorshipEligible:z.boolean(),
  themeKey:z.string().regex(/^brand:[a-z0-9-]+$/),
  presentation:presentationSchema,
  representativeId:z.string().regex(/^rep-[a-z0-9-]+$/).nullable(),
  active:z.boolean(),
  rosterStrategy:z.enum(["COMMUNITY_SUPPORT","DEVELOPMENT","TOURING","CHAMPIONSHIP"]),
  contractTendencies:z.object({
    durationSeasons:z.number().int().min(1).max(5),
    coverage:z.array(z.enum(["ENTRY_FEE","TRAVEL","ACCOMMODATION"])).min(1).max(3),
    bonus:z.string().trim().min(1).max(80),
    renewal:z.string().trim().min(1).max(80),
  }).strict(),
  locationId:z.string().regex(/^[a-z0-9-]+$/).nullable(),
}).strict();
export type Brand=z.infer<typeof sponsorBrandSchema>;

const sponsorCategoryForSector=(sector:BrandSector):SponsorCategory=>{
  if(sector==="EQUIPMENT")return "EQUIPMENT_PARTNER";
  if(sector==="APPAREL")return "APPAREL_PARTNER";
  if(sector==="LOGISTICS"||sector==="AUTOMOTIVE")return "TRAVEL_PARTNER";
  if(sector==="TRADES")return "LOCAL_PARTNER";
  if(sector==="ENERGY"||sector==="FINANCIAL")return "MAIN_PARTNER";
  return "SECONDARY_PARTNER";
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
  const typedSector=sector as BrandSector;
  const s = brandSectors[typedSector] ?? brandSectors.TRADES;
  const representative=representativeForSponsor(id);
  return { id, name, shortName:name, sector:typedSector, category:sponsorCategoryForSector(typedSector), commercialTier, homeMarket, personality, reach: locationId ? "LOCAL" : commercialTier === "ELITE" ? "GLOBAL" : commercialTier,
    targetProfiles: sector === "TRADES" ? ["grassroots", "regional", "strong-amateur"] : ["sporting-achievement", "reliable-public-partner"],
    preferredStages: commercialTier === "LOCAL" ? ["grassroots", "regional"] : ["strong-amateur", "professional", "established"],
    slot: s.slot, exclusivityGroups: [...s.group], signatureProductSupport: sector === "EQUIPMENT" ? ["SIGNATURE_DARTS", "SIGNATURE_RANGE"] : [],
    eventSponsorshipEligible: !locationId, themeKey: `brand:${id}`, locationId, representativeId:representative?.id??null, active:true,
    presentation:{logoAssetKey:`sponsor-mark:${id}`,displayTreatment:locationId?"CREST":sector==="EQUIPMENT"?"MONOGRAM":"WORDMARK",
      accentToken:`sponsor-${id}-accent`,tagline:null},
    rosterStrategy:commercialTier==="ELITE"?"CHAMPIONSHIP":commercialTier==="PROFESSIONAL"?"TOURING":
      commercialTier==="REGIONAL"?"DEVELOPMENT":"COMMUNITY_SUPPORT",
    contractTendencies: { durationSeasons: commercialTier === "ELITE" ? 3 : commercialTier === "LOCAL" ? 1 : 2,
      coverage: ["LOGISTICS", "AUTOMOTIVE"].includes(sector) ? ["TRAVEL", "ACCOMMODATION"] : ["ENTRY_FEE"],
      bonus: "actual sporting finish", renewal: "factual sporting requirements" } };
}
export const CORE_BRANDS:Brand[] = core.map(row => make(row));
export const LOCAL_SPONSORS:Brand[] = [
  ["garnock-garage", "Garnock Garage", "ayrshire", "garage"], ["irvine-printworks", "Irvine Printworks", "ayrshire", "printing"],
  ["clyde-electrical", "Clyde Electrical", "glasgow-clyde", "electrical contractor"], ["kelvin-office", "Kelvin Office Supply", "glasgow-clyde", "office supplier"],
  ["forth-builders", "Forth Builders", "central-scotland", "builder"], ["stirling-private-hire", "Stirling Private Hire", "central-scotland", "private hire"],
  ["lothian-property", "Lothian Property Care", "edinburgh-lothians", "property maintenance"], ["leith-table", "Leith Table", "edinburgh-lothians", "restaurant"],
  ["tweed-workshop", "Tweed Workshop", "borders", "engineering workshop"], ["borders-joinery", "Borders Joinery", "borders", "joinery"],
  ["granite-haulage", "Granite Haulage", "north-east-scotland", "haulage"], ["deeside-retail", "Deeside Retail", "north-east-scotland", "local retailer"],
  ["highland-repair", "Highland Repair", "highlands", "garage"], ["moray-builders", "Moray Builders", "highlands", "builder"],
  ["tay-print", "Tay Print", "tayside", "printing"], ["lagan-maintenance", "Lagan Maintenance", "northern-ireland", "property maintenance"],
].map(([id, name, locationId, sector]) => ({ ...make([id, name, "TRADES", "LOCAL", "GBR", "local sporting community"], locationId), sector } as Brand));
export const BRANDS:Brand[] = [...CORE_BRANDS, ...LOCAL_SPONSORS];
export const brandById = (id: string) => BRANDS.find(b => b.id === id);

function validateSponsorContent(brands:readonly Brand[]) {
  const ids=new Set<string>();
  for(const raw of brands){
    const brand=sponsorBrandSchema.parse(raw);
    if(ids.has(brand.id))throw new Error(`Duplicate sponsor content id: ${brand.id}`);
    ids.add(brand.id);
    if(brand.representativeId){
      const rep=representativeForSponsor(brand.id);
      if(!rep||rep.id!==brand.representativeId)throw new Error(`Invalid sponsor representative link: ${brand.id}`);
    }
  }
}
validateSponsorContent(BRANDS);
