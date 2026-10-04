/** Original fictional name components, not the legacy bot personas/pro alterations. */
export const IDENTITY_POOLS = [
  { weight: 42, nationality: "GBR", regions: ["North East", "Highlands", "South Wales", "Midlands", "South Coast"],
    first: ["Orin", "Ellis", "Joss", "Niall", "Tobin", "Rafe", "Merrin", "Callan", "Ewan", "Ivo", "Alden", "Bryn"],
    last: ["Bracken", "Fallow", "Merewood", "Thistledown", "Alderwick", "Fenholt", "Cresswell", "Marsham", "Rookmere", "Ashcombe", "Holloway", "Wrenford"] },
  { weight: 14, nationality: "NLD", regions: ["Utrecht", "Limburg", "Friesland"],
    first: ["Bram", "Ties", "Sjoerd", "Jelte", "Cas", "Eelco", "Floris", "Rens"],
    last: ["Meerveld", "Korenbos", "Duinakker", "Veenhof", "Zilverdam", "Rietkamp", "Bosma", "Houtveen"] },
  { weight: 12, nationality: "DEU", regions: ["Hessen", "Saxony", "Bremen"],
    first: ["Arno", "Falk", "Marten", "Tilo", "Jannik", "Bastian", "Henrik", "Lennart"],
    last: ["Lindenfels", "Kornwald", "Felsmann", "Seewald", "Wiesenbach", "Auenberg", "Birkenau", "Wolkenried"] },
  { weight: 10, nationality: "IRL", regions: ["Munster", "Connacht", "Leinster"],
    first: ["Fionn", "Cian", "Oisin", "Eoin", "Dara", "Lorcan", "Senan", "Ruairi"],
    last: ["Kilmere", "Ballyford", "Dunellan", "Rosheen", "Carran", "Ardmore", "Glenavan", "Tullyvale"] },
  { weight: 8, nationality: "BEL", regions: ["Flanders", "Wallonia"],
    first: ["Emiel", "Joren", "Nand", "Senne", "Thijs", "Arne", "Benoit", "Remi"],
    last: ["Lindepoort", "Kerkendaal", "Molenbeek", "Hazelhof", "Rivemont", "Clairval", "Veldbrug", "Boiselle"] },
  { weight: 7, nationality: "AUS", regions: ["Victoria", "Queensland", "Western Australia"],
    first: ["Ashton", "Darcy", "Lachlan", "Flynn", "Rowan", "Keir", "Arden", "Tate"],
    last: ["Cedarbank", "Saltmere", "Reedwell", "Willowby", "Northcott", "Wattleford", "Kestrel", "Sandwick"] },
  { weight: 7, nationality: "CAN", regions: ["Ontario", "Alberta", "Nova Scotia"],
    first: ["Harlan", "Emmett", "Quinn", "Noel", "Avery", "Soren", "Linden", "Marlowe"],
    last: ["Pinehurst", "Redwater", "Alderbrook", "Valecrest", "Mossford", "Ridgewell", "Elmshore", "Greyhaven"] },
] as const;

export const CURATED_NPCS = [
  { key: "orin-loom", tier: "ELITE", firstName: "Orin", surname: "Loombridge", nickname: "Night Orchard", nationality: "GBR", homeRegion: "North East" },
  { key: "falk-copper", tier: "ELITE", firstName: "Falk", surname: "Kupferhain", nickname: "Copper Comet", nationality: "DEU", homeRegion: "Hessen" },
  { key: "joss-tide", tier: "PROFESSIONAL", firstName: "Joss", surname: "Tidecroft", nickname: "Quiet Harbour", nationality: "GBR", homeRegion: "South Coast" },
  { key: "emiel-lantern", tier: "AMATEUR", firstName: "Emiel", surname: "Lantaarnveld", nickname: "Late Lantern", nationality: "BEL", homeRegion: "Flanders" },
] as const;
