export type CareerKitDesign = {
  id: string;
  number: string;
  name: string;
  collection: string;
  cut: string;
  detail: string;
  image: string;
  makerBrandId?: string;
};

const designRows = [
  ["Redline", "Precision", "Point-collar polo", "Scarlet shoulder cap, white slash and fine cobalt piping."],
  ["Circuit Break", "Precision", "Mandarin zip shirt", "Emerald body with asymmetric black and copper circuit bands."],
  ["Flightpath", "Precision", "Split-placket polo", "Cobalt and burnt-orange panels with a silver seam line."],
  ["Bullseye", "Precision", "Crew-neck performance top", "Charcoal and garnet target-ring jacquard with gold accents."],
  ["Nightshift", "Precision", "Quarter-zip mock neck", "Matte black with a vivid fuchsia side wedge and smoke yoke."],
  ["Vault", "Precision", "Tall band-collar jersey", "Forest green with amber architecture panels and gold stitching."],
  ["Prism", "Precision", "Short-zip stand collar", "Teal fabric with violet and cyan crystalline panels."],
  ["Heritage", "Precision", "Wide-spread collar shirt", "Cream, oxblood and midnight with a refined woven block."],
  ["Counterpoint", "Precision", "Zip-collar technical shirt", "Crimson, ivory and graphite with angular negative space."],
  ["Stormline", "Precision", "Raglan crew jersey", "Navy raglan sleeves and an electric-cyan wave panel."],
  ["Gilded Orbit", "Rivalry", "Point-collar tournament polo", "Oversized gold orbital arcs sweep across deep navy."],
  ["Apex Cobalt", "Rivalry", "Mandarin-collar shirt", "Brilliant cobalt, orange shoulders and crisp white wedges."],
  ["Voltage", "Rivalry", "V-notch rib-collar jersey", "Black with high-voltage lime panels and zigzag seams."],
  ["Lotus", "Rivalry", "Soft stand-collar shirt", "Plum and teal fields with bold abstract petal panels."],
  ["Northstar", "Rivalry", "Offset high-collar jersey", "Arctic white and midnight panels form a sharp starburst."],
  ["Split Decision", "Rivalry", "Asymmetric polo", "Half-charcoal, half-crimson construction with an ivory break."],
  ["Ironclad", "Rivalry", "Heavy crew-neck top", "Dense graphite knit, stepped steel panels and a red sleeve."],
  ["Monarch", "Rivalry", "Contrast spread-collar shirt", "Amethyst and antique-gold art-deco fan geometry."],
  ["Cyan Traverse", "Rivalry", "Zip polo", "Midnight body crossed by an oversized turquoise band."],
  ["Emberline", "Rivalry", "Short-zip stand-collar jersey", "Copper-red panels climb a black body like a fast brushstroke."],
  ["Retro 78", "Heritage", "Wide 70s polo collar", "Cream, rust and navy blocks with a broad ribbed collar."],
  ["Boardwalk", "Heritage", "Open resort-collar shirt", "Midnight teal with coral and sea-glass geometric forms."],
  ["Tartan Ace", "Heritage", "Button-placket polo", "Ink-blue body with a broad amber-and-cream woven panel."],
  ["Graphite Dash", "Heritage", "Half-zip mock collar", "Slate, white and coral racing bands with a graphite collar."],
  ["Neon Flock", "Heritage", "Crew-neck sport shirt", "Plum-black base with hot-pink and icy-blue shards."],
  ["Aurora", "Heritage", "High-stand collar shirt", "Forest and violet with flowing emerald-to-lilac ribbons."],
  ["Blue Steel", "Heritage", "Narrow-rib polo", "Electric azure, vertical silver rays and a black shoulder yoke."],
  ["Heatwave", "Heritage", "Zip-neck performance top", "Burnt orange and scarlet sunburst panels over charcoal."],
  ["Prism Shard", "Heritage", "Split-collar jersey", "Magenta, cobalt and ice-blue crystalline chevrons."],
  ["Phantom", "Heritage", "Sculpted high-neck shirt", "Stealth-black jacquard with smoke shards and ivory contrast."],
  ["Kaleidoscope", "Energy", "Panelled-sleeve polo", "Jewel-tone mosaic panels in teal, amber, magenta and cobalt."],
  ["Overdrive", "Energy", "High-zip athletic shirt", "Red, flame-orange and yellow racing stripes over charcoal."],
  ["Sandstorm", "Energy", "Mandarin-collar shirt", "Sandstone, black and bronze bands with dune-wave jacquard."],
  ["Deep Current", "Energy", "Split-neck polo", "Navy torso with aqua wave panels and crisp white piping."],
  ["Signal", "Energy", "Clean crew jersey", "Chalk-white framed in black with a hot-pink and scarlet slash."],
  ["Meridian", "Energy", "Slim-band collar shirt", "Pine green crossed by champagne and pale-ivory bands."],
  ["Electric Bloom", "Energy", "Raglan collarless jersey", "Cobalt base with oversized fuchsia, cyan and teal panels."],
  ["Vector", "Energy", "Asymmetric collar jersey", "Orange slices through midnight navy and steel-grey blocks."],
  ["Icebreaker", "Energy", "Mock-neck zip shirt", "Ice-white shards over navy with crystalline texture."],
  ["Rosewood", "Energy", "Spread-collar polo", "Burgundy, copper and black woven panels with a pointed collar."],
  ["Afterburn", "After Dark", "Quarter-zip collar", "Black body with a forceful scarlet and molten-orange slash."],
  ["Silverline", "After Dark", "Wing-tip polo collar", "Silver and black pinstripes with a broad white shoulder panel."],
  ["Static", "After Dark", "Buttonless polo", "Charcoal-and-ivory broken checks with a vivid coral panel."],
  ["Deep Space", "After Dark", "Crew-neck tournament jersey", "Inky violet with dotted orbital arcs and electric-pink accents."],
  ["Copper Circuit", "After Dark", "Quarter-zip stand collar", "Copper and dark teal angular bands over a black base."],
  ["Glacier", "After Dark", "Mandarin-collar jersey", "Navy and ice-white shards with a narrow aqua centre detail."],
  ["Jungle Beat", "After Dark", "Ribbed-collar performance polo", "Emerald and black with jade and muted-tan leaf geometry."],
  ["Ultraviolet", "After Dark", "Contrast crew-neck shirt", "Violet and cobalt blocks with a wide cyan diagonal panel."],
  ["Grand Slam", "After Dark", "Double-band polo collar", "Black and gold with tangerine side panels and jacquard."],
  ["The Final", "After Dark", "Raised buttonless collar", "Ivory, midnight and garnet blocks with champagne piping."],
] as const satisfies ReadonlyArray<readonly [string, string, string, string]>;

const historicalDesigns: CareerKitDesign[] = designRows.map(([name, collection, cut, detail], index) => {
  const number = String(index + 1).padStart(2, "0");
  return { name, collection, cut, detail, id: `kit-50-${number}`, number, image: `kit-50-${number}.webp` };
});

const tourRows = [
  ["Carbon Crown", "Precision", "Zip-collar tournament polo", "Ink-knit body with a champagne crown and engineered shoulder seams."],
  ["Redline Atelier", "Rivalry", "Point-collar tournament polo", "Deep navy base with scarlet speed panels and an ivory pinline."],
  ["Verdant Circuit", "Heritage", "Mandarin-collar shirt", "Forest technical knit with a copper circuit motif and clean piping."],
  ["Copper Tide", "Energy", "Split-placket polo", "Burnished copper rings cut through a midnight performance fabric."],
  ["After Hours", "After Dark", "Crew-neck performance jersey", "Violet star geometry set into a charcoal night-stage shirt."],
  ["Northern Chevron", "Precision", "High-stand collar jersey", "Jade and gold chevrons with a restrained ice-white seam."],
  ["Signal Point", "Rivalry", "Quarter-zip mock collar", "Warm ochre burst lines over a tailored graphite silhouette."],
  ["Club Standard", "Heritage", "Classic button-placket polo", "Cobalt blockwork and bright scarlet details for the local circuit."],
  ["Rose Circuit", "Energy", "Technical crew jersey", "Magenta panels framed by pale woven lines and a dark body."],
  ["Midnight Relay", "After Dark", "Zip-neck touring shirt", "Teal circuit traces on a black technical base with gold finishing."],
] as const;

const tourDesigns: CareerKitDesign[] = tourRows.map(([name, collection, cut, detail], index) => ({
  id: `kit-pro-${String(index + 1).padStart(2, "0")}`,
  number: `P${String(index + 1).padStart(2, "0")}`,
  name,
  collection,
  cut,
  detail,
  image: `kit-pro-${String(index + 1).padStart(2, "0")}.svg`,
}));

const nextWaveRows = [
  ["Civic Standard", "Precision", "Button-front club polo", "Midnight body, ivory shoulder yoke and scarlet seam piping."],
  ["Harbour Lights", "Rivalry", "Resort-collar regional shirt", "Sea-glass and coral panels with a subtle woven wave."],
  ["Royal Exchange", "Heritage", "Spread-collar professional polo", "Oxblood and black with fine champagne art-deco lines."],
  ["Comet Run", "Energy", "Stand-collar zip jersey", "Violet body crossed by cobalt comet-tail panels."],
  ["Ironflight Forge", "After Dark", "Mock-neck equipment jersey", "Graphite knit, brushed-steel wing and restrained red seams.", "ironflight"],
  ["Redpoint Velocity", "Precision", "Mandarin performance polo", "Carmine, white chevrons and black negative-space wedges.", "redpoint-darts"],
  ["Ochre Solar", "Rivalry", "Zip-collar maker polo", "Ochre gold, slate shoulders and eclipse jacquard.", "ochre-darts"],
  ["Northline Polar", "Heritage", "High-band technical jersey", "Glacial cyan and navy split with topographic knit.", "northline-darts"],
  ["Keystone Architect", "Energy", "Stand-collar maker shirt", "Stone grey with copper stepped geometry and ivory linework.", "keystone-darts"],
  ["Vector Nine Apex", "After Dark", "Folded-V performance shirt", "Forest and lime angular rising panels.", "vector-nine"],
  ["Club Green Room", "Precision", "Button polo", "Bottle green, broad cream rib collar and burgundy piping."],
  ["County Lines", "Rivalry", "Split-collar regional shirt", "Ivory and teal panels with copper contour lines."],
  ["Golden Hour", "Heritage", "Point-collar tour jersey", "Burnt orange and plum blocks with champagne arc."],
  ["Tidal Shift", "Energy", "Asymmetric zip jersey", "Turquoise, ultramarine and lilac panels."],
  ["Carbon Orchid", "After Dark", "Sculpted mock-neck shirt", "Black micro-jacquard with magenta petal geometry."],
  ["Redline Night Tour", "Precision", "Short-zip stage jersey", "Scarlet shoulder yoke, white blade and graphite mesh."],
  ["Ivory Comet", "Rivalry", "Wide-collar elite polo", "Pearl and navy with vivid fuchsia comet trails."],
  ["Black Tie 180", "Heritage", "Gold-edge championship polo", "Near-black fabric with brushed-gold geometry."],
  ["Blackforge Foundry", "Energy", "Graphite equipment polo", "Copper forge panels with engineered shoulder structure.", "blackforge-darts"],
  ["Apex Arrow Flight", "After Dark", "High-collar maker shirt", "White and cobalt with lime arrow panels.", "apex-arrow"],
  ["Forge Sport Apexline", "Precision", "Mandarin apparel jersey", "Black and red blocks with athletic seam lines.", "forge-sport"],
  ["Northstar Meridian", "Rivalry", "High-collar apparel shirt", "Navy starburst, silver and ice-blue piping.", "northstar-performance"],
  ["Baseline Tempo", "Heritage", "Split-placket performance polo", "Slate with emerald pace bands.", "baseline-athletic"],
  ["Vela Sails", "Energy", "Open-collar apparel shirt", "Midnight teal with coral and turquoise curves.", "vela-sport"],
  ["Vantage Crownline", "After Dark", "Sculpted signature shirt", "Black technical fabric with antique-gold woven geometry.", "vantage-darts"],
  ["Northstar Icefield", "Precision", "Point-collar technical polo", "Ice-blue body, navy sleeves and white diagonal.", "northstar-performance"],
  ["Harbour Smoke", "Rivalry", "Low-stand invitational shirt", "Burgundy-charcoal blocks with ivory shoulder and copper pinstripe."],
  ["Mosaic 180", "Heritage", "Asymmetric elite jersey", "Ink-blue facets in teal, amethyst and amber."],
  ["Sunday League", "Energy", "Classic club polo", "Cream torso, forest sleeves and burgundy side stripe."],
  ["The Contender", "After Dark", "Stand-collar challenger shirt", "Cobalt, citrus and navy angled panels."],
  ["Prism Fade", "Precision", "Button-collar club shirt", "Violet and teal fields with frost-blue piping."],
  ["Copper Cathedral", "Rivalry", "High-band regional shirt", "Navy with copper arches and muted-cream linework."],
  ["Velocity Rose", "Heritage", "Asymmetric stage jersey", "Black and crimson with sharp rose speed panels."],
  ["Whiteout", "Energy", "Wide-collar elite shirt", "White and silver with navy sleeves and cobalt diagonal."],
  ["Blackforge Shard", "After Dark", "Black stand-collar maker jersey", "Forged-steel facets in red and pale grey.", "blackforge-darts"],
  ["Apex Arrowhead", "Precision", "Mandarin maker shirt", "Royal blue with lime-and-white arrowhead panels.", "apex-arrow"],
  ["Northline Borealis", "Rivalry", "Stand-collar technical shirt", "Teal and black with arctic cyan ribbons.", "northline-darts"],
  ["Vector Nine Gridline", "Heritage", "Point-collar maker jersey", "Navy with silver grid panels and lime blocks.", "vector-nine"],
  ["Vela Afterglow", "Energy", "Open-collar signature shirt", "Deep plum with coral and pale-gold sail panels.", "vela-sport"],
  ["Baseline Crosscourt", "After Dark", "Ribbed-crew apparel jersey", "Warm white, graphite and emerald blocks.", "baseline-athletic"],
] as const;

const nextWaveDesigns: CareerKitDesign[] = nextWaveRows.map(([name, collection, cut, detail, makerBrandId], index) => ({
  id: `kit-100-${String(index + 1).padStart(2, "0")}`,
  number: String(index + 61).padStart(3, "0"),
  name, collection, cut, detail, ...(makerBrandId ? { makerBrandId } : {}),
  image: `kit-100-${String(index + 1).padStart(2, "0")}.webp`,
}));

export const CAREER_KIT_DESIGNS: CareerKitDesign[] = [...historicalDesigns, ...tourDesigns, ...nextWaveDesigns];
export const CAREER_KIT_BY_ID = new Map(CAREER_KIT_DESIGNS.map(design => [design.id, design]));
export function isCareerKitAvailable(design: CareerKitDesign, activePartnerBrandIds: readonly string[], currentlySelectedId?: string) {
  return !design.makerBrandId || design.id === currentlySelectedId || activePartnerBrandIds.includes(design.makerBrandId);
}

export const CAREER_KIT_COLLECTIONS = ["Precision", "Rivalry", "Heritage", "Energy", "After Dark"] as const;
export type CareerKitCollection = (typeof CAREER_KIT_COLLECTIONS)[number];

export const CAREER_KIT_COLORWAYS = [
  { name: "Midnight", primary: "#17243b" },
  { name: "Scarlet", primary: "#a92c43" },
  { name: "Cobalt", primary: "#315eae" },
  { name: "Emerald", primary: "#267457" },
  { name: "Violet", primary: "#705090" },
  { name: "Copper", primary: "#a75b38" },
  { name: "Glacier", primary: "#6ca4bd" },
  { name: "Champagne", primary: "#ae8642" },
] as const;

export function filterCareerKitDesigns(collection: "All shirts" | CareerKitCollection, search: string) {
  const query = search.trim().toLowerCase();
  return CAREER_KIT_DESIGNS.filter(design =>
    (collection === "All shirts" || design.collection === collection) &&
    (!query || `${design.name} ${design.cut} ${design.collection} ${design.detail}`.toLowerCase().includes(query)),
  );
}
