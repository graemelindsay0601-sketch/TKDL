export type VenueFamily = "pub-club" | "social-club" | "community-hall" | "sports-centre" | "hotel-ballroom" | "conference" | "professional-floor" | "studio" | "historic-theatre" | "modern-theatre" | "exhibition" | "small-arena" | "major-arena" | "international-arena" | "palace";
export type VenueRecord = {
  id: string; displayName: string; nickname: string | null; countryId: string; regionId: string; cityId: string;
  city: string; region: string; venueType: VenueFamily; capacityBand: "CLUB" | "HALL" | "ARENA";
  atmosphereTags: string[]; stageConfiguration: string; permanentWorldHome?: boolean;
};
export type VenueLocality = { key: string; region: string; country: string; city: string; venues: VenueRecord[] };
export type SeasonEvent = { id: string; name: string; status: string; dates: { startWeek: number }; venue: { id: string } };

const worldRaw: [string,string,string|null,string,string,string,VenueFamily,string[]][] = [
  ["the-palace-london","Alexandra Grand Hall","The Palace","GBR","London","London","palace",["historic-facade","central-hall","balcony","winter-championship"]],
  ["the-foundry-manchester","The Foundry",null,"GBR","North West","Manchester","major-arena",["live-crowd","major-arena"]],
  ["dockyard-arena-liverpool","Dockyard Arena",null,"GBR","North West","Liverpool","major-arena",["live-crowd","major-arena"]],
  ["glasgow-hall","Glasgow Hall",null,"GBR","Scotland","Glasgow","exhibition",["live-crowd","exhibition"]],
  ["midlands-oche","Midlands Oche",null,"GBR","Midlands","Wolverhampton","professional-floor",["live-crowd","professional-floor"]],
  ["vault-studio-leeds","The Vault Studio",null,"GBR","Yorkshire","Leeds","studio",["architectural","compact","stage-lighting"]],
  ["riverside-hall-cardiff","Riverside Hall",null,"GBR","South Wales","Cardiff","exhibition",["live-crowd","exhibition"]],
  ["harbour-rooms-dublin","Harbour Rooms",null,"IRL","Leinster","Dublin","hotel-ballroom",["live-crowd","hotel-ballroom"]],
  ["northern-forum-newcastle","Northern Forum",null,"GBR","North East","Newcastle","conference",["live-crowd","conference"]],
  ["seafront-pavilion-blackpool","Seafront Pavilion",null,"GBR","North West","Blackpool","major-arena",["live-crowd","major-arena"]],
  ["castle-exchange-edinburgh","Castle Exchange",null,"GBR","Scotland","Edinburgh","conference",["live-crowd","conference"]],
  ["spree-halle-berlin","Spree Halle",null,"DEU","Berlin","Berlin","international-arena",["live-crowd","international-arena"]],
  ["maas-hal-rotterdam","Maas Hal",null,"NLD","South Holland","Rotterdam","international-arena",["live-crowd","international-arena"]],
  ["vltava-arena-prague","Vltava Arena",null,"CZE","Prague","Prague","international-arena",["live-crowd","international-arena"]],
  ["scheldt-dome-antwerp","Scheldt Dome",null,"BEL","Flanders","Antwerp","international-arena",["live-crowd","international-arena"]],
  ["harbourside-arena-sydney","Harbourside Arena",null,"AUS","New South Wales","Sydney","international-arena",["live-crowd","international-arena"]],
  ["lakeshore-coliseum-toronto","Lakeshore Coliseum",null,"CAN","Ontario","Toronto","international-arena",["live-crowd","international-arena"]],
  ["bayfront-dome-tokyo","Bayfront Dome",null,"JPN","Kanto","Tokyo","international-arena",["live-crowd","international-arena"]],
];
const regionFor: Record<string,string> = {GBR:"United Kingdom",IRL:"Ireland",DEU:"Germany",NLD:"Netherlands",CZE:"Czechia",BEL:"Belgium",AUS:"Australia",CAN:"Canada",JPN:"Japan"};
export const worldVenues: VenueRecord[] = worldRaw.map(([id,displayName,nickname,countryId,region,city,venueType,atmosphereTags]) => ({
  id, displayName, nickname, countryId, regionId:`region:${countryId.toLowerCase()}:${region.toLowerCase().replaceAll(" ","-")}`,
  cityId:`city:${countryId.toLowerCase()}:${city.toLowerCase().replaceAll(" ","-")}`, city, region, venueType,
  capacityBand: venueType === "palace" || venueType === "major-arena" || venueType === "international-arena" ? "ARENA" : "HALL",
  atmosphereTags, stageConfiguration:venueType === "professional-floor" ? "MULTI_BOARD_FLOOR" : "FEATURE_BOARD",
  ...(venueType === "palace" ? {permanentWorldHome:true} : {}),
}));
export const countries = Object.entries(regionFor).map(([id,name]) => ({id,name}));

const localityRows: [string,string,string,string,string][] = [
  ["ayrshire","Ayrshire","GBR","Kilbirnie","pub-club"],["highlands","Highlands","GBR","Inverness","social-club"],
  ["north-east","North East","GBR","Newcastle","social-club"],["midlands","Midlands","GBR","Wolverhampton","social-club"],
  ["south-wales","South Wales","GBR","Cardiff","social-club"],["munster","Munster","IRL","Cork","social-club"],
  ["glasgow-clyde","Greater Glasgow/Clyde","GBR","Glasgow","social-club"],["edinburgh-lothians","Edinburgh/Lothians","GBR","Edinburgh","social-club"],
  ["utrecht","Utrecht","NLD","Utrecht","social-club"],["victoria","Victoria","AUS","Melbourne","social-club"],
];
export const localities: VenueLocality[] = localityRows.map(([key,region,country,city,clubStyle]) => {
  const localityVenue = (kind:"club"|"county",name:string,family:VenueFamily,capacityBand:"CLUB"|"HALL"):VenueRecord => ({
    id:`${kind === "club" ? "club" : "county-hall"}-${key}`, displayName:name, nickname:null, countryId:country,
    regionId:`region:${country.toLowerCase()}:${key}`, cityId:`city:${country.toLowerCase()}:${city.toLowerCase().replaceAll(" ","-")}`,
    city,region,venueType:family,capacityBand,atmosphereTags:["live-crowd",family],
    stageConfiguration:family === "sports-centre" ? "MULTI_BOARD_FLOOR" : "FEATURE_BOARD",
  });
  return {key,region,country,city,venues:[
    localityVenue("club",`${city} Social Club`,clubStyle as VenueFamily,"CLUB"),
    localityVenue("county",`${region} County Hall`,"community-hall","HALL"),
  ]};
});

// A single explicit fixture event mirrors the named Palace championship route.
// Other destinations intentionally show the no-schedule state.
export const seasonEvents: SeasonEvent[] = [{
  id:"world-darts-championship", name:"The Palace World Championship", status:"SCHEDULED",
  dates:{startWeek:34}, venue:{id:"the-palace-london"},
}];
