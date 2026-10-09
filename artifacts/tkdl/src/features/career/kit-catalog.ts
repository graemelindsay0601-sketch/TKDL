export type CareerKitDesign = {
  id: string;
  number: string;
  name: string;
  collection: string;
  cut: string;
  detail: string;
  image: string;
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

export const CAREER_KIT_DESIGNS: CareerKitDesign[] = designRows.map(([name, collection, cut, detail], index) => {
  const number = String(index + 1).padStart(2, "0");
  return { name, collection, cut, detail, id: `kit-50-${number}`, number, image: `kit-50-${number}.webp` };
});

export const CAREER_KIT_BY_ID = new Map(CAREER_KIT_DESIGNS.map(design => [design.id, design]));
