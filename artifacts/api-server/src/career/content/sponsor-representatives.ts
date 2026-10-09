/**
 * Stable fictional commercial contacts. These are content identities, not
 * simulated people: they have no schedules, messages, or independent state.
 */
export type SponsorRepresentative = {
  id: string;
  sponsorId: string;
  displayName: string;
  role: string;
};

export const SPONSOR_REPRESENTATIVES: readonly SponsorRepresentative[] = Object.freeze([
  { id: "rep-ironflight-mara-kade", sponsorId: "ironflight", displayName: "Mara Kade", role: "Athlete Partnerships Director" },
  { id: "rep-redpoint-ellis-byrne", sponsorId: "redpoint-darts", displayName: "Ellis Byrne", role: "Player Relations Lead" },
  { id: "rep-ochre-nia-calder", sponsorId: "ochre-darts", displayName: "Nia Calder", role: "Community Partnerships Manager" },
  { id: "rep-apex-rowan-finch", sponsorId: "apex-arrow", displayName: "Rowan Finch", role: "Global Athlete Manager" },
  { id: "rep-forge-sport-leah-morrow", sponsorId: "forge-sport", displayName: "Leah Morrow", role: "Teamwear Partnerships Lead" },
  { id: "rep-northstar-isaac-rowe", sponsorId: "northstar-performance", displayName: "Isaac Rowe", role: "Performance Partnerships Manager" },
  { id: "rep-vela-samira-vale", sponsorId: "vela-sport", displayName: "Samira Vale", role: "International Player Liaison" },
  { id: "rep-northway-owen-strath", sponsorId: "northway-logistics", displayName: "Owen Strath", role: "Touring Partnerships Manager" },
  { id: "rep-relay-freight-amina-voss", sponsorId: "relay-freight", displayName: "Amina Voss", role: "Athlete Travel Coordinator" },
  { id: "rep-aeronorth-jules-meyer", sponsorId: "aeronorth-travel", displayName: "Jules Meyer", role: "Global Events Liaison" },
  { id: "rep-meridian-tariq-hale", sponsorId: "meridian-energy", displayName: "Tariq Hale", role: "Commercial Partnerships Director" },
  { id: "rep-sterling-row-imogen-ward", sponsorId: "sterling-row", displayName: "Imogen Ward", role: "Professional Sport Lead" },
  { id: "rep-north-coast-ellis-mackay", sponsorId: "north-coast", displayName: "Ellis Mackay", role: "Brand Partnerships Manager" },
  { id: "rep-lochside-fiona-reid", sponsorId: "lochside-joinery", displayName: "Fiona Reid", role: "Local Partnerships Contact" },
  { id: "rep-clyde-electrical-calum-glen", sponsorId: "clyde-electrical", displayName: "Calum Glen", role: "Community Sponsor Contact" },
  { id: "rep-garnock-garage-erin-bell", sponsorId: "garnock-garage", displayName: "Erin Bell", role: "Club Partnerships Contact" },
]);

export const representativeById = (id: string) => SPONSOR_REPRESENTATIVES.find(rep => rep.id === id);
export const representativeForSponsor = (sponsorId: string) => SPONSOR_REPRESENTATIVES.find(rep => rep.sponsorId === sponsorId);
