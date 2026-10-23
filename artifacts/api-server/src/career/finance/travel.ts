import { COUNTY_CATCHMENTS, LOCALITIES, VENUES } from "../calendar/geography.ts";
import { milesBetween } from "../calendar/coordinates.ts";
import { NEARBY_VENUES, TRAVEL_PROFILE, TRIP_MAX_GAP_DAYS, type TravelBand } from "./config.ts";

/**
 * Deterministic travel abstraction over A3 geography. Inputs are the player's
 * home (locality/country/zone from the A3 sporting-status provider) and the
 * event's venue/locality/country/zone. Nationality is never an input.
 */
export type Home = { locality: string; country: string; zone: string; travelVersion?:number; travelDiscountPercent?:number };
/** One-off equipment perks apply only to future travel, never entry or accommodation. */
export const discountedTravelPence = (pence:number,home:Home) =>
  Math.floor(Math.max(0,pence)*(100-Math.max(0,Math.min(100,home.travelDiscountPercent??0)))/100);
export type EventPlace = { id: string; start_day: number; end_day: number; locality_key: string | null; venue_key: string; country: string; zone: string; city: string; circuit: string; series_key: string | null };

export function travelBand(home: Home, event: Pick<EventPlace, "locality_key" | "venue_key" | "country" | "zone">): TravelBand {
  if (home.travelVersion === 3) {
    // Only your own area is free; everywhere else in the UK and Ireland is priced by distance (tripCost).
    const locality = LOCALITIES.find(l => l.key === home.locality), venue = VENUES.find(v => v.key === event.venue_key);
    if (event.country === home.country && (event.locality_key === home.locality || (venue && locality && venue.region === locality.region))) return "LOCAL";
  } else if(home.travelVersion===2) {
    // County sporting catchments are NOT travel catchments: old Ayrshire/Highlands
    // and country-wide Australian/Canadian fields must not imply free travel.
    const locality=LOCALITIES.find(l=>l.key===home.locality);
    const venue=VENUES.find(v=>v.key===event.venue_key);
    if(event.country===home.country && (event.locality_key===home.locality ||
      (venue && locality && venue.region===locality.region) ||
      (NEARBY_VENUES_V2[home.locality]??[]).includes(event.venue_key)))return "LOCAL";
  } else {
    const catchment = COUNTY_CATCHMENTS[home.locality] ?? [home.locality];
    if ((event.locality_key && catchment.includes(event.locality_key)) || (NEARBY_VENUES[home.locality] ?? []).includes(event.venue_key)) return "LOCAL";
  }
  if (event.country === home.country) return "DOMESTIC";
  if (event.zone === "UK_IRELAND" && home.zone === "UK_IRELAND") return "UK_IRELAND";
  if (event.zone === "EUROPE" || (home.zone === "EUROPE" && event.zone === "UK_IRELAND")) return "EUROPE";
  return "LONG_HAUL";
}
/** Canonical exceptions only; same-region authored and generated venues are automatic. */
export const NEARBY_VENUES_V2:Record<string,readonly string[]> = {
  ayrshire:["glasgow-hall","foundry-glasgow","clyde-arena","kelvin-assembly"],
  "glasgow-clyde":["glasgow-hall","ayr-pavilion","burns-hall"],
  "edinburgh-lothians":["castle-exchange-edinburgh"],
  "central-scotland":["stirling-civic"],
  "north-east":["northern-forum-newcastle"], midlands:["midlands-oche"],
  "south-wales":["riverside-hall-cardiff"], leinster:["harbour-rooms-dublin"],
};

export const destinationOf = (band: TravelBand, event: Pick<EventPlace, "country" | "city">) => band === "LOCAL" ? "HOME" : band === "DOMESTIC" ? `${event.country}:${event.city}` : event.country;

/** Trip cost for a span of consecutive competition days (one outbound + one return). */
export function tripCost(band: TravelBand, spanDays: number, miles: number | null = null, seaCrossing = false) {
  const p = TRAVEL_PROFILE[band];
  if (miles !== null && (band === "DOMESTIC" || band === "UK_IRELAND")) return { band, ...distanceTrip(miles, spanDays, seaCrossing, p.nightlyPence) };
  const nights = spanDays >= p.overnightFromDays ? spanDays + p.extraNights : 0;
  return { band, travelPence: p.roundTripPence, nights, accommodationPence: nights * p.nightlyPence };
}

/**
 * Travel v3 (UK and Ireland): by road distance (straight line x1.25). Up to 250 road miles you drive or take the
 * train at about 16p a mile there and back (Kilbirnie to Glasgow is about £7); further, or over the Irish Sea, you
 * fly or take a long train (about £50 plus 24p a straight-line mile). Within 60 road miles you go home each night;
 * up to 150 you stay over between days; beyond that, or over the sea, you stay every night.
 */
export const TRAVEL_V3 = Object.freeze({ roadFactor: 1.25, carPencePerMile: 16, minimumPence: 400, driveUpToRoadMiles: 250,
  farePence: 5000, farePencePerMile: 24, commuteUpToRoadMiles: 60, overnightFromRoadMiles: 150 });
export function distanceTrip(straightMiles: number, spanDays: number, seaCrossing: boolean, nightlyPence: number) {
  const v = TRAVEL_V3, road = straightMiles * v.roadFactor;
  const fly = seaCrossing || road > v.driveUpToRoadMiles;
  const roundTrip = fly ? v.farePence + straightMiles * v.farePencePerMile : Math.max(v.minimumPence, road * 2 * v.carPencePerMile);
  const commute = !fly && road <= v.commuteUpToRoadMiles;
  const nights = fly || road > v.overnightFromRoadMiles ? spanDays : commute ? 0 : Math.max(0, spanDays - 1);
  const travelPence = Math.round((commute ? roundTrip * spanDays : roundTrip) / 100) * 100;
  return { travelPence, nights, accommodationPence: nights * nightlyPence, miles: Math.round(road) };
}
/** Weekly league nights: one evening a week, not a stay for the whole season. */
const leagueNights = (e: { start_day: number; end_day: number; snapshot?: { format?: { structure?: string } } }) =>
  e.snapshot?.format?.structure === "LEAGUE" ? Math.floor((e.end_day - e.start_day) / 7) + 1 : null;
/** A weekly league (one event, a night each week): its travel is paid night by night, in the week of each night. */
export const isWeeklyLeague = (e: { start_day: number; end_day: number; series_key?: string | null; snapshot?: unknown }) =>
  !e.series_key && leagueNights(e as Parameters<typeof leagueNights>[0]) !== null;
export const leagueNightDays = (e: { start_day: number; end_day: number }) =>
  Array.from({ length: Math.floor((e.end_day - e.start_day) / 7) + 1 }, (_, i) => e.start_day + i * 7);
/** A trip's cost; a league is a separate one-night trip for each of its weekly nights. */
export function priceTrip(band: TravelBand, events: readonly { start_day: number; end_day: number; snapshot?: unknown }[], start: number, end: number,
  miles: number | null, sea: boolean) {
  const nights = events.length === 1 ? leagueNights(events[0] as Parameters<typeof leagueNights>[0]) : null;
  if (nights === null) return tripCost(band, end - start + 1, miles, sea);
  const one = tripCost(band, 1, miles, sea);
  return { band, travelPence: one.travelPence * nights, nights: one.nights * nights, accommodationPence: one.accommodationPence * nights };
}
const IRELAND_ISLAND = new Set(["IRL:Dublin", "IRL:Cork", "IRL:Galway", "GBR:Belfast"]);
/** Miles from home to the event's town and whether the trip crosses the Irish Sea (null distance: unknown town). */
export function journey(home: Home, event: Pick<EventPlace, "country" | "city">) {
  const town = LOCALITIES.find(l => l.key === home.locality);
  if (!town || home.travelVersion !== 3) return { miles: null, sea: false };
  const from = `${town.country}:${town.city}`, to = `${event.country}:${event.city}`;
  return { miles: milesBetween(town, event), sea: IRELAND_ISLAND.has(from) !== IRELAND_ISLAND.has(to) };
}

/**
 * Trip grouping: entered events sorted by start day chain into one trip while the
 * next event starts within TRIP_MAX_GAP_DAYS of the chain's end at the same
 * destination (series days always chain). LOCAL events never form trips.
 */
export function groupTrips(home: Home, events: readonly EventPlace[]) {
  const sorted = [...events].sort((a, b) => a.start_day - b.start_day || (a.id < b.id ? -1 : 1));
  const trips: { band: TravelBand; destination: string; start: number; end: number; events: EventPlace[] }[] = [];
  for (const event of sorted) {
    const band = travelBand(home, event);
    if (band === "LOCAL") continue;
    const destination = destinationOf(band, event);
    const last = trips[trips.length - 1];
    if (last && last.destination === destination && event.start_day - last.end <= TRIP_MAX_GAP_DAYS) {
      last.end = Math.max(last.end, event.end_day); last.events.push(event);
    } else trips.push({ band, destination, start: event.start_day, end: event.end_day, events: [event] });
  }
  return trips.map(t => { const j = journey(home, t.events[0]); return { ...t, ...priceTrip(t.band, t.events, t.start, t.end, j.miles, j.sea) }; });
}
