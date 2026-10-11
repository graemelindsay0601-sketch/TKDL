/**
 * Art-directed marks keyed to the authoritative fictional sponsor IDs.
 * Each symbol is individually drawn for its brand's name and sector; no
 * generated initials, hash palettes, or shared emblem rotation is used.
 */
export type SponsorLogoAsset = {
  id: string;
  name: string;
  sector: string;
  primary: string;
  accent: string;
  symbol: string;
  monogram: string;
};

const assets: SponsorLogoAsset[] = [
  { id:"ironflight",name:"Ironflight",sector:"EQUIPMENT",primary:"#d8d5c9",accent:"#a83332",symbol:"M7 33 24 7l17 26-17-8z M24 25v17 M18 34h12",monogram:"IF" },
  { id:"redpoint-darts",name:"Redpoint Darts",sector:"EQUIPMENT",primary:"#d84b42",accent:"#f4efe3",symbol:"M24 5v38 M5 24h38 M11 11l26 26 M37 11 11 37 M24 16a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",monogram:"RP" },
  { id:"ochre-darts",name:"Ochre Darts Co.",sector:"EQUIPMENT",primary:"#d58d31",accent:"#f4e8c8",symbol:"M24 5v10 M24 33v10 M5 24h10 M33 24h10 M10.5 10.5l7 7 M30.5 30.5l7 7 M37.5 10.5l-7 7 M17.5 30.5l-7 7 M24 16a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",monogram:"OD" },
  { id:"northline-darts",name:"Northline Darts",sector:"EQUIPMENT",primary:"#42a8bd",accent:"#e9edf0",symbol:"M24 5 29 19 43 24 29 29 24 43 19 29 5 24 19 19z M24 14v20 M14 24h20",monogram:"ND" },
  { id:"keystone-darts",name:"Keystone Darts",sector:"EQUIPMENT",primary:"#b19a68",accent:"#f2eee4",symbol:"M13 7h22v12l-5 5v14H18V24l-5-5z M18 15h12 M22 29h4",monogram:"KD" },
  { id:"vector-nine",name:"Vector Nine",sector:"EQUIPMENT",primary:"#92bd53",accent:"#eff3e8",symbol:"M7 34 19 10l9 17 7-13 6 20H7z M19 10l-2 24",monogram:"V9" },
  { id:"blackforge-darts",name:"Blackforge Darts",sector:"EQUIPMENT",primary:"#d2d0c8",accent:"#ca4938",symbol:"M12 8h24v7H27v7h9v7H27v8h-9V15h-6z M9 41h27",monogram:"BF" },
  { id:"apex-arrow",name:"Apex Arrow",sector:"EQUIPMENT",primary:"#e8bd4f",accent:"#f7f2e7",symbol:"M5 39 24 6l19 33h-8L24 20 13 39z M19 32h10 M24 21v19",monogram:"AA" },
  { id:"vantage-darts",name:"Vantage Darts",sector:"EQUIPMENT",primary:"#c6a452",accent:"#f5efdd",symbol:"M7 34h34 M11 29q13-23 26 0 M16 23q8-12 16 0 M24 12v25",monogram:"VD" },
  { id:"forge-sport",name:"Forge Sport",sector:"APPAREL",primary:"#d45b42",accent:"#f4eee4",symbol:"M10 8h25l-8 8 8 8-8 8 8 8H10V8z M18 16h10 M18 24h10 M18 32h10",monogram:"FS" },
  { id:"northstar-performance",name:"Northstar Performance",sector:"APPAREL",primary:"#6c9cb7",accent:"#f1f4f2",symbol:"M24 5 28 19 43 24 28 29 24 43 20 29 5 24 20 19z M24 14v20",monogram:"NP" },
  { id:"baseline-athletic",name:"Baseline Athletic",sector:"APPAREL",primary:"#50977a",accent:"#e9f0e8",symbol:"M7 34h34 M7 27h25 M7 20h18 M7 13h11 M35 27l6 7-6 7",monogram:"BA" },
  { id:"vela-sport",name:"Vela Sport",sector:"APPAREL",primary:"#8a6bb1",accent:"#f5ede1",symbol:"M8 38 23 7v31z M25 13l13 25H25z M12 42h29",monogram:"VS" },
  { id:"forge-workwear",name:"Forge Workwear",sector:"TRADES",primary:"#db9a37",accent:"#f1e5c9",symbol:"M8 18h32v24H8z M14 18v-8h20v8 M15 26h18 M15 33h12",monogram:"FW" },
  { id:"lochside-joinery",name:"Lochside Joinery",sector:"TRADES",primary:"#688b73",accent:"#ede7d7",symbol:"M7 13h15v15H7z M22 20h15v15H22z M14 28v9h23 M11 18h7 M26 25h7",monogram:"LJ" },
  { id:"calder-engineering",name:"Calder Engineering",sector:"TRADES",primary:"#54859c",accent:"#e5e9e7",symbol:"M24 7 29 16 39 14 37 24 43 31 33 35 31 43 22 37 13 42 12 32 5 26 13 20 12 11 21 14z M19 22h10v8H19z",monogram:"CE" },
  { id:"stonebridge-tools",name:"Stonebridge Tools",sector:"TRADES",primary:"#b28d61",accent:"#f2eadb",symbol:"M8 11h12v10H8z M28 11h12v10H28z M8 31h12v10H8z M28 31h12v10H28z M20 16h8 M14 21v10 M34 21v10 M20 36h8",monogram:"ST" },
  { id:"rivet-co",name:"Rivet & Co.",sector:"TRADES",primary:"#8e6e58",accent:"#efe3d2",symbol:"M12 8h24v8H12z M8 20h32v7H8z M12 31h24v9H12z M17 12v2 M31 12v2 M14 23v2 M34 23v2",monogram:"RC" },
  { id:"westburn-industrial",name:"Westburn Industrial",sector:"TRADES",primary:"#84909b",accent:"#e8ecec",symbol:"M7 40V18l9 7V14l9 8V9l12 9v22z M14 33h5v7h-5 M27 29h5v5h-5",monogram:"WI" },
  { id:"northway-logistics",name:"Northway Logistics",sector:"LOGISTICS",primary:"#3c9ca2",accent:"#e7efea",symbol:"M7 33h26V17H7z M33 23h7l4 7v3H33z M13 38a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M37 38a4 4 0 1 0 0-8 4 4 0 0 0 0 8",monogram:"NL" },
  { id:"strata-motors",name:"Strata Motors",sector:"AUTOMOTIVE",primary:"#b34f42",accent:"#efebe3",symbol:"M6 30h36l-4-11H13z M12 30v8h5v-8 M31 30v8h5v-8 M16 19l4-7h11l5 7",monogram:"SM" },
  { id:"relay-freight",name:"Relay Freight",sector:"LOGISTICS",primary:"#577cac",accent:"#e8edf4",symbol:"M7 13h14v14H7z M27 13h14v14H27z M17 34h14 M24 27v14 M11 18h6 M31 18h6",monogram:"RF" },
  { id:"aeronorth-travel",name:"AeroNorth Travel",sector:"LOGISTICS",primary:"#5b9ac2",accent:"#f1f1eb",symbol:"M5 27 21 23 17 8l4-2 9 14 11-3 3 3-12 7-4 14-3 1-3-12-13 1z",monogram:"AN" },
  { id:"vantage-technologies",name:"Vantage Technologies",sector:"TECHNOLOGY",primary:"#6197ad",accent:"#e9f1ed",symbol:"M8 34h8V15H8z M20 34h8V8h-8z M32 34h8V21h-8z M8 40h32",monogram:"VT" },
  { id:"lumen-systems",name:"Lumen Systems",sector:"TECHNOLOGY",primary:"#e0b44e",accent:"#f5f0df",symbol:"M24 6v9 M24 33v9 M6 24h9 M33 24h9 M11 11l6 6 M31 31l6 6 M37 11l-6 6 M17 31l-6 6 M20 20h8v8h-8z",monogram:"LS" },
  { id:"arcbyte",name:"Arcbyte",sector:"TECHNOLOGY",primary:"#7e6fc0",accent:"#ede9f3",symbol:"M9 34V14l15-8 15 8v20l-15 8z M9 14l15 9 15-9 M24 23v19 M17 18l7-4 7 4",monogram:"AB" },
  { id:"vertex-mobile",name:"Vertex Mobile",sector:"TECHNOLOGY",primary:"#5073ad",accent:"#e8edf7",symbol:"M15 6h18v36H15z M20 11h8 M21 36h6 M22 29l5-6-5-6",monogram:"VM" },
  { id:"meridian-energy",name:"Meridian Energy",sector:"ENERGY",primary:"#c4a54c",accent:"#f4efdf",symbol:"M24 5v38 M6 24h36 M12 12l24 24 M36 12 12 36 M24 13a11 11 0 1 0 0 22 11 11 0 0 0 0-22z",monogram:"ME" },
  { id:"gridline-infrastructure",name:"Gridline Infrastructure",sector:"ENERGY",primary:"#6585a0",accent:"#eaf0f0",symbol:"M7 8h34v34H7z M18 8v34 M30 8v34 M7 19h34 M7 31h34",monogram:"GI" },
  { id:"northsea-renewables",name:"NorthSea Renewables",sector:"ENERGY",primary:"#579982",accent:"#e7f0e6",symbol:"M7 31q9-16 18 0t18 0 M10 22q7-12 14 0t14 0 M24 7v8 M24 15l-6-5 M24 15l6-5 M9 39h30",monogram:"NR" },
  { id:"rushline",name:"Rushline",sector:"CONSUMER",primary:"#d84d43",accent:"#f5eadf",symbol:"M7 35 17 11h9l-7 15h17L26 41h-9l7-14H7z M29 11h9l-4 8h-9",monogram:"R" },
  { id:"copper-kettle-foods",name:"Copper Kettle Foods",sector:"CONSUMER",primary:"#bd7544",accent:"#efe4d2",symbol:"M15 16h18l-2 24H17z M13 14h22 M19 10h10 M24 16V9 M12 25h-5v8h10 M32 25h5v8h-5",monogram:"CK" },
  { id:"north-coast",name:"North & Coast",sector:"CONSUMER",primary:"#4c9a9c",accent:"#e5f0e9",symbol:"M6 36 16 16l8 12 8-19 10 27z M13 37q11-8 22 0",monogram:"NC" },
  { id:"sterling-row",name:"Sterling Row",sector:"FINANCIAL",primary:"#b8a16a",accent:"#f0ebdd",symbol:"M9 13h30 M13 13l5 25 M35 13l-5 25 M14 27h20 M18 37h12 M24 7v8",monogram:"SR" },
  { id:"crestline-insurance",name:"Crestline Insurance",sector:"FINANCIAL",primary:"#507b91",accent:"#e8eef0",symbol:"M24 6 40 13v12q0 12-16 19Q8 37 8 25V13z M24 14v19 M16 23h16 M19 31h10",monogram:"CI" },
  { id:"harbour-commercial",name:"Harbour Commercial",sector:"FINANCIAL",primary:"#47798b",accent:"#e6eeee",symbol:"M7 37h34 M10 34V22h28v12 M7 19l17-12 17 12z M17 25v8 M24 25v8 M31 25v8",monogram:"HC" },
  { id:"garnock-garage",name:"Garnock Garage",sector:"garage",primary:"#bb6543",accent:"#f2e7d9",symbol:"M8 30h32 M12 30l4-13h16l4 13 M15 36h5 M29 36h5 M18 20l2-7h8l2 7",monogram:"GG" },
  { id:"irvine-printworks",name:"Irvine Printworks",sector:"printing",primary:"#7772a8",accent:"#eeebf2",symbol:"M10 9h28v8H10z M7 21h34v17H7z M13 28h15 M13 33h9 M32 25h5v6h-5",monogram:"IP" },
  { id:"clyde-electrical",name:"Clyde Electrical",sector:"electrical contractor",primary:"#d9ac3d",accent:"#f2eddc",symbol:"M26 5 13 25h10l-3 15 14-22H23z M8 41h32",monogram:"CE" },
  { id:"kelvin-office",name:"Kelvin Office Supply",sector:"office supplier",primary:"#6697a6",accent:"#edf1ec",symbol:"M11 7h24v34H11z M16 14h14 M16 21h14 M16 28h9 M16 35h11 M31 28l3 3-3 3",monogram:"KO" },
  { id:"forth-builders",name:"Forth Builders",sector:"builder",primary:"#ae784d",accent:"#efe4d3",symbol:"M6 23 24 8l18 15 M11 21v20h26V21 M17 41V28h14v13 M17 17h14",monogram:"FB" },
  { id:"stirling-private-hire",name:"Stirling Private Hire",sector:"private hire",primary:"#547b87",accent:"#e9eee9",symbol:"M8 31h30l-3-11H14z M13 31v7h5v-7 M29 31v7h5v-7 M17 20l3-6h9l4 6",monogram:"SP" },
  { id:"lothian-property",name:"Lothian Property Care",sector:"property maintenance",primary:"#638169",accent:"#edf0e4",symbol:"M7 23 24 8l17 15 M12 20v21h24V20 M18 41V28h12v13 M33 11l7 1v9",monogram:"LP" },
  { id:"leith-table",name:"Leith Table",sector:"restaurant",primary:"#c47c4f",accent:"#f3eadc",symbol:"M8 17h32v10H8z M13 27v14 M35 27v14 M17 12q7-8 14 0 M16 33h16",monogram:"LT" },
  { id:"tweed-workshop",name:"Tweed Workshop",sector:"engineering workshop",primary:"#9b7b4f",accent:"#eee8d8",symbol:"M8 11h11v11H8z M29 11h11v11H29z M8 30h11v11H8z M29 30h11v11H29z M19 16h10 M13 22v8 M35 22v8 M19 35h10",monogram:"TW" },
  { id:"borders-joinery",name:"Borders Joinery",sector:"joinery",primary:"#6d866e",accent:"#efead8",symbol:"M8 12h14v12H8z M22 18h14v12H22z M14 24h14v12H14z M10 39h26",monogram:"BJ" },
  { id:"granite-haulage",name:"Granite Haulage",sector:"haulage",primary:"#73808b",accent:"#ecefeb",symbol:"M8 34h26V18H8z M34 24h6l4 7v3H34z M13 39a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M36 39a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M14 18l5-7h12l4 7",monogram:"GH" },
  { id:"deeside-retail",name:"Deeside Retail",sector:"local retailer",primary:"#936da0",accent:"#f0e8ef",symbol:"M9 17h30l-3 24H12z M7 17l5-9h24l5 9 M17 24h14 M17 31h10 M17 37h8",monogram:"DR" },
  { id:"highland-repair",name:"Highland Repair",sector:"garage",primary:"#648b74",accent:"#e9eee1",symbol:"M24 6 41 35H7z M24 17v10 M24 32v1 M13 39h22",monogram:"HR" },
  { id:"moray-builders",name:"Moray Builders",sector:"builder",primary:"#a66f50",accent:"#efe4d4",symbol:"M7 39h34V17L30 9v10L20 12v10L7 16z M14 30h7v9 M28 27h7v6h-7",monogram:"MB" },
  { id:"tay-print",name:"Tay Print",sector:"printing",primary:"#6784aa",accent:"#e9edf2",symbol:"M9 8h30v10H9z M6 22h36v18H6z M13 28h19 M13 34h13 M34 26h5v6h-5",monogram:"TP" },
  { id:"lagan-maintenance",name:"Lagan Maintenance",sector:"property maintenance",primary:"#59928b",accent:"#e8efe6",symbol:"M24 6a9 9 0 0 0-7 14L8 36l5 5 16-9a9 9 0 0 0 14-7l-9 5-8-8 5-9A9 9 0 0 0 24 6z",monogram:"LM" },
];

export const SPONSOR_LOGO_ASSETS: ReadonlyMap<string, SponsorLogoAsset> =
  new Map(assets.map(asset => [asset.id, asset]));

const normaliseName = (name: string) => name.normalize("NFKC").trim().toLocaleLowerCase("en-GB");
const SPONSOR_LOGO_BY_NAME = new Map(assets.map(asset => [normaliseName(asset.name), asset]));

export function sponsorMarkIdentity(brandId?: string, brandName?: string) {
  const asset = (brandId ? SPONSOR_LOGO_ASSETS.get(brandId) : undefined) ??
    (brandName ? SPONSOR_LOGO_BY_NAME.get(normaliseName(brandName)) : undefined);
  return asset ? { ...asset, emblem: asset.symbol, hue: 0, monogram: asset.monogram } : null;
}
