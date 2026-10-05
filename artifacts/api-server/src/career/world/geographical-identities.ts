import { pick, scopedRandom, weighted } from "./random.ts";
import type { Npc } from "./types.ts";

/** Player database v2. Used ONLY for newly generated people, never established rows. */
export const GEOGRAPHICAL_POOLS = [
  { weight: 22, country: "GBR", regions: ["Ayrshire", "Greater Glasgow/Clyde", "Central Scotland", "Edinburgh/Lothians", "Borders", "North-East Scotland", "Highlands"],
    first: ["Ewan", "Iain", "Fraser", "Alasdair", "Ruaridh", "Callum", "Gregor", "Finlay"], women: ["Mairi", "Eilidh", "Isla", "Iona", "Fiona", "Kirsty", "Catriona", "Ailsa"],
    last: ["Calderbank", "Glenford", "Kerrigan", "Strathburn", "Muirfield", "Craigell", "Dunross", "Aitkenwell"] },
  { weight: 15, country: "GBR", regions: ["North East", "Midlands", "South Coast"],
    first: ["Orin", "Ellis", "Tobin", "Rafe", "Alden", "Callan", "Joss", "Keir"], women: ["Mara", "Holly", "Nora", "Eliza", "Imogen", "Freya", "Beth", "Laurel"],
    last: ["Bracken", "Fallow", "Merewood", "Fenholt", "Rookmere", "Ashcombe", "Wrenford", "Cresswell"] },
  { weight: 5, country: "GBR", regions: ["South Wales"], first: ["Bryn", "Ioan", "Gethin", "Rhys", "Dafydd", "Aled"], women: ["Carys", "Nia", "Ffion", "Seren", "Eleri", "Megan"], last: ["Brynwood", "Cwmford", "Llewellyn", "Penrhos", "Gwynell", "Rhuddell"] },
  { weight: 3, country: "GBR", regions: ["Northern Ireland"], first: ["Conall", "Niall", "Ronan", "Declan", "Fintan", "Ciaran"], women: ["Maeve", "Orla", "Aoife", "Niamh", "Roisin", "Clodagh"], last: ["Laganford", "Dunellan", "Carrowell", "Tullyvale", "Ardmore", "Glenavan"] },
  { weight: 8, country: "IRL", regions: ["Munster", "Connacht", "Leinster"], first: ["Fionn", "Cian", "Oisin", "Eoin", "Dara", "Lorcan"], women: ["Saoirse", "Aisling", "Ciara", "Sinead", "Deirdre", "Una"], last: ["Kilmere", "Ballyford", "Rosheen", "Carran", "Ardmore", "Tullyvale"] },
  { weight: 8, country: "NLD", regions: ["Utrecht", "Limburg", "Friesland"], first: ["Bram", "Ties", "Sjoerd", "Jelte", "Cas", "Rens"], women: ["Sanne", "Lotte", "Femke", "Anouk", "Maud", "Jasmijn"], last: ["Meerveld", "Korenbos", "Duinakker", "Veenhof", "Rietkamp", "Houtveen"] },
  { weight: 8, country: "DEU", regions: ["Hessen", "Saxony", "Bremen"], first: ["Arno", "Falk", "Marten", "Tilo", "Henrik", "Lennart"], women: ["Anja", "Maren", "Klara", "Leonie", "Greta", "Inga"], last: ["Lindenfels", "Kornwald", "Felsmann", "Seewald", "Wiesenbach", "Auenberg"] },
  { weight: 4, country: "BEL", regions: ["Flanders", "Wallonia"], first: ["Emiel", "Joren", "Nand", "Senne", "Thijs", "Remi"], women: ["Elise", "Noor", "Lieve", "Camille", "Fien", "Manon"], last: ["Lindepoort", "Kerkendaal", "Hazelhof", "Rivemont", "Clairval", "Veldbrug"] },
  { weight: 4, country: "FRA", regions: ["Île-de-France"], first: ["Luc", "Adrien", "Bastien", "Etienne", "Loic", "Remi"], women: ["Amelie", "Ines", "Celine", "Juliette", "Meline", "Adele"], last: ["Valmont", "Boiselle", "Rocheval", "Clairbois", "Montelac", "Riveaux"] },
  { weight: 4, country: "SWE", regions: ["Stockholm"], first: ["Albin", "Erik", "Oskar", "Isak", "Nils", "Elias"], women: ["Linnea", "Signe", "Elin", "Alva", "Maja", "Ebba"], last: ["Lindskog", "Bergvall", "Sundelin", "Norberg", "Ekstrand", "Holmgren"] },
  { weight: 6, country: "JPN", regions: ["Kanto"], first: ["Ren", "Haruto", "Daichi", "Sota", "Kenta", "Yuto"], women: ["Aoi", "Hina", "Yui", "Mio", "Saki", "Rina"], last: ["Morioka", "Sakimura", "Kawashiro", "Hoshida", "Takayama", "Nishihara"] },
  { weight: 5, country: "USA", regions: ["New York"], first: ["Harlan", "Emmett", "Quinn", "Noel", "Linden", "Tate"], women: ["Avery", "Morgan", "Reese", "Willa", "June", "Hazel"], last: ["Pinehurst", "Redwater", "Alderbrook", "Valecrest", "Mossford", "Elmshore"] },
  { weight: 4, country: "CAN", regions: ["Ontario", "Alberta", "Nova Scotia"], first: ["Ashton", "Darcy", "Flynn", "Rowan", "Keir", "Arden"], women: ["Marlowe", "Sienna", "Laine", "Tessa", "Rory", "Claire"], last: ["Ridgewell", "Greyhaven", "Cedarbank", "Saltmere", "Reedwell", "Northcott"] },
  { weight: 4, country: "AUS", regions: ["Victoria", "Queensland", "Western Australia"], first: ["Lachlan", "Flynn", "Rowan", "Darcy", "Tate", "Keir"], women: ["Matilda", "Piper", "Zara", "Indie", "Mila", "Harper"], last: ["Willowby", "Wattleford", "Kestrel", "Sandwick", "Reedwell", "Cedarbank"] },
] as const;
export function geographicalIdentities(seed: string, people: readonly Npc[], existing: readonly Npc[] = []): Npc[] {
  const used = new Set(existing.map(p => `${p.firstName} ${p.surname}`));
  return people.map(p => {
    if (p.templateKey) { used.add(`${p.firstName} ${p.surname}`); return p; }
    const rng = scopedRandom(seed, 2, "geographical-identity", p.worldKey), pool = weighted(rng, GEOGRAPHICAL_POOLS);
    const firstPool = p.worldKey.startsWith("women:") ? pool.women : pool.first;
    let firstName = "", surname = "", accepted = false;
    for (let i = 0; i < 1024; i++) {
      firstName = pick(rng, firstPool); surname = pick(rng, pool.last);
      if (i >= 24) surname += `-${pick(rng, pool.last)}`;
      if (!used.has(`${firstName} ${surname}`)) { accepted = true; break; }
    }
    // Deterministic middle initials extend a crowded pool without numeric names
    // or renaming established people. Never consume the ability/development RNG.
    if(!accepted)for(const initial of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      for(const first of firstPool)for(const last of pool.last) {
        if(!accepted&&!used.has(`${first} ${initial}. ${last}`)){firstName=`${first} ${initial}.`;surname=last;accepted=true;}
      }
      if(accepted)break;
    }
    if (!accepted) throw new Error("Authored identity pool exhausted; extend the pool");
    used.add(`${firstName} ${surname}`);
    const nick=scopedRandom(seed,1,"curated-presentation-nickname",p.createdSeason,p.worldKey);
    return { ...p, firstName, surname, nickname:nick()<0.06?pick(nick,["The Anchor","Steady Hand","The Herald","The Quiet One"]):null,
      nationality: pool.country, homeRegion: pick(rng, pool.regions) };
  });
}
