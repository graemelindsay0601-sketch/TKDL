export type ArchivePlayer = { id: string; name: string; retiredSeason?: number };
export type ChronicleSeason = {
  season: number;
  numberOne: { name: string; week: number } | null;
  champions: { id: string; tier: string; name: string; participant: string }[];
  cardChanges: { id: string; participant: string; source: string; status: string }[];
  retirements: { id: string; name: string }[];
  newEntrants: ArchivePlayer[];
};

export const players: ArchivePlayer[] = [
  { id: "p-ellis", name: "Mara Ellis" },
  { id: "p-varga", name: "Tomas Varga" },
  { id: "p-mccall", name: "Rory McCall" },
  { id: "p-adebayo", name: "Nia Adebayo" },
  { id: "p-sato", name: "Ren Sato" },
  { id: "p-ward", name: "Callum Ward", retiredSeason: 9 },
  { id: "p-ibrahim", name: "Samira Ibrahim" },
  { id: "p-holt", name: "Finlay Holt", retiredSeason: 6 },
  { id: "p-kovac", name: "Luka Kovac" },
  { id: "p-byrne", name: "Aisling Byrne" },
  { id: "p-doyle", name: "Patrick Doyle", retiredSeason: 5 },
  { id: "p-reed", name: "Jules Reed" },
  { id: "p-okafor", name: "Chidi Okafor" },
  { id: "p-morgan", name: "Kit Morgan" },
];

export const completedSeasons = [10, 9, 8, 7, 6, 5, 4];
export const world: ChronicleSeason[] = [
  {
    season: 10,
    numberOne: { name: "Mara Ellis", week: 48 },
    champions: [
      { id: "s10-wc", tier: "World", name: "World Championship", participant: "p-ellis" },
      { id: "s10-m", tier: "Major", name: "Autumn Masters", participant: "p-varga" },
      { id: "s10-c", tier: "Pro", name: "Continental Trophy", participant: "p-adebayo" },
    ],
    cardChanges: [
      { id: "s10-card1", participant: "p-okafor", source: "Q-School", status: "Gained" },
      { id: "s10-card2", participant: "p-morgan", source: "Development Tour", status: "Retained" },
    ],
    retirements: [],
    newEntrants: [{ id: "p-morgan", name: "Kit Morgan" }, { id: "p-okafor", name: "Chidi Okafor" }],
  },
  {
    season: 9,
    numberOne: { name: "Tomas Varga", week: 46 },
    champions: [
      { id: "s9-wc", tier: "World", name: "World Championship", participant: "p-varga" },
      { id: "s9-m", tier: "Major", name: "City of Lakes Open", participant: "p-sato" },
    ],
    cardChanges: [
      { id: "s9-card1", participant: "p-byrne", source: "Challenge Tour", status: "Gained" },
      { id: "s9-card2", participant: "p-reed", source: "Order of Merit", status: "Retained" },
    ],
    retirements: [{ id: "p-ward", name: "Callum Ward" }],
    newEntrants: [{ id: "p-reed", name: "Jules Reed" }, { id: "p-byrne", name: "Aisling Byrne" }],
  },
  {
    season: 8,
    numberOne: { name: "Mara Ellis", week: 47 },
    champions: [
      { id: "s8-wc", tier: "World", name: "World Championship", participant: "p-ellis" },
      { id: "s8-m", tier: "Major", name: "Autumn Masters", participant: "p-mccall" },
    ],
    cardChanges: [{ id: "s8-card1", participant: "p-kovac", source: "Q-School", status: "Gained" }],
    retirements: [],
    newEntrants: [{ id: "p-kovac", name: "Luka Kovac" }, { id: "p-ibrahim", name: "Samira Ibrahim" }],
  },
  {
    season: 7,
    numberOne: { name: "Ren Sato", week: 44 },
    champions: [
      { id: "s7-wc", tier: "World", name: "World Championship", participant: "p-sato" },
      { id: "s7-m", tier: "Major", name: "North Sea Classic", participant: "p-ellis" },
    ],
    cardChanges: [{ id: "s7-card1", participant: "p-adebayo", source: "Development Tour", status: "Gained" }],
    retirements: [],
    newEntrants: [{ id: "p-adebayo", name: "Nia Adebayo" }, { id: "p-sato", name: "Ren Sato" }],
  },
  {
    season: 6,
    numberOne: { name: "Rory McCall", week: 43 },
    champions: [{ id: "s6-wc", tier: "World", name: "World Championship", participant: "p-mccall" }],
    cardChanges: [{ id: "s6-card1", participant: "p-ellis", source: "Q-School", status: "Gained" }],
    retirements: [{ id: "p-holt", name: "Finlay Holt" }],
    newEntrants: [{ id: "p-ellis", name: "Mara Ellis" }],
  },
  {
    season: 5,
    numberOne: null,
    champions: [{ id: "s5-wc", tier: "World", name: "World Championship", participant: "p-mccall" }],
    cardChanges: [],
    retirements: [{ id: "p-doyle", name: "Patrick Doyle" }],
    newEntrants: [{ id: "p-mccall", name: "Rory McCall" }],
  },
  {
    season: 4,
    numberOne: { name: "Rory McCall", week: 42 },
    champions: [{ id: "s4-wc", tier: "World", name: "World Championship", participant: "p-mccall" }],
    cardChanges: [],
    retirements: [],
    newEntrants: [{ id: "p-doyle", name: "Patrick Doyle" }],
  },
];

export const archiveCounts = { recordedPlayers: 14, retiredPlayers: 3, hallOfFame: 2 };
